import { existsSync } from "node:fs";
import path from "node:path";

import { initWorkspace, WORKSPACE_SCHEMA_VERSION, WORKSPACE_TEMPLATE_VERSION } from "./bootstrap.js";
import { migrateDecisionState } from "./decision.js";
import { loadEndGoal } from "./end-goal.js";
import { getApccPackageVersion } from "./package-runtime.js";
import { assertValidPlanTree } from "./plans.js";
import { loadProjectOverview } from "./project-overview.js";
import { readText, readYamlFile, writeYamlFile } from "./storage.js";
import { loadTasks, assertValidTaskTree } from "./tasks.js";
import type { DecisionState, PlansState, TasksState, VersionState, WorkspaceConfigState, WorkspaceMetaState } from "./types.js";
import {
  BOOTSTRAP_MODES,
  DECISION_CATEGORIES,
  DECISION_STATUSES,
  DOCS_LANGUAGES,
  DOCS_MODES,
  PACKAGE_MANAGERS,
  PROJECT_KINDS,
  SITE_FRAMEWORKS,
  VERSION_RECORD_STATUSES
} from "./types.js";
import { normalizeWorkspaceConfig, normalizeWorkspaceMeta } from "./workspace-config.js";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAllowedString<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function describeAllowedValues(values: readonly string[]): string {
  return values.join(", ");
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
  let rawMeta: Record<string, unknown> | null = null;
  let rawConfig: Record<string, unknown> | null = null;

  try {
    rawMeta = await readYamlFile<Record<string, unknown>>(paths.workspaceMetaFile);
    meta = normalizeWorkspaceMeta(rawMeta);
  } catch {
    rawMeta = null;
    meta = null;
  }

  try {
    rawConfig = await readYamlFile<Record<string, unknown>>(paths.workspaceConfigFile);
    config = normalizeWorkspaceConfig(rawConfig as unknown as WorkspaceConfigState, {
      projectKind: meta?.projectKind ?? "general",
      docsMode: meta?.docsMode ?? "standard",
      docsLanguage: meta?.docsLanguage ?? "en",
      workspaceSchemaVersion: meta?.workspaceSchemaVersion ?? WORKSPACE_SCHEMA_VERSION
    });
  } catch {
    rawConfig = null;
    config = null;
  }

  return { meta, config, rawMeta, rawConfig };
}

export async function validateWorkspace() {
  const paths = getWorkspacePaths();
  const [endGoal, projectOverview, decisions, versions, rawPlans, rawTasks] = await Promise.all([
    loadEndGoal(),
    loadProjectOverview().catch(() => null),
    readYamlFile<DecisionState>(paths.decisionFile).catch(() => ({ items: [] })),
    readYamlFile<VersionState>(paths.versionFile).catch(() => ({ items: [] })),
    readYamlFile<PlansState>(paths.planFile).catch(() => ({ endGoalRef: "", items: [] })),
    readYamlFile<TasksState>(paths.taskFile).catch(() => ({ items: [] }))
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
  const { meta, config, rawMeta, rawConfig } = await loadMetaAndConfig();
  const schemaIssues: string[] = [];
  const repairableIssues: string[] = [];
  const warnings: string[] = [];
  const rawPlanItems = Array.isArray(rawPlans.items) ? rawPlans.items : [];
  const rawTaskItems = Array.isArray(rawTasks.items) ? rawTasks.items : [];
  const rawDecisionItems = Array.isArray(decisions.items) ? decisions.items : [];
  const rawVersionItems = Array.isArray(versions.items) ? versions.items : [];
  const planItems = rawPlanItems.filter((item): item is PlansState["items"][number] => Boolean(item) && typeof item === "object");
  const taskItems = rawTaskItems.filter((item): item is TasksState["items"][number] => Boolean(item) && typeof item === "object");
  const decisionItems = rawDecisionItems.filter((item): item is DecisionState["items"][number] => Boolean(item) && typeof item === "object");
  const versionItems = rawVersionItems.filter((item): item is VersionState["items"][number] => Boolean(item) && typeof item === "object");

  if (!Array.isArray(rawPlans.items)) {
    schemaIssues.push("Plan state must define an items array");
  } else if (planItems.length !== rawPlanItems.length) {
    schemaIssues.push("Plan state items must all be objects");
  } else {
    try {
      assertValidPlanTree(planItems);
    } catch (error) {
      schemaIssues.push(error instanceof Error ? error.message : "Plan tree is invalid");
    }
  }

  if (!Array.isArray(rawTasks.items)) {
    schemaIssues.push("Task state must define an items array");
  } else if (taskItems.length !== rawTaskItems.length) {
    schemaIssues.push("Task state items must all be objects");
  } else {
    try {
      assertValidTaskTree(taskItems);
    } catch (error) {
      schemaIssues.push(error instanceof Error ? error.message : "Task tree is invalid");
    }
  }

  const planIds = new Set(planItems.map((plan) => plan.id));
  for (const task of taskItems) {
    if (!planIds.has(task.planRef)) {
      schemaIssues.push(`Task ${task.id} points to missing plan ${task.planRef}`);
    }
  }

  if (!Array.isArray(decisions.items)) {
    schemaIssues.push("Decision state must define an items array");
  } else if (decisionItems.length !== rawDecisionItems.length) {
    schemaIssues.push("Decision state items must all be objects");
  } else {
    for (const record of decisionItems) {
      if (!isAllowedString(record?.category, DECISION_CATEGORIES)) {
        schemaIssues.push(
          `Decision ${typeof record?.id === "string" ? record.id : "unknown"} uses unsupported category "${String(record?.category)}"; allowed values: ${describeAllowedValues(DECISION_CATEGORIES)}`
        );
      }
      if (!isAllowedString(record?.status, DECISION_STATUSES)) {
        schemaIssues.push(
          `Decision ${typeof record?.id === "string" ? record.id : "unknown"} uses unsupported status "${String(record?.status)}"; allowed values: ${describeAllowedValues(DECISION_STATUSES)}`
        );
      }
    }
  }

  if (!Array.isArray(versions.items)) {
    schemaIssues.push("Version state must define an items array");
  } else if (versionItems.length !== rawVersionItems.length) {
    schemaIssues.push("Version state items must all be objects");
  } else {
    for (const record of versionItems) {
      if (!isAllowedString(record?.status, VERSION_RECORD_STATUSES)) {
        schemaIssues.push(
          `Version ${typeof record?.id === "string" ? record.id : "unknown"} uses unsupported status "${String(record?.status)}"; allowed values: ${describeAllowedValues(VERSION_RECORD_STATUSES)}`
        );
      }
    }
  }

  if (!meta) {
    schemaIssues.push("Missing .apcc/meta/workspace.yaml");
    repairableIssues.push("Backfill workspace metadata");
  } else {
    const rawMetaWorkspaceSchemaVersion = rawMeta?.workspaceSchemaVersion;
    const rawMetaLegacySchemaVersion = rawMeta?.schemaVersion;
    const rawMetaBootstrapMode = rawMeta?.bootstrapMode;
    const rawMetaDocsLanguage = rawMeta?.docsLanguage;
    const rawMetaProjectKind = rawMeta?.projectKind;
    const rawMetaDocsMode = rawMeta?.docsMode;
    const rawMetaTemplateVersion = rawMeta?.templateVersion;
    const rawMetaApccVersion = rawMeta?.apccVersion;

    if (rawMetaWorkspaceSchemaVersion === undefined) {
      if (typeof rawMetaLegacySchemaVersion === "number") {
        schemaIssues.push("Workspace metadata still uses legacy schemaVersion; migrate to workspaceSchemaVersion");
      } else {
        schemaIssues.push("Workspace metadata is missing workspaceSchemaVersion");
      }
      repairableIssues.push("Upgrade workspace metadata schema");
    }
    if ((meta.workspaceSchemaVersion ?? 0) < WORKSPACE_SCHEMA_VERSION) {
      schemaIssues.push(
        `Workspace metadata workspaceSchemaVersion ${meta.workspaceSchemaVersion ?? 0} is behind the current schema ${WORKSPACE_SCHEMA_VERSION}`
      );
      repairableIssues.push("Upgrade workspace metadata schema");
    }
    if (typeof rawMetaApccVersion !== "string" || rawMetaApccVersion.trim().length === 0) {
      schemaIssues.push("Workspace metadata is missing apccVersion");
      repairableIssues.push("Backfill workspace apccVersion provenance");
    }
    if (rawMetaBootstrapMode === undefined) {
      schemaIssues.push("Workspace metadata is missing bootstrapMode");
      repairableIssues.push("Backfill workspace bootstrapMode");
    } else if (!isAllowedString(rawMetaBootstrapMode, BOOTSTRAP_MODES)) {
      schemaIssues.push(
        `Workspace metadata uses unsupported bootstrapMode "${String(rawMetaBootstrapMode)}"; allowed values: ${describeAllowedValues(BOOTSTRAP_MODES)}`
      );
    }
    if (rawMetaDocsLanguage === undefined) {
      schemaIssues.push("Workspace metadata is missing docsLanguage");
      repairableIssues.push("Backfill workspace docsLanguage");
    } else if (!isAllowedString(rawMetaDocsLanguage, DOCS_LANGUAGES)) {
      schemaIssues.push(
        `Workspace metadata uses unsupported docsLanguage "${String(rawMetaDocsLanguage)}"; allowed values: ${describeAllowedValues(DOCS_LANGUAGES)}`
      );
    }
    if (rawMetaProjectKind === undefined) {
      schemaIssues.push("Workspace metadata is missing projectKind");
      repairableIssues.push("Backfill workspace projectKind");
    } else if (!isAllowedString(rawMetaProjectKind, PROJECT_KINDS)) {
      schemaIssues.push(
        `Workspace metadata uses unsupported projectKind "${String(rawMetaProjectKind)}"; allowed values: ${describeAllowedValues(PROJECT_KINDS)}`
      );
    }
    if (rawMetaDocsMode === undefined) {
      schemaIssues.push("Workspace metadata is missing docsMode");
      repairableIssues.push("Backfill workspace docsMode");
    } else if (!isAllowedString(rawMetaDocsMode, DOCS_MODES)) {
      schemaIssues.push(
        `Workspace metadata uses unsupported docsMode "${String(rawMetaDocsMode)}"; allowed values: ${describeAllowedValues(DOCS_MODES)}`
      );
    }
    if (typeof rawMetaTemplateVersion !== "string" || rawMetaTemplateVersion !== WORKSPACE_TEMPLATE_VERSION) {
      warnings.push(
        `Workspace templateVersion is ${typeof rawMetaTemplateVersion === "string" ? rawMetaTemplateVersion : "missing"}; current templateVersion is ${WORKSPACE_TEMPLATE_VERSION}`
      );
      repairableIssues.push("Refresh managed docs and control-plane templates");
    }
  }

  if (!config) {
    schemaIssues.push("Missing .apcc/config/workspace.yaml");
    repairableIssues.push("Backfill workspace config");
  } else {
    if (rawConfig?.workspaceSchemaVersion === undefined) {
      schemaIssues.push("Workspace config is missing workspaceSchemaVersion");
      repairableIssues.push("Upgrade workspace config schema");
    }
    if ((config.workspaceSchemaVersion ?? 0) < WORKSPACE_SCHEMA_VERSION) {
      schemaIssues.push(
        `Workspace config workspaceSchemaVersion ${config.workspaceSchemaVersion ?? 0} is behind the current schema ${WORKSPACE_SCHEMA_VERSION}`
      );
      repairableIssues.push("Upgrade workspace config schema");
    }
    const rawProjectKind = rawConfig?.projectKind;
    const rawDocsMode = rawConfig?.docsMode;
    const rawDocsLanguage = rawConfig?.docsLanguage;
    const rawSiteFramework = rawConfig?.siteFramework;
    const rawPackageManager = rawConfig?.packageManager;
    const rawDocsSite = rawConfig?.docsSite;

    if (rawProjectKind === undefined) {
      schemaIssues.push("Workspace config is missing projectKind");
      repairableIssues.push("Backfill workspace projectKind");
    } else if (!isAllowedString(rawProjectKind, PROJECT_KINDS)) {
      schemaIssues.push(
        `Workspace config uses unsupported projectKind "${String(rawProjectKind)}"; allowed values: ${describeAllowedValues(PROJECT_KINDS)}`
      );
    }
    if (rawDocsMode === undefined) {
      schemaIssues.push("Workspace config is missing docsMode");
      repairableIssues.push("Backfill workspace docsMode");
    } else if (!isAllowedString(rawDocsMode, DOCS_MODES)) {
      schemaIssues.push(
        `Workspace config uses unsupported docsMode "${String(rawDocsMode)}"; allowed values: ${describeAllowedValues(DOCS_MODES)}`
      );
    }
    if (rawDocsLanguage === undefined) {
      schemaIssues.push("Workspace config is missing docsLanguage");
      repairableIssues.push("Backfill workspace docsLanguage");
    } else if (!isAllowedString(rawDocsLanguage, DOCS_LANGUAGES)) {
      schemaIssues.push(
        `Workspace config uses unsupported docsLanguage "${String(rawDocsLanguage)}"; allowed values: ${describeAllowedValues(DOCS_LANGUAGES)}`
      );
    }
    if (!isRecord(rawDocsSite) || rawDocsSite.sourcePath === undefined) {
      schemaIssues.push("Workspace config is missing docsSite configuration");
      repairableIssues.push("Backfill workspace docsSite config");
    } else {
      if (!isAllowedString(rawSiteFramework, SITE_FRAMEWORKS)) {
        schemaIssues.push(
          `Workspace config uses unsupported siteFramework "${String(rawSiteFramework)}"; allowed values: ${describeAllowedValues(SITE_FRAMEWORKS)}`
        );
      }
      if (!isAllowedString(rawPackageManager, PACKAGE_MANAGERS)) {
        schemaIssues.push(
          `Workspace config uses unsupported packageManager "${String(rawPackageManager)}"; allowed values: ${describeAllowedValues(PACKAGE_MANAGERS)}`
        );
      }
      if (typeof rawDocsSite.enabled !== "boolean") {
        schemaIssues.push("Workspace config docsSite.enabled must be true or false");
      }
      if (typeof rawDocsSite.sourcePath !== "string" || rawDocsSite.sourcePath.trim().length === 0) {
        schemaIssues.push("Workspace config docsSite.sourcePath must be a non-empty string");
      }
      const preferredPort = rawDocsSite.preferredPort;
      if (
        preferredPort !== null &&
        preferredPort !== undefined &&
        (typeof preferredPort !== "number" || !Number.isInteger(preferredPort) || preferredPort <= 0)
      ) {
        schemaIssues.push("Workspace config docsSite.preferredPort must be a positive integer or null");
      }
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
    taskCount: taskItems.length
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
    workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION,
    apccVersion: getApccPackageVersion(),
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
