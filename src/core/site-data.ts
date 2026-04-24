import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  emptyDocsRevisionState,
  getDocRevisionRecord,
  listRecentlyChangedDocs,
  loadDocsRevisionState
} from "./docs-revisions.js";
import { loadDecisionState } from "./decision.js";
import { loadEndGoal } from "./end-goal.js";
import { readText, readYamlFile } from "./storage.js";
import { loadProjectOverview } from "./project-overview.js";
import { derivePlanStatuses, loadPlans } from "./plans.js";
import { computeProgress } from "./progress.js";
import { loadVersionState } from "./version.js";
import { loadWorkspaceConfig } from "./workspace-config.js";
import { loadTaskArchive, sortArchivedTasks } from "./task-archive.js";
import {
  buildTaskTree,
  describeBlockers,
  findNextActions,
  loadTasks,
  summarizeRecentCompleted
} from "./tasks.js";
import type {
  DerivedPlansState,
  DocsRevisionState,
  TaskArchiveState,
  TaskTreeNode,
  WorkspaceState
} from "./types.js";
import { getStatusSnapshot } from "./status.js";
import { getWorkspacePaths, resolveWorkspaceRoot, withWorkspaceRoot } from "./workspace.js";

interface FrontmatterShape {
  name?: string;
  description?: string;
}

interface DocManifestEntry {
  path: string;
  slug: string[];
  title: string;
  description: string;
  latestRevisionId: string | null;
  updatedAt: string | null;
  revisionCount: number;
}

interface WorkspaceSiteSnapshot {
  root: string | null;
  docsRoot: string;
  workspaceRoot: string | null;
  docsLanguage: "en" | "zh-CN";
  hasWorkspace: boolean;
  activeChange: string | null;
  currentRoundId: string | null;
  stateDigest: string | null;
}

export interface SiteControlPlaneSnapshot {
  generatedAt: string;
  workspace: WorkspaceSiteSnapshot;
  project: Awaited<ReturnType<typeof loadProjectOverview>> | null;
  endGoal: Awaited<ReturnType<typeof loadEndGoal>> | null;
  status: Awaited<ReturnType<typeof getStatusSnapshot>> | null;
  plans: DerivedPlansState | null;
  progress:
    | {
        percent: number;
        countedTasks: number;
        doneTasks: number;
        computedAt: string | null;
      }
    | null;
  tasks:
    | {
        items: Awaited<ReturnType<typeof loadTasks>>["items"];
        tree: TaskTreeNode[];
        recentCompleted: string[];
        nextActions: string[];
        blockers: string[];
        archive: TaskArchiveState;
      }
    | null;
  decisions: Awaited<ReturnType<typeof loadDecisionState>> | null;
  versions: Awaited<ReturnType<typeof loadVersionState>> | null;
  docs: {
    pages: DocManifestEntry[];
    changedPages: DocManifestEntry[];
  };
}

interface BuildSiteSnapshotOptions {
  docsRevisionFile?: string | null;
  docsRevisionState?: DocsRevisionState | null;
}

function parseFrontmatter(content: string): { frontmatter: FrontmatterShape; body: string } {
  const normalized = content.replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: normalized };
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

function hashPayload(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function docsPathToSlug(relativePath: string): string[] {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const fileName = parts.at(-1) ?? "";
  const baseName = fileName.replace(/\.(md|mdx)$/i, "");

  if (baseName === "index") {
    return parts.slice(0, -1);
  }

  return [...parts.slice(0, -1), baseName];
}

export function slugToDocsPath(slug: string[]): string {
  if (slug.length === 0) {
    return "index.md";
  }

  return `${slug.join("/")}.md`;
}

async function resolveDocsRevisionState(options?: BuildSiteSnapshotOptions): Promise<DocsRevisionState> {
  if (options?.docsRevisionState) {
    return options.docsRevisionState;
  }

  if (options?.docsRevisionFile) {
    return loadDocsRevisionState(options.docsRevisionFile);
  }

  return emptyDocsRevisionState();
}

async function buildDocsManifest(docsRoot: string, revisionState: DocsRevisionState): Promise<DocManifestEntry[]> {
  const files = await collectMarkdownFiles(docsRoot);
  const manifest: DocManifestEntry[] = [];

  for (const relativePath of files) {
    const content = await readText(path.join(docsRoot, relativePath));
    const { frontmatter, body } = parseFrontmatter(content);
    const revisionRecord = getDocRevisionRecord(revisionState, relativePath);
    const title =
      frontmatter.name ??
      body.match(/^#\s+(.+)$/m)?.[1]?.trim() ??
      path.basename(relativePath, path.extname(relativePath));

    manifest.push({
      path: relativePath.replace(/\\/g, "/"),
      slug: docsPathToSlug(relativePath),
      title,
      description: frontmatter.description ?? "",
      latestRevisionId: revisionRecord?.latestRevisionId ?? null,
      updatedAt: revisionRecord?.updatedAt ?? null,
      revisionCount: revisionRecord?.revisions.length ?? 0
    });
  }

  return manifest;
}

function tryResolveWorkspaceRootFromDocsRoot(docsRoot: string): string | null {
  try {
    return resolveWorkspaceRoot(path.dirname(docsRoot));
  } catch {
    return null;
  }
}

function createWorkspaceStateDigest(input: {
  active: WorkspaceState;
  project: Awaited<ReturnType<typeof loadProjectOverview>> | null;
  endGoal: Awaited<ReturnType<typeof loadEndGoal>> | null;
  status: Awaited<ReturnType<typeof getStatusSnapshot>> | null;
  plans: DerivedPlansState;
  progress: ReturnType<typeof computeProgress>;
  tasks: Awaited<ReturnType<typeof loadTasks>>;
  archive: TaskArchiveState;
  decisions: Awaited<ReturnType<typeof loadDecisionState>>;
  versions: Awaited<ReturnType<typeof loadVersionState>>;
}): string {
  return hashPayload({
    activeChange: input.active.activeChange,
    currentRoundId: input.active.currentRoundId,
    project: input.project,
    endGoal: input.endGoal,
    status: input.status,
    plans: input.plans,
    progress: input.progress,
    tasks: input.tasks.items,
    archive: input.archive.items,
    decisions: input.decisions.items,
    versions: input.versions.items
  });
}

async function loadWorkspaceSiteSnapshot(
  workspaceRoot: string,
  docsRoot: string,
  revisionState: DocsRevisionState
): Promise<SiteControlPlaneSnapshot> {
  return withWorkspaceRoot(workspaceRoot, async () => {
    const paths = getWorkspacePaths();
    const workspaceConfig = await loadWorkspaceConfig(paths.root).catch(() => null);
    const [project, endGoal, status, plansState, tasksState, archive, decisions, versions] = await Promise.all([
      loadProjectOverview(),
      loadEndGoal(),
      getStatusSnapshot(),
      loadPlans(),
      loadTasks(),
      loadTaskArchive(),
      loadDecisionState(),
      loadVersionState()
    ]);
    const plans = derivePlanStatuses(plansState, tasksState);
    const progress = computeProgress(tasksState.items);

    const active = await readYamlFile<WorkspaceState>(paths.activeStateFile);
    const docsManifest = await buildDocsManifest(docsRoot, revisionState);
    const changedPages = listRecentlyChangedDocs(revisionState)
      .map((record) => docsManifest.find((page) => page.path === record.path))
      .filter((page): page is DocManifestEntry => Boolean(page));

    return {
      generatedAt: new Date().toISOString(),
      workspace: {
        root: paths.root,
        docsRoot,
        workspaceRoot: paths.workspaceRoot,
        docsLanguage: workspaceConfig?.docsLanguage ?? "en",
        hasWorkspace: true,
        activeChange: active.activeChange,
        currentRoundId: active.currentRoundId,
        stateDigest: createWorkspaceStateDigest({
          active,
          project,
          endGoal,
          status,
          plans,
          progress,
          tasks: tasksState,
          archive,
          decisions,
          versions
        })
      },
      project,
      endGoal,
      status,
      plans,
      progress,
      tasks: {
        items: tasksState.items,
        tree: buildTaskTree(tasksState.items),
        recentCompleted: summarizeRecentCompleted(tasksState.items),
        nextActions: findNextActions(tasksState.items),
        blockers: describeBlockers(tasksState.items),
        archive: {
          items: sortArchivedTasks(archive.items)
        }
      },
      decisions,
      versions,
      docs: {
        pages: docsManifest,
        changedPages
      }
    };
  });
}

export async function buildSiteControlPlaneSnapshot(
  docsRoot: string,
  options?: BuildSiteSnapshotOptions
): Promise<SiteControlPlaneSnapshot> {
  const revisionState = await resolveDocsRevisionState(options);
  const workspaceRoot = tryResolveWorkspaceRootFromDocsRoot(docsRoot);
  if (workspaceRoot) {
    return loadWorkspaceSiteSnapshot(workspaceRoot, docsRoot, revisionState);
  }

  const docsManifest = await buildDocsManifest(docsRoot, revisionState);
  const changedPages = listRecentlyChangedDocs(revisionState)
    .map((record) => docsManifest.find((page) => page.path === record.path))
    .filter((page): page is DocManifestEntry => Boolean(page));

  return {
    generatedAt: new Date().toISOString(),
    workspace: {
      root: null,
      docsRoot,
      workspaceRoot: null,
      docsLanguage: "en",
      hasWorkspace: false,
      activeChange: null,
      currentRoundId: null,
      stateDigest: null
    },
    project: null,
    endGoal: null,
    status: null,
    plans: null,
    progress: null,
    tasks: null,
    decisions: null,
    versions: null,
    docs: {
      pages: docsManifest,
      changedPages
    }
  };
}
