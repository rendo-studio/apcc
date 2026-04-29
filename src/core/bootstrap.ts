import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { parse, stringify } from "yaml";

import { inspectGuidanceArtifacts, syncGuidanceArtifacts } from "./guidance.js";
import { getApccPackageVersion } from "./package-runtime.js";
import { writeText, writeYamlFile } from "./storage.js";
import { loadWorkspaceConfig, normalizeDocsLanguage, normalizeWorkspaceConfig } from "./workspace-config.js";
import type {
  DocsLanguage,
  GoalState,
  ProjectOverviewState,
  PlansState,
  DecisionState,
  VersionState,
  TaskArchiveState,
  TasksState,
  WorkspaceConfigState,
  WorkspaceMetaState,
  WorkspaceState
} from "./types.js";
import { withWorkspaceRoot } from "./workspace.js";

type ProjectKind = "general" | "frontend" | "library" | "service";
type DocsMode = "minimal" | "standard";

export const WORKSPACE_SCHEMA_VERSION = 10;
export const WORKSPACE_TEMPLATE_VERSION = "2026-04-29.workspace-schema-provenance-1";

interface BootstrapInput {
  targetPath?: string;
  projectName?: string;
  projectSummary?: string;
  endGoalName?: string;
  endGoalSummary?: string;
  projectKind?: ProjectKind;
  docsMode?: DocsMode;
  docsLanguage?: DocsLanguage;
  force?: boolean;
  preserveExistingDocs?: boolean;
}

interface BootstrapResult {
  mode: "init";
  root: string;
  docsRoot: string;
  workspaceRoot: string;
  activeChangeId: string;
  createdFiles: string[];
  updatedFiles: string[];
  skippedFiles: string[];
}

interface ManagedDocFile {
  relativePath: string;
  name: string;
  description: string;
  title: string;
  bodyPrefix?: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
}

interface ManagedTextFile {
  relativePath: string;
  content: string;
}

interface ManagedWorkspaceFile {
  relativePath: string;
  value: unknown;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function isoNow(): string {
  return new Date().toISOString();
}

async function ensureDirectory(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function listDirEntries(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

interface DocsLanguageProfile {
  docsLanguage: DocsLanguage;
  overviewDocPath: string;
  goalDocPath: string;
  overviewDocName: string;
  overviewDocDescription: string;
  overviewDocTitle: string;
  overviewSummaryHeading: string;
  overviewNarrativeHeading: string;
  goalDocName: string;
  goalDocDescription: string;
  goalDocTitle: string;
  goalHeading: string;
  goalBackgroundHeading: string;
  goalSuccessHeading: string;
  goalNonGoalsHeading: string;
  goalProgressHeading: string;
}

function getDocsLanguageProfile(docsLanguage: DocsLanguage): DocsLanguageProfile {
  if (docsLanguage === "zh-CN") {
    return {
      docsLanguage,
      overviewDocPath: "shared/概览.md",
      goalDocPath: "shared/目标.md",
      overviewDocName: "项目概览",
      overviewDocDescription: "共享项目概览锚点。",
      overviewDocTitle: "项目概览",
      overviewSummaryHeading: "项目摘要",
      overviewNarrativeHeading: "项目介绍、最终目标与当前计划",
      goalDocName: "项目目标",
      goalDocDescription: "共享项目目标锚点。",
      goalDocTitle: "项目目标",
      goalHeading: "最终目标",
      goalBackgroundHeading: "背景与理由",
      goalSuccessHeading: "完成标准",
      goalNonGoalsHeading: "明确不做什么",
      goalProgressHeading: "当前进度摘要"
    };
  }

  return {
    docsLanguage,
    overviewDocPath: "shared/overview.md",
    goalDocPath: "shared/goal.md",
    overviewDocName: "Project Overview",
    overviewDocDescription: "Shared project overview anchor.",
    overviewDocTitle: "Project Overview",
    overviewSummaryHeading: "Project Summary",
    overviewNarrativeHeading: "Project Definition, End Goal, and Current Plan",
    goalDocName: "Project Goal",
    goalDocDescription: "Shared project goal anchor.",
    goalDocTitle: "Project Goal",
    goalHeading: "End Goal",
    goalBackgroundHeading: "Background And Rationale",
    goalSuccessHeading: "Success Criteria",
    goalNonGoalsHeading: "Non-goals",
    goalProgressHeading: "Current Progress Summary"
  };
}

async function resolveInitStrategy(root: string): Promise<"new" | "existing"> {
  const entries = await listDirEntries(root);

  if (entries.length === 0) {
    return "new";
  }

  const isExistingWorkspace = entries.includes(".apcc") && entries.includes("docs");
  if (isExistingWorkspace) {
    return "existing";
  }

  return "existing";
}

function hasExistingWorkspaceConfig(root: string): boolean {
  return (
    existsSync(path.join(root, ".apcc", "config", "workspace.yaml")) ||
    existsSync(path.join(root, ".apcc", "meta", "workspace.yaml"))
  );
}

function buildEndGoal(
  projectName: string,
  input: Pick<BootstrapInput, "endGoalName" | "endGoalSummary">,
  docsLanguage: DocsLanguage
): GoalState {
  const hasExplicitGoal = Boolean(input.endGoalName?.trim() && input.endGoalSummary?.trim());
  const docsProfile = getDocsLanguageProfile(docsLanguage);
  const name = input.endGoalName?.trim() || (docsLanguage === "zh-CN" ? "未明确的最终目标" : "Unspecified end goal");
  const summary =
    input.endGoalSummary?.trim() ||
    (docsLanguage === "zh-CN"
      ? `${projectName} 还没有定义长期稳定的项目目标。请在目标清晰后使用 \`apcc goal set\` 补齐。`
      : `${projectName} has not defined a long-lived end goal yet. Use \`apcc goal set\` when the target outcome becomes clear.`);

  return {
    goalId: `end-goal-${slugify(name) || "project"}`,
    name,
    summary,
    docPath: docsProfile.goalDocPath,
    successCriteria: hasExplicitGoal
      ? [
          docsLanguage === "zh-CN"
            ? `${projectName} 以结构化项目状态公开稳定的项目概览、最终目标、计划、任务、决策与版本记录`
            : `${projectName} exposes a stable project overview, end goal, plans, tasks, decisions, and version records as structured project state`,
          docsLanguage === "zh-CN"
            ? `${projectName} 让共享文档、结构化工作区状态与本地文档站视图对人类开发者和开发代理保持一致`
            : `${projectName} keeps shared docs, structured workspace state, and local docs-site views aligned for human developers and development agents`,
          docsLanguage === "zh-CN"
            ? `${projectName} 支持从项目理解、规划、实现、验证到版本记录的可重复工作循环`
            : `${projectName} supports a repeatable loop from project understanding to planning, implementation, validation, and version recording`
        ]
      : [
          docsLanguage === "zh-CN"
            ? `为 ${projectName} 定义长期稳定的最终目标。`
            : `Define the long-lived end goal for ${projectName}.`,
          docsLanguage === "zh-CN"
            ? `在目标清晰后，将当前工作区拆解为明确的计划树与任务树。`
            : `Turn the current workspace into an explicit plan and task tree once the destination is clear.`,
          docsLanguage === "zh-CN"
            ? `${projectName} 在项目形态仍在探索时，也要让共享文档与结构化工作区状态保持一致。`
            : `${projectName} keeps shared docs and structured workspace state aligned while the project shape is still being discovered.`
        ],
    nonGoals:
      docsLanguage === "zh-CN"
        ? ["公开托管文档平台", "完整 SaaS 控制面", "多代理编排平台", "云端同步"]
        : ["public hosted docs platform", "full SaaS control plane", "multi-agent orchestration", "cloud sync"]
  };
}

function buildProjectOverview(
  projectName: string,
  projectSummary: string | undefined,
  docsLanguage: DocsLanguage
): ProjectOverviewState {
  const docsProfile = getDocsLanguageProfile(docsLanguage);
  return {
    name: projectName,
    summary:
      projectSummary?.trim() ||
      (docsLanguage === "zh-CN"
        ? `${projectName} 还没有定义项目概览。请在项目定位、范围和叙事足够清晰后使用 \`apcc project set\` 明确锚定。`
        : `${projectName} has not defined a project overview yet. Use \`apcc project set\` when the project identity, scope, and narrative are clear enough to anchor explicitly.`),
    docPath: docsProfile.overviewDocPath
  };
}

function buildPlans(endGoal: GoalState, docsLanguage: DocsLanguage): PlansState {
  return {
    endGoalRef: endGoal.goalId,
    items: [
      {
        id: "establish-shared-project-context-1",
        name: docsLanguage === "zh-CN" ? "建立共享项目上下文" : "Establish shared project context",
        summary:
          docsLanguage === "zh-CN"
            ? "在进入正式执行前，先锚定项目概览、最终目标与 authored docs。"
            : "Anchor the project overview, end goal, and authored docs before execution begins.",
        parentPlanId: null
      },
      {
        id: "translate-end-goal-into-plan-streams-1",
        name: docsLanguage === "zh-CN" ? "将最终目标拆解为计划流" : "Translate the end goal into plan streams",
        summary:
          docsLanguage === "zh-CN"
            ? "把长期目标拆解为明确的执行流与任务结构。"
            : "Break the long-lived end goal into explicit execution streams and task structure.",
        parentPlanId: null
      },
      {
        id: "deliver-and-validate-first-slice-1",
        name: docsLanguage === "zh-CN" ? "交付并验证首个切片" : "Deliver and validate first slice",
        summary:
          docsLanguage === "zh-CN"
            ? "交付首个具体切片，并验证框架状态保持一致。"
            : "Ship the first concrete slice and verify the framework state stays coherent.",
        parentPlanId: null
      }
    ]
  };
}

function buildTasks(docsLanguage: DocsLanguage): TasksState {
  return {
    items: [
      {
        id: "task-project-context",
        name: docsLanguage === "zh-CN" ? "建立共享项目上下文" : "Establish shared project context",
        summary:
          docsLanguage === "zh-CN"
            ? "为工作区建立初始共享现实锚点。"
            : "Create the initial shared-reality anchor for the workspace.",
        status: "pending",
        planRef: "establish-shared-project-context-1",
        parentTaskId: null,
        countedForProgress: false
      },
      {
        id: "task-project-context-1",
        name: docsLanguage === "zh-CN" ? "确认项目范围与约束" : "Confirm project scope and constraints",
        summary:
          docsLanguage === "zh-CN"
            ? "记录当前轮次的直接范围、边界与明确不做什么。"
            : "Capture the immediate scope, boundaries, and non-goals for the current round.",
        status: "pending",
        planRef: "establish-shared-project-context-1",
        parentTaskId: "task-project-context",
        countedForProgress: true
      },
      {
        id: "task-breakdown",
        name: docsLanguage === "zh-CN" ? "将最终目标拆解为计划流" : "Translate the end goal into plan streams",
        summary:
          docsLanguage === "zh-CN"
            ? "把长期目标拆解为可执行的计划与任务。"
            : "Translate the long-lived end goal into executable plans and tasks.",
        status: "pending",
        planRef: "translate-end-goal-into-plan-streams-1",
        parentTaskId: null,
        countedForProgress: false
      },
      {
        id: "task-breakdown-1",
        name: docsLanguage === "zh-CN" ? "细化计划树与当前变更" : "Refine the plan tree and active change",
        summary:
          docsLanguage === "zh-CN"
            ? "细化当前计划树，让下一个实现切片明确可执行。"
            : "Refine the active plan tree so the next implementation slice is explicit.",
        status: "pending",
        planRef: "translate-end-goal-into-plan-streams-1",
        parentTaskId: "task-breakdown",
        countedForProgress: true
      },
      {
        id: "task-delivery",
        name: docsLanguage === "zh-CN" ? "交付并验证首个切片" : "Deliver and validate first slice",
        summary:
          docsLanguage === "zh-CN"
            ? "实现首个有意义的切片，并验证围绕它的工作区状态。"
            : "Implement the first meaningful slice and validate the workspace around it.",
        status: "pending",
        planRef: "deliver-and-validate-first-slice-1",
        parentTaskId: null,
        countedForProgress: false
      },
      {
        id: "task-delivery-1",
        name: docsLanguage === "zh-CN" ? "实现并验证首个具体切片" : "Implement and validate the first concrete slice",
        summary:
          docsLanguage === "zh-CN"
            ? "交付首个具体切片，并验证期望中的框架行为。"
            : "Deliver the first slice and verify the expected framework behavior.",
        status: "pending",
        planRef: "deliver-and-validate-first-slice-1",
        parentTaskId: "task-delivery",
        countedForProgress: true
      }
    ]
  };
}

function buildActiveState(activeChangeId: string): WorkspaceState {
  return {
    activeChange: activeChangeId,
    currentRoundId: `round-${isoNow().slice(0, 10)}-01`
  };
}

function buildWorkspaceFiles(
  mode: "init",
  activeChangeId: string,
  endGoal: GoalState,
  projectName: string,
  projectSummary: string | undefined,
  projectKind: ProjectKind,
  docsMode: DocsMode,
  docsLanguage: DocsLanguage
): ManagedWorkspaceFile[] {
  const createdAt = isoNow();
  const projectOverview = buildProjectOverview(projectName, projectSummary, docsLanguage);
  const initialDecisionState: DecisionState = {
    items: []
  };
  const initialVersionState: VersionState = {
    items: []
  };
  const initialTaskArchiveState: TaskArchiveState = {
    items: []
  };
  const meta: WorkspaceMetaState = {
    workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION,
    apccVersion: getApccPackageVersion(),
    workspaceName: slugify(projectName) || "apcc-project",
    docsRoot: "docs",
    workspaceRoot: ".apcc",
    bootstrapMode: mode,
    templateVersion: WORKSPACE_TEMPLATE_VERSION,
    projectKind,
    docsMode,
    docsLanguage,
    createdAt,
    lastUpgradedAt: null
  };
  const config: WorkspaceConfigState = {
    ...normalizeWorkspaceConfig(null, {
      projectKind,
      docsMode,
      docsLanguage,
      workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION
    }),
    workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION
  };
  return [
    {
      relativePath: ".apcc/meta/workspace.yaml",
      value: meta
    },
    {
      relativePath: ".apcc/config/workspace.yaml",
      value: config
    },
    {
      relativePath: ".apcc/state/active.yaml",
      value: buildActiveState(activeChangeId)
    },
    {
      relativePath: ".apcc/goals/end.yaml",
      value: endGoal
    },
    {
      relativePath: ".apcc/project/overview.yaml",
      value: projectOverview
    },
    {
      relativePath: ".apcc/plans/current.yaml",
      value: buildPlans(endGoal, docsLanguage)
    },
    {
      relativePath: ".apcc/tasks/current.yaml",
      value: buildTasks(docsLanguage)
    },
    {
      relativePath: ".apcc/tasks/archive.yaml",
      value: initialTaskArchiveState
    },
    {
      relativePath: ".apcc/decisions/records.yaml",
      value: initialDecisionState
    },
    {
      relativePath: ".apcc/versions/records.yaml",
      value: initialVersionState
    }
  ];
}

function renderDocTemplate(file: ManagedDocFile): string {
  const sections = file.sections
    .map((section) => `## ${section.heading}\n\n${section.body.trim()}\n`)
    .join("\n");

  const prefix = file.bodyPrefix ? `${file.bodyPrefix.trim()}\n\n` : "";
  return `---\nname: ${file.name}\ndescription: ${file.description}\n---\n\n# ${file.title}\n\n${prefix}${sections}`.trimEnd() + "\n";
}

function buildDocsFiles(
  projectName: string,
  projectSummary: string | undefined,
  endGoal: GoalState,
  docsLanguage: DocsLanguage,
  options: {
    hasExplicitProjectSummary: boolean;
    hasExplicitEndGoal: boolean;
  }
): ManagedDocFile[] {
  const docsProfile = getDocsLanguageProfile(docsLanguage);
  return [
    {
      relativePath: `docs/${docsProfile.overviewDocPath}`,
      name: docsProfile.overviewDocName,
      description: docsProfile.overviewDocDescription,
      title: docsProfile.overviewDocTitle,
      sections: [
        {
          heading: docsProfile.overviewSummaryHeading,
          body: options.hasExplicitProjectSummary ? (projectSummary?.trim() ?? "") : ""
        },
        {
          heading: docsProfile.overviewNarrativeHeading,
          body: ""
        }
      ]
    },
    {
      relativePath: `docs/${docsProfile.goalDocPath}`,
      name: docsProfile.goalDocName,
      description: docsProfile.goalDocDescription,
      title: docsProfile.goalDocTitle,
      sections: [
        {
          heading: docsProfile.goalHeading,
          body: options.hasExplicitEndGoal ? `${endGoal.name}\n\n${endGoal.summary}` : ""
        },
        {
          heading: docsProfile.goalBackgroundHeading,
          body: ""
        },
        {
          heading: docsProfile.goalSuccessHeading,
          body: ""
        },
        {
          heading: docsProfile.goalNonGoalsHeading,
          body: ""
        },
        {
          heading: docsProfile.goalProgressHeading,
          body: ""
        }
      ]
    }
  ];
}

function buildDocsTextFiles(docsLanguage: DocsLanguage): ManagedTextFile[] {
  const sharedPages = docsLanguage === "zh-CN" ? ["概览", "目标"] : ["overview", "goal"];
  const sharedTitle = docsLanguage === "zh-CN" ? "共享" : "Shared";
  const publicTitle = docsLanguage === "zh-CN" ? "公开" : "Public";
  const internalTitle = docsLanguage === "zh-CN" ? "内部" : "Internal";
  return [
    {
      relativePath: "docs/meta.json",
      content: `${JSON.stringify(
        {
          pages: ["shared", "public", "internal"]
        },
        null,
        2
      )}\n`
    },
    {
      relativePath: "docs/shared/meta.json",
      content: `${JSON.stringify(
        {
          title: sharedTitle,
          pages: sharedPages
        },
        null,
        2
      )}\n`
    },
    {
      relativePath: "docs/public/meta.json",
      content: `${JSON.stringify(
        {
          title: publicTitle
        },
        null,
        2
      )}\n`
    },
    {
      relativePath: "docs/internal/meta.json",
      content: `${JSON.stringify(
        {
          title: internalTitle
        },
        null,
        2
      )}\n`
    }
  ];
}

function parseFrontmatter(text: string): { frontmatter: Record<string, string>; body: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: text };
  }

  const frontmatter = parse(match[1]) as Record<string, string>;
  return { frontmatter, body: match[2] ?? "" };
}

function ensureFrontmatterValues(frontmatter: Record<string, string>, updates: Record<string, string>) {
  for (const [key, value] of Object.entries(updates)) {
    frontmatter[key] = value;
  }
}

function ensureSection(body: string, heading: string, sectionBody: string): string {
  const normalized = body.trim();
  const marker = `## ${heading}`;
  if (normalized.includes(marker)) {
    return `${normalized}\n`;
  }

  const suffix = normalized ? "\n\n" : "";
  return `${normalized}${suffix}${marker}\n\n${sectionBody.trim()}\n`;
}

async function upsertManagedDoc(
  root: string,
  file: ManagedDocFile,
  force: boolean,
  allowMergeExisting: boolean,
  result: BootstrapResult
): Promise<void> {
  const target = path.join(root, file.relativePath);
  const rendered = renderDocTemplate(file);
  const existed = existsSync(target);

  if (existed && !allowMergeExisting) {
    result.skippedFiles.push(file.relativePath);
    return;
  }

  if (!existed || force) {
    await writeText(target, rendered);
    result[existed ? "updatedFiles" : "createdFiles"].push(file.relativePath);
    return;
  }

  const current = await fs.readFile(target, "utf8");
  const parsed = parseFrontmatter(current);
  ensureFrontmatterValues(parsed.frontmatter, {
    name: file.name,
    description: file.description
  });

  let body = parsed.body.trim();
  if (!body.startsWith("# ")) {
    body = `# ${file.title}\n\n${body}`.trim();
  }

  if (file.bodyPrefix && !body.includes(file.bodyPrefix)) {
    const bodyPrefix = file.bodyPrefix;
    if (body.startsWith("# ")) {
      body = body.replace(/^# .+?\n\n/, (headingBlock) => `${headingBlock}${bodyPrefix.trim()}\n\n`);
    } else {
      body = `${bodyPrefix.trim()}\n\n${body}`.trim();
    }
  }

  for (const section of file.sections) {
    body = ensureSection(body, section.heading, section.body);
  }

  const next = `---\n${stringify(parsed.frontmatter, { indent: 2, lineWidth: 0 }).trim()}\n---\n\n${body.trimEnd()}\n`;

  if (next === current) {
    result.skippedFiles.push(file.relativePath);
    return;
  }

  await writeText(target, next);
  result.updatedFiles.push(file.relativePath);
}

async function writeManagedTextFile(
  root: string,
  file: ManagedTextFile,
  force: boolean,
  overwriteExisting: boolean,
  result: BootstrapResult
): Promise<void> {
  const target = path.join(root, file.relativePath);
  const existed = existsSync(target);

  if (existed && !overwriteExisting) {
    result.skippedFiles.push(file.relativePath);
    return;
  }

  if (existed && !force) {
    result.skippedFiles.push(file.relativePath);
    return;
  }

  await writeText(target, file.content);
  result[existed ? "updatedFiles" : "createdFiles"].push(file.relativePath);
}

async function writeManagedWorkspaceFile(
  root: string,
  file: ManagedWorkspaceFile,
  force: boolean,
  result: BootstrapResult
): Promise<void> {
  const target = path.join(root, file.relativePath);
  const existed = existsSync(target);

  if (existed && !force) {
    result.skippedFiles.push(file.relativePath);
    return;
  }

  await writeYamlFile(target, file.value);
  result[existed ? "updatedFiles" : "createdFiles"].push(file.relativePath);
}

async function bootstrapWorkspace(input: BootstrapInput): Promise<BootstrapResult> {
  const root = path.resolve(input.targetPath ?? process.cwd());
  const projectName = input.projectName?.trim() || path.basename(root);
  const projectSummary = input.projectSummary?.trim() || undefined;
  const activeChangeId = `bootstrap-${slugify(projectName) || "project"}`;
  const force = Boolean(input.force);
  const preserveExistingDocs = Boolean(input.preserveExistingDocs);
  const existingWorkspaceConfig = hasExistingWorkspaceConfig(root)
    ? await loadWorkspaceConfig(root).catch(() => null)
    : null;
  const projectKind = input.projectKind ?? existingWorkspaceConfig?.projectKind ?? "general";
  const docsMode = input.docsMode ?? existingWorkspaceConfig?.docsMode ?? "standard";
  const docsLanguage =
    input.docsLanguage !== undefined
      ? normalizeDocsLanguage(input.docsLanguage)
      : existingWorkspaceConfig?.docsLanguage ?? "en";
  const hasExplicitProjectSummary = Boolean(input.projectSummary?.trim());
  const hasExplicitEndGoal = Boolean(input.endGoalName?.trim() && input.endGoalSummary?.trim());
  const endGoal = buildEndGoal(
    projectName,
    {
      endGoalName: input.endGoalName,
      endGoalSummary: input.endGoalSummary
    },
    docsLanguage
  );

  await ensureDirectory(root);
  const initStrategy = await resolveInitStrategy(root);
  const mode = "init";

  const result: BootstrapResult = {
    mode,
    root,
    docsRoot: path.join(root, "docs"),
    workspaceRoot: path.join(root, ".apcc"),
    activeChangeId,
    createdFiles: [],
    updatedFiles: [],
    skippedFiles: []
  };

  for (const file of buildWorkspaceFiles(
    mode,
    activeChangeId,
    endGoal,
    projectName,
    projectSummary,
    projectKind,
    docsMode,
    docsLanguage
  )) {
    await writeManagedWorkspaceFile(root, file, force, result);
  }

  const allowMergeExistingDocs = false;

  for (const doc of buildDocsFiles(projectName, projectSummary, endGoal, docsLanguage, {
    hasExplicitProjectSummary,
    hasExplicitEndGoal
  })) {
    if (preserveExistingDocs && existsSync(path.join(root, doc.relativePath))) {
      result.skippedFiles.push(doc.relativePath);
      continue;
    }
    await upsertManagedDoc(root, doc, force, allowMergeExistingDocs, result);
  }

  for (const file of buildDocsTextFiles(docsLanguage)) {
    await writeManagedTextFile(root, file, force, initStrategy === "new", result);
  }

  await withWorkspaceRoot(root, async () => {
    const beforeGuidanceArtifacts = await inspectGuidanceArtifacts(root);
    await syncGuidanceArtifacts(root);

    const managedGuidanceFiles = [
      {
        relativePath: "AGENTS.md",
        existed: beforeGuidanceArtifacts.agentsMdExists
      },
      {
        relativePath: ".agents/skills/apcc-workflow/SKILL.md",
        existed: beforeGuidanceArtifacts.workflowSkillExists
      }
    ];

    for (const file of managedGuidanceFiles) {
      result[file.existed ? "updatedFiles" : "createdFiles"].push(file.relativePath);
    }
  });

  return result;
}

export async function initWorkspace(input: BootstrapInput): Promise<BootstrapResult> {
  return bootstrapWorkspace(input);
}
