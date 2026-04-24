import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { initWorkspace } from "../src/core/bootstrap.js";
import { inspectGuidanceArtifacts } from "../src/core/guidance.js";
import { getStatusSnapshot } from "../src/core/status.js";
import { validateWorkspace } from "../src/core/validate.js";
import { loadWorkflowGuide } from "../src/core/workflow-guide.js";
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

describe("first-hour workflow", () => {
  it("creates a workspace that already contains the minimum first-hour guidance loop", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-first-hour-"));
    cleanups.push(root);

    await initWorkspace({
      targetPath: root,
      projectName: "First Hour Workspace",
      endGoalName: "Reach a correct first loop",
      endGoalSummary: "Let a human developer and a development agent complete a correct first closed loop."
    });

    const guide = await loadWorkflowGuide();
    const validation = await withWorkspaceRoot(root, async () => validateWorkspace());
    const status = await withWorkspaceRoot(root, async () => getStatusSnapshot());
    const guidanceArtifacts = await withWorkspaceRoot(root, async () => inspectGuidanceArtifacts());
    const workspaceEntries = await fs.readdir(path.join(root, ".apcc"));

    expect(validation.ok).toBe(true);
    expect(guide.markdown).toContain("## First-Hour Loop");
    expect(guide.markdown).toContain("The first-hour loop is a cold-start loop.");
    expect(guide.markdown).toContain("## Success Criteria For A Correct Agent Loop");
    expect(status.endGoal.name).toBe("Reach a correct first loop");
    expect(workspaceEntries).not.toContain(String.fromCharCode(100, 105, 102, 102));
    expect(guidanceArtifacts.agentsMdExists).toBe(true);
    expect(guidanceArtifacts.workflowSkillExists).toBe(true);
  });
});
