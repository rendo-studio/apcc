import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

import { readYamlFile, writeYamlFile } from "./storage.js";
import { getWorkspacePaths } from "./workspace.js";
import type { DecisionCategory, DecisionRecord, DecisionState, DecisionStatus } from "./types.js";

interface LegacyDecisionRecordShape {
  id: string;
  name: string;
  description: string;
  proposedBy?: string;
  notActingCost?: string;
  expectedValue?: string;
  boundary?: string;
  status?: string;
  decisionSummary?: string | null;
  revisitCondition?: string | null;
  createdAt?: string;
  decidedAt?: string | null;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function looksLikeLegacyDecisionRecord(value: unknown): value is LegacyDecisionRecordShape {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.notActingCost === "string" &&
    typeof candidate.expectedValue === "string"
  );
}

function mapLegacyStatus(status: string | undefined): DecisionStatus {
  if (status === "started") {
    return "approved";
  }
  if (status === "rejected") {
    return "rejected";
  }
  return "pending";
}

function mapLegacyRecord(record: LegacyDecisionRecordShape): DecisionRecord {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    docPath: null,
    category: "change",
    proposedBy: record.proposedBy ?? "agent",
    context: record.description,
    impactOfNoAction: record.notActingCost ?? "待补充",
    expectedOutcome: record.expectedValue ?? "待补充",
    boundary: record.boundary ?? "待补充",
    status: mapLegacyStatus(record.status),
    decisionSummary: record.decisionSummary ?? null,
    revisitCondition: record.revisitCondition ?? null,
    createdAt: record.createdAt ?? new Date().toISOString(),
    decidedAt: record.decidedAt ?? null
  };
}

async function findLegacyDecisionRecordFiles(): Promise<string[]> {
  const paths = getWorkspacePaths();
  const entries = await fs.readdir(paths.workspaceRoot, { withFileTypes: true }).catch(() => []);
  const matches: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidate = path.join(paths.workspaceRoot, entry.name, "records.yaml");
    if (candidate === paths.decisionFile || candidate === paths.versionFile || !existsSync(candidate)) {
      continue;
    }

    const payload = await readYamlFile<{ items?: unknown[] }>(candidate).catch(() => null);
    if (!payload?.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      continue;
    }

    if (payload.items.every((item) => looksLikeLegacyDecisionRecord(item))) {
      matches.push(candidate);
    }
  }

  return matches;
}

async function loadLegacyDecisionState(): Promise<DecisionState | null> {
  const legacyFiles = await findLegacyDecisionRecordFiles();
  const items: DecisionRecord[] = [];

  for (const filePath of legacyFiles) {
    const payload = await readYamlFile<{ items?: unknown[] }>(filePath).catch(() => null);
    if (!payload?.items || !Array.isArray(payload.items)) {
      continue;
    }

    for (const item of payload.items) {
      if (looksLikeLegacyDecisionRecord(item)) {
        items.push(mapLegacyRecord(item));
      }
    }
  }

  return items.length > 0 ? { items } : null;
}

async function purgeLegacyDecisionState() {
  const legacyFiles = await findLegacyDecisionRecordFiles();

  for (const filePath of legacyFiles) {
    await fs.rm(filePath, { force: true });
    const dirPath = path.dirname(filePath);
    const remaining = await fs.readdir(dirPath).catch(() => []);
    if (remaining.length === 0) {
      await fs.rm(dirPath, { recursive: true, force: true });
    }
  }
}

export async function loadDecisionState(): Promise<DecisionState> {
  try {
    return await readYamlFile<DecisionState>(getWorkspacePaths().decisionFile);
  } catch {
    return (await loadLegacyDecisionState()) ?? { items: [] };
  }
}

export async function saveDecisionState(state: DecisionState): Promise<void> {
  const paths = getWorkspacePaths();
  await writeYamlFile(paths.decisionFile, state);
  await purgeLegacyDecisionState();
}

export async function migrateDecisionState() {
  const current = await readYamlFile<DecisionState>(getWorkspacePaths().decisionFile).catch(() => ({ items: [] }));
  const legacy = await loadLegacyDecisionState();

  if (!legacy) {
    return { migrated: false, count: 0 };
  }

  const merged = new Map<string, DecisionRecord>();
  for (const record of legacy.items) {
    merged.set(record.id, record);
  }
  for (const record of current.items ?? []) {
    merged.set(record.id, record);
  }

  const nextState: DecisionState = {
    items: [...merged.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  };
  await saveDecisionState(nextState);

  return {
    migrated: true,
    count: legacy.items.length
  };
}

export async function listDecisionRecords(): Promise<DecisionRecord[]> {
  const state = await loadDecisionState();
  return [...state.items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getDecisionRecord(id: string): Promise<DecisionRecord> {
  const state = await loadDecisionState();
  const record = state.items.find((item) => item.id === id);
  if (!record) {
    throw new Error(`Decision record "${id}" does not exist.`);
  }
  return record;
}

export async function createDecisionRecord(input: {
  name: string;
  description: string;
  docPath?: string;
  category: DecisionCategory;
  proposedBy: string;
  context: string;
  impactOfNoAction: string;
  expectedOutcome: string;
  boundary: string;
}) {
  const state = await loadDecisionState();
  const baseId = slugify(input.name) || "decision";
  let id = baseId;
  let sequence = 2;

  while (state.items.some((item) => item.id === id)) {
    id = `${baseId}-${sequence}`;
    sequence += 1;
  }

  const record: DecisionRecord = {
    id,
    name: input.name,
    description: input.description,
    docPath: input.docPath ?? null,
    category: input.category,
    proposedBy: input.proposedBy,
    context: input.context,
    impactOfNoAction: input.impactOfNoAction,
    expectedOutcome: input.expectedOutcome,
    boundary: input.boundary,
    status: "pending",
    decisionSummary: null,
    revisitCondition: null,
    createdAt: new Date().toISOString(),
    decidedAt: null
  };

  const next: DecisionState = {
    items: [...state.items, record]
  };
  await saveDecisionState(next);

  return record;
}

export async function decideDecisionRecord(input: {
  id: string;
  decision: "approve" | "reject";
  summary: string;
  revisitCondition?: string;
}) {
  const state = await loadDecisionState();
  const index = state.items.findIndex((item) => item.id === input.id);

  if (index === -1) {
    throw new Error(`Decision record "${input.id}" does not exist.`);
  }

  const current = state.items[index];
  const updated: DecisionRecord = {
    ...current,
    status: input.decision === "approve" ? "approved" : "rejected",
    decisionSummary: input.summary,
    revisitCondition: input.revisitCondition ?? current.revisitCondition,
    decidedAt: new Date().toISOString()
  };

  const nextItems = [...state.items];
  nextItems[index] = updated;
  const next: DecisionState = {
    items: nextItems
  };
  await saveDecisionState(next);

  return updated;
}
