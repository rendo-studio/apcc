import { existsSync } from "node:fs";
import path from "node:path";

import { initWorkspace, WORKSPACE_SCHEMA_VERSION, WORKSPACE_TEMPLATE_VERSION } from "./bootstrap.js";
import { migrateDecisionState } from "./decision.js";
import { loadEndGoal } from "./end-goal.js";
import { loadProjectOverview } from "./project-overview.js";
import { readText, readYamlFile, writeYamlFile } from "./storage.js";
import { loadTasks, assertValidTaskTree } from "./tasks.js";
import type { WorkspaceConfigState, WorkspaceMetaState } from "./types.js";
import { normalizeWorkspaceConfig } from "./workspace-config.js";
import { getWorkspacePaths } from "./workspace.js";

async function hasMinimalMetadata(filePath: string): Promise<boolean> {
  const content = await readText(filePath);
  const firstLines = content.split(/\r?\n/).slice(0, 6);

  return (
    firstLines.includes("---") &&
    firstLines.some((line) => line.startsWith("name:")) &&
    firstLines.some((line) => line.startsWith("description:"))
  );
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function resolveDocPath(docsRoot: string, docPath: string | null | undefined): string | null {
  if (!docPath?.trim()) {
    return null;
  }

  return path.join(docsRoot, docPath);
}

async function loadMetaAndConfig() {
  const paths = getWorkspacePaths();
  let meta: WorkspaceMetaState | null = null;
  let config: WorkspaceConfigState | null = null;

  try {
    meta = await readYamlFile<WorkspaceMetaState>(paths.workspaceMetaFile);
  } catch {
    meta = null;
  }

  try {
    const rawConfig = await readYamlFile<WorkspaceConfigState>(paths.workspaceConfigFile);
    config = normalizeWorkspaceConfig(rawConfig, {
      projectKind: meta?.projectKind ?? "general",
      docsMode: meta?.docsMode ?? "standard",
      docsLanguage: meta?.docsLanguage ?? "en",
      workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION
    });
  } catch {
    config = null;
  }

  return { meta, config };
}

export async function validateWorkspace() {
  const paths = getWorkspacePaths();
  const [endGoal, projectOverview, decisions, versions] = await Promise.all([
    loadEndGoal(),
    loadProjectOverview().catch(() => null),
    readYamlFile<{ items?: Array<{ docPath?: string | null }> }>(paths.decisionFile).catch(() => ({ items: [] })),
    readYamlFile<{ items?: Array<{ docPath?: string | null }> }>(paths.versionFile).catch(() => ({ items: [] }))
  ]);
  const requiredFiles = [
    paths.projectOverviewFile,
    paths.endGoalFile,
    paths.planFile,
    paths.taskFile,
    paths.taskArchiveFile,
    paths.decisionFile,
    paths.versionFile,
    path.join(paths.root, "AGENTS.md"),
    path.join(paths.root, ".agents", "skills", "apcc-workflow", "SKILL.md")
  ];
  const referencedDocPaths = [
    resolveDocPath(paths.docsRoot, projectOverview?.docPath),
    resolveDocPath(paths.docsRoot, endGoal.docPath),
    ...(decisions.items ?? []).map((item) => resolveDocPath(paths.docsRoot, item.docPath)),
    ...(versions.items ?? []).map((item) => resolveDocPath(paths.docsRoot, item.docPath))
  ].filter((filePath): filePath is string => Boolean(filePath));

  requiredFiles.push(...referencedDocPaths);

  const missingFiles = requiredFiles.filter((filePath) => !existsSync(filePath));
  const metadataChecks = {
    overview: projectOverview?.docPath
      ? await hasMinimalMetadata(path.join(paths.docsRoot, projectOverview.docPath)).catch(() => false)
      : true,
    goal: endGoal.docPath ? await hasMinimalMetadata(path.join(paths.docsRoot, endGoal.docPath)).catch(() => false) : true
  };
  const tasks = await loadTasks();
  assertValidTaskTree(tasks.items);

  const { meta, config } = await loadMetaAndConfig();
  const schemaIssues: string[] = [];
  const repairableIssues: string[] = [];
  const warnings: string[] = [];

  if (!meta) {
    schemaIssues.push("Missing .apcc/meta/workspace.yaml");
    repairableIssues.push("Backfill workspace metadata");
  } else {
    if ((meta.schemaVersion ?? 0) < WORKSPACE_SCHEMA_VERSION) {
      schemaIssues.push(
        `Workspace schemaVersion ${meta.schemaVersion ?? 0} is behind the current schema ${WORKSPACE_SCHEMA_VERSION}`
      );
      repairableIssues.push("Upgrade workspace metadata schema");
    }
    if (!meta.bootstrapMode) {
      schemaIssues.push("Workspace metadata is missing bootstrapMode");
      repairableIssues.push("Backfill workspace bootstrapMode");
    }
    if (!meta.docsLanguage) {
      schemaIssues.push("Workspace metadata is missing docsLanguage");
      repairableIssues.push("Backfill workspace docsLanguage");
    }
    if (!meta.templateVersion || meta.templateVersion !== WORKSPACE_TEMPLATE_VERSION) {
      warnings.push(
        `Workspace templateVersion is ${meta.templateVersion ?? "missing"}; current templateVersion is ${WORKSPACE_TEMPLATE_VERSION}`
      );
      repairableIssues.push("Refresh managed docs and control-plane templates");
    }
  }

  if (!config) {
    schemaIssues.push("Missing .apcc/config/workspace.yaml");
    repairableIssues.push("Backfill workspace config");
  } else {
    if ((config.workspaceSchemaVersion ?? 0) < WORKSPACE_SCHEMA_VERSION) {
      schemaIssues.push(
        `Workspace config schemaVersion ${config.workspaceSchemaVersion ?? 0} is behind the current schema ${WORKSPACE_SCHEMA_VERSION}`
      );
      repairableIssues.push("Upgrade workspace config schema");
    }
    if (!config.projectKind) {
      schemaIssues.push("Workspace config is missing projectKind");
      repairableIssues.push("Backfill workspace projectKind");
    }
    if (!config.docsMode) {
      schemaIssues.push("Workspace config is missing docsMode");
      repairableIssues.push("Backfill workspace docsMode");
    }
    if (!config.docsLanguage) {
      schemaIssues.push("Workspace config is missing docsLanguage");
      repairableIssues.push("Backfill workspace docsLanguage");
    }
    if (!config.docsSite || config.docsSite.sourcePath === null) {
      schemaIssues.push("Workspace config is missing docsSite configuration");
      repairableIssues.push("Backfill workspace docsSite config");
    }
  }

  if (missingFiles.length > 0) {
    repairableIssues.push("Backfill missing managed files and docs anchors");
  }

  const repairNeeded = missingFiles.length > 0 || schemaIssues.length > 0;

  return {
    ok:
      missingFiles.length === 0 &&
      metadataChecks.overview &&
      metadataChecks.goal &&
      schemaIssues.length === 0,
    missingFiles,
    metadataChecks,
    schemaIssues,
    warnings,
    repairNeeded,
    repairableIssues: unique(repairableIssues),
    endGoalName: endGoal.name,
    taskCount: tasks.items.length
  };
}

export async function repairWorkspace() {
  const paths = getWorkspacePaths();
  const endGoal = await loadEndGoal();
  const { meta, config } = await loadMetaAndConfig();

  const result = await initWorkspace({
    targetPath: paths.root,
    projectName: path.basename(paths.root),
    endGoalName: endGoal.name,
    endGoalSummary: endGoal.summary,
    projectKind: config?.projectKind ?? meta?.projectKind ?? "general",
    docsMode: config?.docsMode ?? meta?.docsMode ?? "standard",
    docsLanguage: config?.docsLanguage ?? meta?.docsLanguage ?? "en",
    force: false,
    preserveExistingDocs: true
  });
  await migrateDecisionState();

  const nextMeta: WorkspaceMetaState = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceName: meta?.workspaceName ?? path.basename(paths.root),
    docsRoot: meta?.docsRoot ?? "docs",
    workspaceRoot: meta?.workspaceRoot ?? ".apcc",
    bootstrapMode: "init",
    templateVersion: WORKSPACE_TEMPLATE_VERSION,
    projectKind: config?.projectKind ?? meta?.projectKind ?? "general",
    docsMode: config?.docsMode ?? meta?.docsMode ?? "standard",
    docsLanguage: config?.docsLanguage ?? meta?.docsLanguage ?? "en",
    createdAt: meta?.createdAt ?? new Date().toISOString(),
    lastUpgradedAt: new Date().toISOString()
  };
  const nextConfig: WorkspaceConfigState = {
    ...normalizeWorkspaceConfig(config, {
      projectKind: config?.projectKind ?? meta?.projectKind ?? "general",
      docsMode: config?.docsMode ?? meta?.docsMode ?? "standard",
      docsLanguage: config?.docsLanguage ?? meta?.docsLanguage ?? "en",
      workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION
    }),
    workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION
  };

  await writeYamlFile(paths.workspaceMetaFile, nextMeta);
  await writeYamlFile(paths.workspaceConfigFile, nextConfig);

  return {
    repaired: true,
    workspace: result,
    validation: await validateWorkspace()
  };
}
