import fs from "node:fs/promises";
import path from "node:path";
import "server-only";

export interface RuntimeDocPage {
  path: string;
  slug: string[];
  title: string;
  description: string;
  latestRevisionId: string | null;
  updatedAt: string | null;
  revisionCount: number;
}

export interface RuntimeDocsViewerHeading {
  depth: number;
  text: string;
  id: string;
}

export interface RuntimeDocsViewerPage {
  path: string;
  slug: string[];
  title: string;
  description: string;
  body: string;
  headings: RuntimeDocsViewerHeading[];
}

export interface RuntimeDocsViewerTreePageNode {
  type: "page";
  title: string;
  path: string;
  slug: string[];
}

export interface RuntimeDocsViewerTreeFolderNode {
  type: "folder";
  title: string;
  children: RuntimeDocsViewerTreeNode[];
}

export type RuntimeDocsViewerTreeNode =
  | RuntimeDocsViewerTreePageNode
  | RuntimeDocsViewerTreeFolderNode;

export interface RuntimeDocsViewerData {
  generatedAt: string;
  navigation: RuntimeDocsViewerTreeNode[];
  pages: RuntimeDocsViewerPage[];
}

export interface RuntimeDocRevisionEntry {
  id: string;
  createdAt: string;
  hash: string;
  title: string;
  description: string;
  content: string;
}

export interface RuntimeDocRevisionRecord {
  path: string;
  slug: string[];
  title: string;
  description: string;
  latestRevisionId: string;
  updatedAt: string;
  revisions: RuntimeDocRevisionEntry[];
}

export interface RuntimeDocsRevisionState {
  generatedAt: string | null;
  items: RuntimeDocRevisionRecord[];
}

export interface RuntimeTaskNode {
  id: string;
  name: string;
  summary: string | null;
  status: "pending" | "in_progress" | "done" | "blocked";
  planRef: string;
  parentTaskId: string | null;
  countedForProgress: boolean;
  children: RuntimeTaskNode[];
}

export interface RuntimeArchiveEntry {
  id: string;
  name: string;
  planRef: string;
  parentTaskId: string | null;
  status: "pending" | "in_progress" | "done" | "blocked";
  closedAt: string;
  closedByChange: string | null;
  summary: string | null;
}

export interface ControlPlaneSnapshot {
  generatedAt: string;
  workspace: {
    root: string | null;
    docsRoot: string;
    workspaceRoot: string | null;
    docsLanguage: "en" | "zh-CN";
    hasWorkspace: boolean;
    activeChange: string | null;
    currentRoundId: string | null;
    stateDigest: string | null;
  };
  project:
    | {
        name: string;
        summary: string;
        docPath: string;
      }
    | null;
  endGoal:
    | {
        goalId: string;
        name: string;
        summary: string;
        docPath: string;
        successCriteria: string[];
        nonGoals: string[];
      }
    | null;
  status:
    | {
        phase: string;
        progress: {
          percent: number;
          countedTasks: number;
          doneTasks: number;
          computedAt: string | null;
        };
        topLevelPlans: string[];
        nextActions: string[];
        blockers: string[];
      }
    | null;
  plans:
    | {
        endGoalRef: string;
        items: Array<{
          id: string;
          name: string;
          summary: string | null;
          status: "pending" | "in_progress" | "done" | "blocked";
          parentPlanId: string | null;
        }>;
      }
    | null;
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
        items: Array<{
          id: string;
          name: string;
          summary: string | null;
          status: "pending" | "in_progress" | "done" | "blocked";
          planRef: string;
          parentTaskId: string | null;
          countedForProgress: boolean;
        }>;
        tree: RuntimeTaskNode[];
        recentCompleted: string[];
        nextActions: string[];
        blockers: string[];
        archive: {
          items: RuntimeArchiveEntry[];
        };
      }
    | null;
  decisions:
    | {
        items: Array<{
          id: string;
          name: string;
          description: string;
          docPath: string | null;
          category: string;
          status: "pending" | "approved" | "rejected";
          createdAt: string;
          decidedAt: string | null;
        }>;
      }
    | null;
  versions:
    | {
        items: Array<{
          id: string;
          version: string;
          title: string;
          summary: string;
          docPath: string | null;
          status: "draft" | "recorded";
          decisionRefs: string[];
          highlights: string[];
          breakingChanges: string[];
          migrationNotes: string[];
          validationSummary: string | null;
          createdAt: string;
          recordedAt: string | null;
        }>;
      }
    | null;
  docs: {
    pages: RuntimeDocPage[];
    changedPages: RuntimeDocPage[];
  };
}

interface RuntimeVersion {
  updatedAt: string;
}

export interface RuntimeMetadata {
  siteId: string;
  sourceDocsRoot: string;
  sourceWorkspaceRoot: string | null;
  runtimeRoot: string;
  templateRoot: string;
  mode: "staged" | "live" | "build";
  port: number | null;
  url: string | null;
  updatedAt: string;
}

function resolveRuntimeDataRoot(): string {
  const override = process.env.APCC_RUNTIME_DATA_ROOT;
  if (override && override.length > 0) {
    return path.resolve(override);
  }

  return path.join(process.cwd(), "runtime-data");
}

const runtimeDataRoot = resolveRuntimeDataRoot();

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function loadControlPlaneSnapshot(): Promise<ControlPlaneSnapshot> {
  return readJsonFile<ControlPlaneSnapshot>(path.join(runtimeDataRoot, "control-plane.json"), {
    generatedAt: new Date().toISOString(),
    workspace: {
      root: null,
      docsRoot: "",
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
      pages: [],
      changedPages: []
    }
  });
}

export async function loadDocsRevisionState(): Promise<RuntimeDocsRevisionState> {
  return readJsonFile<RuntimeDocsRevisionState>(path.join(runtimeDataRoot, "docs-revisions.json"), {
    generatedAt: null,
    items: []
  });
}

export async function loadDocsViewerData(): Promise<RuntimeDocsViewerData> {
  return readJsonFile<RuntimeDocsViewerData>(path.join(runtimeDataRoot, "docs-viewer.json"), {
    generatedAt: new Date().toISOString(),
    navigation: [],
    pages: []
  });
}

export async function loadRuntimeVersion(): Promise<RuntimeVersion> {
  return readJsonFile<RuntimeVersion>(path.join(runtimeDataRoot, "version.json"), {
    updatedAt: new Date().toISOString()
  });
}

export async function loadRuntimeMetadata(): Promise<RuntimeMetadata> {
  return readJsonFile<RuntimeMetadata>(path.join(runtimeDataRoot, "runtime.json"), {
    siteId: "",
    sourceDocsRoot: "",
    sourceWorkspaceRoot: null,
    runtimeRoot: process.cwd(),
    templateRoot: "",
    mode: "staged",
    port: null,
    url: null,
    updatedAt: new Date().toISOString()
  });
}

export function slugKey(slug: string[] | undefined): string {
  return (slug ?? []).join("/");
}
