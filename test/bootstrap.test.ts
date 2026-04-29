import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { initWorkspace } from "../src/core/bootstrap.js";

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const target = cleanups.pop();
    if (target) {
      await fs.rm(target, { recursive: true, force: true });
    }
  }
});

describe("init", () => {
  it("initializes a new workspace and generates the expected control-plane files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-init-"));
    cleanups.push(root);

    const first = await initWorkspace({
      targetPath: root,
      projectName: "Example Project",
      endGoalName: "Launch Example",
      endGoalSummary: "Ship the first releasable slice of Example."
    });

    expect(first.createdFiles).toContain(".apcc/project/overview.yaml");
    expect(first.createdFiles).toContain(".apcc/goals/end.yaml");
    expect(first.createdFiles).toContain("docs/shared/overview.md");
    expect(first.createdFiles).toContain("docs/shared/goal.md");
    expect(first.createdFiles).toContain("docs/shared/meta.json");
    expect(first.createdFiles).toContain("docs/meta.json");
    expect(first.createdFiles).toContain("docs/public/meta.json");
    expect(first.createdFiles).toContain("docs/internal/meta.json");
    expect(first.createdFiles).toContain("AGENTS.md");
    expect(first.createdFiles).toContain(".agents/skills/apcc-workflow/SKILL.md");

    const second = await initWorkspace({
      targetPath: root,
      projectName: "Example Project",
      endGoalName: "Launch Example",
      endGoalSummary: "Ship the first releasable slice of Example."
    });

    expect(second.skippedFiles.length).toBeGreaterThan(0);
    const workspaceEntries = await fs.readdir(path.join(root, ".apcc"));
    expect(workspaceEntries).not.toContain(String.fromCharCode(100, 105, 102, 102));
    const progressFileExists = await fs
      .stat(path.join(root, ".apcc", "state", "progress.yaml"))
      .then(() => true)
      .catch(() => false);
    expect(progressFileExists).toBe(false);
  });

  it("persists the primary docs language and scaffolds localized shared docs when requested", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-init-zh-docs-"));
    cleanups.push(root);

    const result = await initWorkspace({
      targetPath: root,
      projectName: "示例项目",
      docsLanguage: "zh-CN"
    });

    const config = await fs.readFile(path.join(root, ".apcc", "config", "workspace.yaml"), "utf8");
    const meta = await fs.readFile(path.join(root, ".apcc", "meta", "workspace.yaml"), "utf8");
    const sharedMeta = await fs.readFile(path.join(root, "docs", "shared", "meta.json"), "utf8");
    const overviewDoc = await fs.readFile(path.join(root, "docs", "shared", "概览.md"), "utf8");
    const goalDoc = await fs.readFile(path.join(root, "docs", "shared", "目标.md"), "utf8");

    expect(result.createdFiles).toContain("docs/shared/概览.md");
    expect(result.createdFiles).toContain("docs/shared/目标.md");
    expect(result.createdFiles).toContain("docs/shared/meta.json");
    expect(config).toContain("docsLanguage: zh-CN");
    expect(meta).toContain("docsLanguage: zh-CN");
    expect(meta).toContain("workspaceSchemaVersion: 10");
    expect(meta).toContain("apccVersion:");
    expect(JSON.parse(sharedMeta)).toEqual({
      title: "共享",
      pages: ["概览", "目标"]
    });
    expect(overviewDoc).toContain("# 项目概览");
    expect(goalDoc).toContain("# 项目目标");
  });

  it("preserves the persisted docs language when init runs again on an existing APCC workspace", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-init-reinit-zh-docs-"));
    cleanups.push(root);

    await initWorkspace({
      targetPath: root,
      projectName: "示例项目",
      docsLanguage: "zh-CN"
    });

    const second = await initWorkspace({
      targetPath: root,
      projectName: "示例项目"
    });

    const englishOverviewExists = await fs
      .stat(path.join(root, "docs", "shared", "overview.md"))
      .then(() => true)
      .catch(() => false);
    const englishGoalExists = await fs
      .stat(path.join(root, "docs", "shared", "goal.md"))
      .then(() => true)
      .catch(() => false);
    const localizedOverviewExists = await fs
      .stat(path.join(root, "docs", "shared", "概览.md"))
      .then(() => true)
      .catch(() => false);
    const localizedGoalExists = await fs
      .stat(path.join(root, "docs", "shared", "目标.md"))
      .then(() => true)
      .catch(() => false);
    const config = await fs.readFile(path.join(root, ".apcc", "config", "workspace.yaml"), "utf8");

    expect(second.createdFiles).not.toContain("docs/shared/overview.md");
    expect(second.createdFiles).not.toContain("docs/shared/goal.md");
    expect(englishOverviewExists).toBe(false);
    expect(englishGoalExists).toBe(false);
    expect(localizedOverviewExists).toBe(true);
    expect(localizedGoalExists).toBe(true);
    expect(config).toContain("docsLanguage: zh-CN");
  });

  it("can initialize the current directory with provisional overview and end-goal anchors", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-init-cwd-"));
    cleanups.push(root);
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);

    try {
      const result = await initWorkspace({});
      const overview = await fs.readFile(path.join(root, ".apcc", "project", "overview.yaml"), "utf8");
      const endGoal = await fs.readFile(path.join(root, ".apcc", "goals", "end.yaml"), "utf8");

      expect(result.root).toBe(root);
      expect(overview).toContain("has not defined a project overview yet");
      expect(endGoal).toContain("Unspecified end goal");
      expect(endGoal).toContain("has not defined a long-lived end goal yet");
    } finally {
      cwdSpy.mockRestore();
    }
  });

  it("generates neutral shared docs instead of injecting APCC framework narration", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-init-neutral-docs-"));
    cleanups.push(root);

    await initWorkspace({
      targetPath: root,
      projectName: "Example Project"
    });

    const docsMeta = await fs.readFile(path.join(root, "docs", "meta.json"), "utf8");
    const sharedMeta = await fs.readFile(path.join(root, "docs", "shared", "meta.json"), "utf8");
    const overviewDoc = await fs.readFile(path.join(root, "docs", "shared", "overview.md"), "utf8");
    const goalDoc = await fs.readFile(path.join(root, "docs", "shared", "goal.md"), "utf8");

    expect(JSON.parse(docsMeta)).toEqual({
      pages: ["shared", "public", "internal"]
    });
    expect(JSON.parse(sharedMeta)).toEqual({
      title: "Shared",
      pages: ["overview", "goal"]
    });
    expect(overviewDoc).not.toContain(".apcc/project/overview.yaml");
    expect(overviewDoc).not.toContain("共享层只保留最稳定、最通用的项目上下文");
    expect(goalDoc).not.toContain("Console");
    expect(goalDoc).not.toContain("apcc status show");
    expect(goalDoc).not.toContain("共享控制面");
  });

  it("initializes an existing project without destroying existing docs content", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-init-existing-"));
    cleanups.push(root);

    await fs.writeFile(path.join(root, "README.md"), "# Existing project\n", "utf8");
    await fs.mkdir(path.join(root, "docs"), { recursive: true });
    await fs.writeFile(
      path.join(root, "docs", "index.md"),
      `# Existing Docs\n\nThis line must survive init.\n`,
      "utf8"
    );

    const result = await initWorkspace({
      targetPath: root,
      endGoalName: "Ship Existing MVP",
      endGoalSummary: "Stabilize and ship the first production slice of the existing project."
    });

    const indexContent = await fs.readFile(path.join(root, "docs", "index.md"), "utf8");
    const endGoalFileExists = await fs
      .stat(path.join(root, ".apcc", "goals", "end.yaml"))
      .then(() => true)
      .catch(() => false);
    const projectOverviewExists = await fs
      .stat(path.join(root, ".apcc", "project", "overview.yaml"))
      .then(() => true)
      .catch(() => false);
    const agentsExists = await fs
      .stat(path.join(root, "AGENTS.md"))
      .then(() => true)
      .catch(() => false);
    const workflowSkillExists = await fs
      .stat(path.join(root, ".agents", "skills", "apcc-workflow", "SKILL.md"))
      .then(() => true)
      .catch(() => false);
    expect(result.createdFiles).toContain(".apcc/goals/end.yaml");
    expect(endGoalFileExists).toBe(true);
    expect(projectOverviewExists).toBe(true);
    expect(agentsExists).toBe(true);
    expect(workflowSkillExists).toBe(true);
    const sharedOverviewExists = await fs
      .stat(path.join(root, "docs", "shared", "overview.md"))
      .then(() => true)
      .catch(() => false);
    const sharedGoalExists = await fs
      .stat(path.join(root, "docs", "shared", "goal.md"))
      .then(() => true)
      .catch(() => false);
    expect(indexContent).toBe("# Existing Docs\n\nThis line must survive init.\n");
    expect(sharedOverviewExists).toBe(true);
    expect(sharedGoalExists).toBe(true);
  });

  it("creates titled directory meta files inside existing public and internal docs directories", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-init-existing-docs-placeholders-"));
    cleanups.push(root);

    await fs.mkdir(path.join(root, "docs", "public"), { recursive: true });
    await fs.mkdir(path.join(root, "docs", "internal"), { recursive: true });
    await fs.writeFile(path.join(root, "docs", "public", "quickstart.md"), "# Quickstart\n", "utf8");
    await fs.writeFile(path.join(root, "docs", "internal", "notes.md"), "# Notes\n", "utf8");

    const result = await initWorkspace({
      targetPath: root,
      projectName: "Existing Project"
    });

    const publicMeta = await fs.readFile(path.join(root, "docs", "public", "meta.json"), "utf8");
    const internalMeta = await fs.readFile(path.join(root, "docs", "internal", "meta.json"), "utf8");

    expect(result.createdFiles).toContain("docs/public/meta.json");
    expect(result.createdFiles).toContain("docs/internal/meta.json");
    expect(JSON.parse(publicMeta)).toEqual({ title: "Public" });
    expect(JSON.parse(internalMeta)).toEqual({ title: "Internal" });
  });

  it("can initialize the current directory when it is already an existing project", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-init-existing-cwd-"));
    cleanups.push(root);
    await fs.writeFile(path.join(root, "README.md"), "# Existing project\n", "utf8");
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);

    try {
      const result = await initWorkspace({});
      const overview = await fs.readFile(path.join(root, ".apcc", "project", "overview.yaml"), "utf8");
      const endGoal = await fs.readFile(path.join(root, ".apcc", "goals", "end.yaml"), "utf8");

      expect(result.root).toBe(root);
      expect(overview).toContain("has not defined a project overview yet");
      expect(endGoal).toContain("Unspecified end goal");
    } finally {
      cwdSpy.mockRestore();
    }
  });

  it("never rewrites existing docs when the target path already exists", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-init-existing-docs-"));
    cleanups.push(root);

    await fs.mkdir(path.join(root, "docs", "shared"), { recursive: true });
    await fs.writeFile(
      path.join(root, "docs", "shared", "overview.md"),
      "# Existing shared overview\n\nDo not touch this file.\n",
      "utf8"
    );

    await initWorkspace({
      targetPath: root,
      projectName: "Existing Project"
    });

    const sharedOverview = await fs.readFile(path.join(root, "docs", "shared", "overview.md"), "utf8");
    expect(sharedOverview).toBe("# Existing shared overview\n\nDo not touch this file.\n");
  });

  it("appends the APCC guidance block to an existing AGENTS.md instead of overwriting it", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-init-existing-agents-"));
    cleanups.push(root);

    await fs.writeFile(path.join(root, "README.md"), "# Existing project\n", "utf8");
    await fs.writeFile(path.join(root, "AGENTS.md"), "# Existing AGENTS\n\nLocal rule.\n", "utf8");

    await initWorkspace({
      targetPath: root,
      projectName: "Existing Project"
    });

    const agents = await fs.readFile(path.join(root, "AGENTS.md"), "utf8");

    expect(agents).toContain("# Existing AGENTS");
    expect(agents).toContain("Local rule.");
    expect(agents).toContain("## APCC");
    expect(agents).toContain("<!-- APCC:BEGIN -->");
  });

  it("uses repo-local maintainer guidance overrides during self-init style runs", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-init-maintainer-guidance-"));
    cleanups.push(root);

    await fs.mkdir(path.join(root, ".maintainer-guidance", "skills", "apcc-workflow"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".maintainer-guidance", "agents-template.md"),
      "## APCC Source Repository\n\nMaintainer-first rule.\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(root, ".maintainer-guidance", "skills", "apcc-workflow", "SKILL.md"),
      "---\nname: apcc-workflow\ndescription: Maintainer override.\n---\n\n# Maintainer Override\n",
      "utf8"
    );

    await initWorkspace({
      targetPath: root,
      projectName: "APCC"
    });

    const agents = await fs.readFile(path.join(root, "AGENTS.md"), "utf8");
    const skill = await fs.readFile(path.join(root, ".agents", "skills", "apcc-workflow", "SKILL.md"), "utf8");

    expect(agents).toContain("Maintainer-first rule.");
    expect(agents).toContain("<!-- APCC:BEGIN -->");
    expect(skill).toContain("# Maintainer Override");
  });
});
