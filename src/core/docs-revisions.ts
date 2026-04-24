import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { readText, writeText } from "./storage.js";
import type { DocRevisionEntry, DocRevisionRecord, DocsRevisionState } from "./types.js";

const MAX_REVISIONS_PER_DOC = 12;

interface FrontmatterShape {
  name?: string;
  description?: string;
}

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function parseFrontmatter(content: string): { frontmatter: FrontmatterShape; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: FrontmatterShape = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === "name" || key === "description") {
      frontmatter[key] = value;
    }
  }

  return {
    frontmatter,
    body: match[2] ?? ""
  };
}

function docsPathToSlug(relativePath: string): string[] {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const fileName = parts.at(-1) ?? "";
  const baseName = fileName.replace(/\.(md|mdx)$/i, "");

  if (baseName === "index") {
    return parts.slice(0, -1);
  }

  return [...parts.slice(0, -1), baseName];
}

function createRevisionId(relativePath: string, createdAt: string, hash: string): string {
  const slug = relativePath
    .replace(/\\/g, "/")
    .replace(/\.(md|mdx)$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40) || "doc";

  return `rev-${slug}-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}-${hash.slice(0, 8)}`;
}

async function collectMarkdownFiles(root: string, base = root): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath, base)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (extension === ".md" || extension === ".mdx") {
      files.push(path.relative(base, fullPath).replace(/\\/g, "/"));
    }
  }

  return files.sort();
}

export function emptyDocsRevisionState(): DocsRevisionState {
  return {
    generatedAt: null,
    items: []
  };
}

export async function loadDocsRevisionState(stateFile: string): Promise<DocsRevisionState> {
  try {
    return JSON.parse(await readText(stateFile)) as DocsRevisionState;
  } catch {
    return emptyDocsRevisionState();
  }
}

export async function saveDocsRevisionState(state: DocsRevisionState, stateFile: string): Promise<void> {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await writeText(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

export async function syncDocsRevisionState(docsRoot: string, stateFile: string): Promise<DocsRevisionState> {
  const currentState = await loadDocsRevisionState(stateFile);
  const currentRecords = new Map(currentState.items.map((record) => [record.path, record]));
  const files = await collectMarkdownFiles(docsRoot);
  const nextItems: DocRevisionRecord[] = [];

  for (const relativePath of files) {
    const content = await readText(path.join(docsRoot, relativePath));
    const hash = sha256(content);
    const { frontmatter, body } = parseFrontmatter(content);
    const title =
      frontmatter.name ??
      body.match(/^#\s+(.+)$/m)?.[1]?.trim() ??
      path.basename(relativePath, path.extname(relativePath));
    const description = frontmatter.description ?? "";
    const existing = currentRecords.get(relativePath);
    const latest = existing?.revisions.at(-1);

    if (existing && latest && latest.hash === hash) {
      nextItems.push({
        path: existing.path,
        slug: docsPathToSlug(relativePath),
        title,
        description,
        latestRevisionId: existing.latestRevisionId,
        updatedAt: existing.updatedAt,
        revisions: existing.revisions
      });
      continue;
    }

    const createdAt = new Date().toISOString();
    const revision: DocRevisionEntry = {
      id: createRevisionId(relativePath, createdAt, hash),
      createdAt,
      hash,
      title,
      description,
      content
    };
    const revisions = [...(existing?.revisions ?? []), revision].slice(-MAX_REVISIONS_PER_DOC);
    nextItems.push({
      path: relativePath,
      slug: docsPathToSlug(relativePath),
      title,
      description,
      latestRevisionId: revision.id,
      updatedAt: revision.createdAt,
      revisions
    });
  }

  const nextState: DocsRevisionState = {
    generatedAt: new Date().toISOString(),
    items: nextItems
  };

  if (JSON.stringify(nextState) !== JSON.stringify(currentState)) {
    await saveDocsRevisionState(nextState, stateFile);
  }

  return nextState;
}

export function listRecentlyChangedDocs(state: DocsRevisionState): DocRevisionRecord[] {
  return state.items
    .filter((record) => record.revisions.length > 1)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getDocRevisionRecord(state: DocsRevisionState, relativePath: string): DocRevisionRecord | null {
  return state.items.find((record) => record.path === relativePath) ?? null;
}
