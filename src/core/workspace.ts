import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";

export interface WorkspacePaths {
  root: string;
  docsRoot: string;
  workspaceRoot: string;
  workspaceMetaFile: string;
  workspaceConfigFile: string;
  projectOverviewFile: string;
  endGoalFile: string;
  planFile: string;
  taskFile: string;
  taskArchiveFile: string;
  activeStateFile: string;
  decisionFile: string;
  versionFile: string;
}

interface WorkspaceMetaLike {
  docsRoot?: string;
}

interface WorkspaceConfigLike {
  docsSite?: {
    sourcePath?: string | null;
  };
}

function readYamlIfExists<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function resolveDocsRoot(root: string): string {
  const workspaceRoot = path.join(root, ".apcc");
  const config = readYamlIfExists<WorkspaceConfigLike>(path.join(workspaceRoot, "config", "workspace.yaml"));
  const meta = readYamlIfExists<WorkspaceMetaLike>(path.join(workspaceRoot, "meta", "workspace.yaml"));
  const configuredSourcePath = config?.docsSite?.sourcePath?.trim();
  const configuredDocsRoot = meta?.docsRoot?.trim();
  const docsRoot = configuredSourcePath || configuredDocsRoot || "docs";

  return path.join(root, docsRoot);
}

export function resolveWorkspaceRoot(start = process.cwd()): string {
  const explicitRoot = process.env.APCC_WORKSPACE_ROOT;
  if (explicitRoot) {
    return path.resolve(explicitRoot);
  }

  let current = path.resolve(start);

  while (true) {
    const hasWorkspace = existsSync(path.join(current, ".apcc"));

    if (hasWorkspace) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        `Unable to locate an APCC workspace from ${start}. Expected a .apcc workspace root.`
      );
    }
    current = parent;
  }
}

export function getWorkspacePaths(start = process.cwd()): WorkspacePaths {
  const root = resolveWorkspaceRoot(start);
  const docsRoot = resolveDocsRoot(root);
  const workspaceRoot = path.join(root, ".apcc");

  return {
    root,
    docsRoot,
    workspaceRoot,
    workspaceMetaFile: path.join(workspaceRoot, "meta", "workspace.yaml"),
    workspaceConfigFile: path.join(workspaceRoot, "config", "workspace.yaml"),
    projectOverviewFile: path.join(workspaceRoot, "project", "overview.yaml"),
    endGoalFile: path.join(workspaceRoot, "goals", "end.yaml"),
    planFile: path.join(workspaceRoot, "plans", "current.yaml"),
    taskFile: path.join(workspaceRoot, "tasks", "current.yaml"),
    taskArchiveFile: path.join(workspaceRoot, "tasks", "archive.yaml"),
    activeStateFile: path.join(workspaceRoot, "state", "active.yaml"),
    decisionFile: path.join(workspaceRoot, "decisions", "records.yaml"),
    versionFile: path.join(workspaceRoot, "versions", "records.yaml")
  };
}

export async function withWorkspaceRoot<T>(root: string, work: () => Promise<T>): Promise<T> {
  const previous = process.env.APCC_WORKSPACE_ROOT;
  process.env.APCC_WORKSPACE_ROOT = path.resolve(root);

  try {
    return await work();
  } finally {
    if (previous === undefined) {
      delete process.env.APCC_WORKSPACE_ROOT;
    } else {
      process.env.APCC_WORKSPACE_ROOT = previous;
    }
  }
}
