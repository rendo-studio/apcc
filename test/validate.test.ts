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
  });
});
