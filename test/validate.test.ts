import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { initWorkspace } from "../src/core/bootstrap.js";
import { repairWorkspace, validateWorkspace } from "../src/core/validate.js";
import { withWorkspaceRoot } from "../src/core/workspace.js";

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const target = cleanups.pop();
    if (target) {
      await fs.rm(target, { recursive: true, force: true });
    }
  }
});

describe("workspace validation and repair", () => {
  it("repairs missing metadata, config, and managed docs anchors in the current schema", async () => {
    const root = path.join(process.env.TEMP ?? process.cwd(), `apcc-validate-${Date.now()}`);
    cleanups.push(root);

    await initWorkspace({
      targetPath: root,
      projectName: "Legacy Workspace",
      endGoalName: "Modernize legacy workspace",
      endGoalSummary: "Bring the workspace forward to the current APCC schema."
    });

    await fs.writeFile(
      path.join(root, ".apcc", "meta", "workspace.yaml"),
      [
        "workspaceName: legacy-workspace",
        "docsRoot: docs",
        "workspaceRoot: .apcc",
        "createdAt: 2026-04-17T00:00:00Z",
        ""
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(root, ".apcc", "config", "workspace.yaml"),
      [
        "docsSiteEnabled: true",
        ""
      ].join("\n"),
      "utf8"
    );
    const before = await withWorkspaceRoot(root, async () => validateWorkspace());
    expect(before.repairNeeded).toBe(true);
    expect(before.schemaIssues.length).toBeGreaterThan(0);

    const repaired = await withWorkspaceRoot(root, async () => repairWorkspace());
    expect(repaired.repaired).toBe(true);
    expect(repaired.validation.ok).toBe(true);
    expect(repaired.validation.repairNeeded).toBe(false);

    const repairedMeta = await fs.readFile(path.join(root, ".apcc", "meta", "workspace.yaml"), "utf8");
    expect(repairedMeta).toContain("workspaceSchemaVersion: 10");
    expect(repairedMeta).toContain("apccVersion:");
    expect(repairedMeta).not.toContain("\nschemaVersion:");
  });

  it("reports invalid persisted control-plane enum values for direct .apcc edits", async () => {
    const root = path.join(process.env.TEMP ?? process.cwd(), `apcc-validate-enums-${Date.now()}`);
    cleanups.push(root);

    await initWorkspace({
      targetPath: root,
      projectName: "Contract Workspace",
      endGoalName: "Validate contract enums",
      endGoalSummary: "Ensure doctor rejects unsupported persisted values."
    });

    await fs.writeFile(
      path.join(root, ".apcc", "tasks", "current.yaml"),
      [
        "items:",
        "  - id: invalid-task",
        "    name: Invalid task",
        "    summary: Invalid task",
        "    status: started",
        "    planRef: establish-shared-project-context-1",
        "    parentTaskId: null",
        "    countedForProgress: true",
        ""
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(root, ".apcc", "config", "workspace.yaml"),
      [
        "siteFramework: fumadocs",
        "packageManager: npm",
        "projectKind: general",
        "docsMode: standard",
        "docsLanguage: fr",
        "docsSite:",
        "  enabled: true",
        "  sourcePath: docs",
        "  preferredPort: null",
        "workspaceSchemaVersion: 10",
        ""
      ].join("\n"),
      "utf8"
    );

    const validation = await withWorkspaceRoot(root, async () => validateWorkspace());

    expect(validation.ok).toBe(false);
    expect(validation.schemaIssues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unsupported status "started"'),
        expect.stringContaining('unsupported docsLanguage "fr"')
      ])
    );
  });

  it("reports file-aware YAML parse issues instead of collapsing them into generic schema noise", async () => {
    const root = path.join(process.env.TEMP ?? process.cwd(), `apcc-validate-yaml-parse-${Date.now()}`);
    cleanups.push(root);

    await initWorkspace({
      targetPath: root,
      projectName: "Broken Workspace",
      endGoalName: "Handle broken control-plane YAML",
      endGoalSummary: "Ensure doctor points directly at invalid YAML files."
    });

    await fs.writeFile(
      path.join(root, ".apcc", "tasks", "current.yaml"),
      [
        "items:",
        "  - id: broken-task",
        "    name: Broken task",
        "    summary: Broken task",
        "    status: pending",
        "    planRef: establish-shared-project-context-1",
        "    parentTaskId: null",
        "    countedForProgress: true",
        "    planRef: support-next-round-estimation-1",
        ""
      ].join("\n"),
      "utf8"
    );

    const validation = await withWorkspaceRoot(root, async () => validateWorkspace());

    expect(validation.ok).toBe(false);
    expect(validation.schemaIssues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Failed to parse YAML file"),
        expect.stringContaining(".apcc")
      ])
    );
    expect(validation.schemaIssues).not.toEqual(
      expect.arrayContaining([expect.stringContaining("Task state must define an items array")])
    );
  });

  it("repairs a workspace when the managed config file is missing entirely", async () => {
    const root = path.join(process.env.TEMP ?? process.cwd(), `apcc-validate-missing-config-${Date.now()}`);
    cleanups.push(root);

    await initWorkspace({
      targetPath: root,
      projectName: "Missing Config Workspace",
      endGoalName: "Repair missing config",
      endGoalSummary: "Ensure doctor fix restores a deleted workspace config file."
    });

    await fs.rm(path.join(root, ".apcc", "config", "workspace.yaml"), { force: true });

    const before = await withWorkspaceRoot(root, async () => validateWorkspace());
    expect(before.ok).toBe(false);
    expect(before.schemaIssues).toEqual(
      expect.arrayContaining([expect.stringContaining("Missing .apcc/config/workspace.yaml")])
    );

    const repaired = await withWorkspaceRoot(root, async () => repairWorkspace());
    expect(repaired.repaired).toBe(true);
    expect(repaired.validation.ok).toBe(true);

    const repairedConfig = await fs.readFile(path.join(root, ".apcc", "config", "workspace.yaml"), "utf8");
    expect(repairedConfig).toContain("workspaceSchemaVersion: 10");
    expect(repairedConfig).toContain("docsLanguage: en");
  });
});