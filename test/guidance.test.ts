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
    expect(agents).toContain("Verify `apcc` is available.");
    expect(agents).toContain("`npm install -g apcc`");
    expect(agents).toContain("Read the APCC Workflow Guide through `apcc guide workflow`");
    expect(agents).toContain("<!-- APCC:BEGIN -->");
    expect(agents).toContain("<!-- APCC:END -->");
    expect(agents).toContain("do not reread the duplicate copy");
    expect(agents).not.toContain("If `apcc` cannot be run yet in the current environment");
    expect(agents).not.toContain("It is identical to `apcc guide workflow`");
    expect(agents).toContain("cold round or the workspace may be desynced");
    expect(agents).toContain("`apcc site start`");
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

  it("does not replace unmarked AGENTS content that happens to mention APCC", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    await fs.writeFile(
      `${fixture.root}/AGENTS.md`,
      "# AGENTS.md\n\n## APCC\n\nLegacy local prompt.\n",
      "utf8"
    );

    const result = await syncGuidanceArtifacts(fixture.root);
    const agents = await fs.readFile(result.agentsMdPath, "utf8");

    expect(agents).toContain("Legacy local prompt.");
    expect(agents).toContain("<!-- APCC:BEGIN -->");
    expect(agents.match(/## APCC/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("uses repo-local maintainer guidance overrides when they exist", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    await fs.mkdir(`${fixture.root}/.maintainer-guidance/skills/apcc-workflow`, { recursive: true });
    await fs.writeFile(
      `${fixture.root}/.maintainer-guidance/agents-template.md`,
      "## APCC Source Repository\n\nMaintainer-only rule.\n",
      "utf8"
    );
    await fs.writeFile(
      `${fixture.root}/.maintainer-guidance/skills/apcc-workflow/SKILL.md`,
      "---\nname: apcc-workflow\ndescription: Maintainer override.\n---\n\n# Maintainer Override\n",
      "utf8"
    );

    const result = await syncGuidanceArtifacts(fixture.root);
    const workflowSkill = await fs.readFile(result.workflowSkillPath, "utf8");
    const agents = await fs.readFile(result.agentsMdPath, "utf8");

    expect(workflowSkill).toContain("# Maintainer Override");
    expect(agents).toContain("Maintainer-only rule.");
    expect(agents).not.toContain("Verify `apcc` is available.");
  });
});
