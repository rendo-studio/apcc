import fs from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { getAgentsTemplateAssetPath, inspectGuidanceArtifacts, syncGuidanceArtifacts } from "../src/core/guidance.js";
import { loadWorkflowGuide } from "../src/core/workflow-guide.js";
import { createWorkspaceFixture } from "./helpers/workspace.js";

const restorers: Array<() => void> = [];
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (restorers.length > 0) {
    restorers.pop()?.();
  }

  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("workflow guidance artifacts", () => {
  it("syncs the minimum workspace-facing workflow guidance", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const result = await syncGuidanceArtifacts(fixture.root);
    const guide = await loadWorkflowGuide();
    const workflowSkill = await fs.readFile(result.workflowSkillPath, "utf8");
    const agents = await fs.readFile(result.agentsMdPath, "utf8");
    const inspection = await inspectGuidanceArtifacts(fixture.root);

    expect(workflowSkill).toBe(guide.markdown);
    expect(agents).toContain("It is identical to `apcc guide workflow`");
    expect(agents).toContain("cold round or the workspace may be desynced");
    expect(agents).toContain("`apcc site open`");
    expect(agents).toContain("continue without rerunning the full round-start sequence");
    expect(agents).toContain("refresh the workspace");
    expect(agents).toContain("If the project identity or long-lived end goal is unclear");
    expect(inspection.workflowSkillExists).toBe(true);
    expect(inspection.agentsMdExists).toBe(true);
  });

  it("loads the AGENTS template from assets and appends it to an existing AGENTS.md without overwriting custom content", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    await fs.writeFile(`${fixture.root}/AGENTS.md`, "# Existing AGENTS\n\nCustom repository rule.\n", "utf8");

    const result = await syncGuidanceArtifacts(fixture.root);
    const agents = await fs.readFile(result.agentsMdPath, "utf8");

    expect(getAgentsTemplateAssetPath()).toContain("assets");
    expect(agents).toContain("# Existing AGENTS");
    expect(agents).toContain("Custom repository rule.");
    expect(agents).toContain("## APCC");
    expect(agents).toContain("<!-- APCC:BEGIN -->");
    expect(agents).toContain("<!-- APCC:END -->");
  });
});
