import { readYamlFile, writeYamlFile } from "./storage.js";
import { getWorkspacePaths } from "./workspace.js";
import { withWorkspaceMutationLock } from "./workspace-mutation.js";
import type { VersionRecord, VersionRecordStatus, VersionState } from "./types.js";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function loadVersionState(): Promise<VersionState> {
  try {
    return await readYamlFile<VersionState>(getWorkspacePaths().versionFile);
  } catch {
    return { items: [] };
  }
}

export async function saveVersionState(state: VersionState): Promise<void> {
  await withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    await writeYamlFile(paths.versionFile, state);
  });
}

export async function listVersionRecords(): Promise<VersionRecord[]> {
  const state = await loadVersionState();
  return [...state.items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getVersionRecord(id: string): Promise<VersionRecord> {
  const state = await loadVersionState();
  const record = state.items.find((item) => item.id === id);
  if (!record) {
    throw new Error(`Version record "${id}" does not exist.`);
  }
  return record;
}

export async function resolveVersionRecordSelector(selector: string): Promise<VersionRecord> {
  const state = await loadVersionState();
  const byId = state.items.find((item) => item.id === selector);
  if (byId) {
    return byId;
  }

  const byVersion = state.items.filter((item) => item.version === selector);
  if (byVersion.length === 1) {
    return byVersion[0];
  }
  if (byVersion.length > 1) {
    throw new Error(`Version selector "${selector}" is ambiguous. Use a version record id instead.`);
  }

  throw new Error(`Version selector "${selector}" does not match a version record id or version label.`);
}

export async function createVersionRecord(input: {
  version: string;
  title: string;
  summary: string;
  docPath?: string;
  decisionRefs?: string[];
}) {
  return withWorkspaceMutationLock(async () => {
    const state = await loadVersionState();
    if (state.items.some((item) => item.version === input.version)) {
      throw new Error(`Version "${input.version}" already exists as a project-level version record.`);
    }
    const baseId = slugify(`${input.version}-${input.title}`) || slugify(input.version) || "version-record";
    let id = baseId;
    let sequence = 2;

    while (state.items.some((item) => item.id === id)) {
      id = `${baseId}-${sequence}`;
      sequence += 1;
    }

    const record: VersionRecord = {
      id,
      version: input.version,
      title: input.title,
      summary: input.summary,
      docPath: input.docPath ?? null,
      status: "draft",
      decisionRefs: input.decisionRefs ?? [],
      highlights: [],
      breakingChanges: [],
      migrationNotes: [],
      validationSummary: null,
      createdAt: new Date().toISOString(),
      recordedAt: null
    };

    const paths = getWorkspacePaths();
    await writeYamlFile(paths.versionFile, {
      items: [...state.items, record]
    });

    return record;
  });
}

export async function updateVersionRecord(input: {
  id: string;
  summary?: string;
  docPath?: string | null;
  status?: VersionRecordStatus;
  addDecisionRefs?: string[];
  addHighlights?: string[];
  addBreakingChanges?: string[];
  addMigrationNotes?: string[];
  validationSummary?: string;
}) {
  return withWorkspaceMutationLock(async () => {
    const state = await loadVersionState();
    const index = state.items.findIndex((item) => item.id === input.id);
    if (index === -1) {
      throw new Error(`Version record "${input.id}" does not exist.`);
    }

    const current = state.items[index];
    const nextStatus = input.status ?? current.status;
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

    const updated: VersionRecord = {
      ...current,
      ...(input.summary ? { summary: input.summary } : {}),
      ...(input.docPath !== undefined ? { docPath: input.docPath } : {}),
      status: nextStatus,
      decisionRefs: unique([...current.decisionRefs, ...(input.addDecisionRefs ?? [])]),
      highlights: unique([...current.highlights, ...(input.addHighlights ?? [])]),
      breakingChanges: unique([...current.breakingChanges, ...(input.addBreakingChanges ?? [])]),
      migrationNotes: unique([...current.migrationNotes, ...(input.addMigrationNotes ?? [])]),
      validationSummary: input.validationSummary ?? current.validationSummary,
      recordedAt: nextStatus === "recorded" ? current.recordedAt ?? new Date().toISOString() : current.recordedAt
    };

    const next = {
      items: [...state.items]
    };
    next.items[index] = updated;
    const paths = getWorkspacePaths();
    await writeYamlFile(paths.versionFile, next);

    return updated;
  });
}
