import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { stringify } from "yaml";

import type {
  GoalState,
  PlansState,
  ProjectOverviewState,
  TasksState,
  WorkspaceConfigState,
  WorkspaceMetaState,
  WorkspaceState
} from "../../src/core/types.js";

interface WorkspaceFixtureInput {
  project?: ProjectOverviewState;
  endGoal?: GoalState;
  plans?: PlansState;
  tasks?: TasksState;
  active?: WorkspaceState;
  config?: WorkspaceConfigState;
  meta?: WorkspaceMetaState;
}

const defaultEndGoal: GoalState = {
  goalId: "end-goal-test",
  name: "Test end goal",
  summary: "Exercise the APCC project context control plane in isolation.",
  docPath: "shared/goal.md",
  successCriteria: ["Persist and project control-plane state."],
  nonGoals: ["External deployment."]
};

const defaultProject: ProjectOverviewState = {
  name: "Test Workspace",
  summary: "Test workspace for isolated APCC control-plane behavior.",
  docPath: "shared/overview.md"
};

const defaultPlans: PlansState = {
  endGoalRef: "end-goal-test",
  items: [
    {
      id: "plan-root",
      name: "Root plan",
      summary: "Default top-level plan used by workspace fixtures.",
      parentPlanId: null
    }
  ]
};

const defaultTasks: TasksState = {
  items: []
};

const defaultActive: WorkspaceState = {
  activeChange: "test-change",
  currentRoundId: "round-test"
};

const defaultMeta: WorkspaceMetaState = {
  schemaVersion: 9,
  workspaceName: "test-workspace",
  docsRoot: "docs",
  workspaceRoot: ".apcc",
  bootstrapMode: "init",
  templateVersion: "test-template",
  projectKind: "general",
  docsMode: "standard",
  docsLanguage: "en",
  createdAt: "2026-04-19T00:00:00Z",
  lastUpgradedAt: null
};

const defaultConfig: WorkspaceConfigState = {
  siteFramework: "fumadocs",
  packageManager: "npm",
  projectKind: "general",
  docsMode: "standard",
  docsLanguage: "en",
  docsSite: {
    enabled: true,
    sourcePath: "docs",
    preferredPort: null
  },
  workspaceSchemaVersion: 9
};

async function writeYaml(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    stringify(value, {
      indent: 2,
      lineWidth: 0
    }),
    "utf8"
  );
}

async function writeText(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

function doc(name: string, description: string, body: string): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body.trim()}\n`;
}

export async function createWorkspaceFixture(input: WorkspaceFixtureInput = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-test-"));
  const project = input.project ?? defaultProject;
  const endGoal = input.endGoal ?? defaultEndGoal;
  const plans = input.plans ?? defaultPlans;
  const tasks = input.tasks ?? defaultTasks;
  const active = input.active ?? defaultActive;
  const config = input.config ?? defaultConfig;
  const meta = input.meta ?? defaultMeta;

  await writeYaml(path.join(root, ".apcc", "meta", "workspace.yaml"), meta);
  await writeYaml(path.join(root, ".apcc", "config", "workspace.yaml"), config);
  await writeYaml(path.join(root, ".apcc", "project", "overview.yaml"), project);
  await writeYaml(path.join(root, ".apcc", "goals", "end.yaml"), endGoal);
  await writeYaml(path.join(root, ".apcc", "plans", "current.yaml"), plans);
  await writeYaml(path.join(root, ".apcc", "tasks", "current.yaml"), tasks);
  await writeYaml(path.join(root, ".apcc", "tasks", "archive.yaml"), { items: [] });
  await writeYaml(path.join(root, ".apcc", "decisions", "records.yaml"), { items: [] });
  await writeYaml(path.join(root, ".apcc", "versions", "records.yaml"), { items: [] });
  await writeYaml(path.join(root, ".apcc", "state", "active.yaml"), active);

  await writeText(
    path.join(root, "docs", "shared", "overview.md"),
    doc(
      "Shared Overview",
      "Workspace shared overview page.",
      `
# Project Overview

## 项目摘要

待同步
`
    )
  );
  await writeText(
    path.join(root, "docs", "shared", "goal.md"),
    doc(
      "Shared Goal",
      "Workspace shared goal page.",
      `
# Project Goal

## 最终目标

待同步
`
    )
  );
  await writeText(path.join(root, "docs", "public", "meta.json"), "{}\n");
  await writeText(path.join(root, "docs", "internal", "meta.json"), "{}\n");
  await writeText(
    path.join(root, "docs", "project", "overview.md"),
    doc(
      "Project Overview",
      "Project overview page.",
      `
# Project Overview

## 项目摘要

待同步
`
      )
  );
  await writeText(
    path.join(root, "docs", "project", "decisions", "index.md"),
    doc(
      "Decisions",
      "Decision index page.",
      `
# Decisions

## 决策摘要

待同步

## 关键决策列表

- 待同步

## 最近新增决策

- 待同步
`
    )
  );
  await writeText(
    path.join(root, "docs", "index.md"),
    doc(
      "Test index",
      "Workspace entry page.",
      `
# Test Workspace

## 最终目标

待同步

## 当前进度

待同步
`
    )
  );
  await writeText(
    path.join(root, "docs", "engineering", "development.md"),
    doc(
      "Engineering Development",
      "Engineering entry page.",
      `
# Engineering Development

APCC test workspace.
`
    )
  );

  return {
    root,
    use() {
      const previous = process.env.APCC_WORKSPACE_ROOT;
      process.env.APCC_WORKSPACE_ROOT = root;

      return () => {
        if (previous === undefined) {
          delete process.env.APCC_WORKSPACE_ROOT;
          return;
        }
        process.env.APCC_WORKSPACE_ROOT = previous;
      };
    },
    async cleanup() {
      await fs.rm(root, { recursive: true, force: true });
    }
  };
}
