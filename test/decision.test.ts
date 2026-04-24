import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createDecisionRecord,
  decideDecisionRecord,
  listDecisionRecords,
  migrateDecisionState
} from "../src/core/decision.js";
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

describe("decision control plane", () => {
  it("creates and decides important records without relying on implicit docs directories", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const docPath = "internal/decision-log/version-record-policy.md";
    await fs.mkdir(path.join(fixture.root, "docs", "internal", "decision-log"), { recursive: true });
    await fs.writeFile(
      path.join(fixture.root, "docs", "internal", "decision-log", "version-record-policy.md"),
      "---\nname: Version record policy\ndescription: Decision log entry.\n---\n\n# Version record policy\n",
      "utf8"
    );

    const record = await createDecisionRecord({
      name: "Define version record policy",
      description: "Introduce low-frequency project-level version records.",
      docPath,
      category: "version",
      proposedBy: "agent",
      context: "The framework still mixes project versions with delivery-event semantics.",
      impactOfNoAction: "Version history remains ambiguous and hard to maintain consistently.",
      expectedOutcome: "Project-level version records become explicit and low-frequency.",
      boundary: "Only the version-record model; no external publish workflow."
    });

    const decided = await decideDecisionRecord({
      id: record.id,
      decision: "approve",
      summary: "This is now required for public alpha readiness."
    });

    const all = await listDecisionRecords();

    expect(decided.status).toBe("approved");
    expect(all).toHaveLength(1);
    expect(all[0]?.docPath).toBe(docPath);
  });

  it("migrates a legacy decision record file into the generic control plane", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    await fs.mkdir(path.join(fixture.root, ".apcc", "legacy"), { recursive: true });
    await fs.writeFile(
      path.join(fixture.root, ".apcc", "legacy", "records.yaml"),
      [
        "items:",
        "  - id: introduce-public-alpha-install-path",
        "    name: Introduce public alpha install path",
        "    description: Add the minimum installation path required for external users.",
        "    proposedBy: agent",
        "    notActingCost: External users cannot try APCC repeatably.",
        "    expectedValue: A real external trial path becomes possible.",
        "    boundary: Only the alpha installation path; no hosted control plane.",
        "    status: started",
        "    decisionSummary: This is now required for public alpha readiness.",
        "    revisitCondition: Revisit if the install flow changes materially.",
        ""
      ].join("\n"),
      "utf8"
    );
    await fs.rm(path.join(fixture.root, ".apcc", "decisions", "records.yaml"), { force: true });

    const migrated = await migrateDecisionState();
    const all = await listDecisionRecords();
    const legacyFileExists = await fs
      .stat(path.join(fixture.root, ".apcc", "legacy", "records.yaml"))
      .then(() => true)
      .catch(() => false);

    expect(migrated.migrated).toBe(true);
    expect(all).toHaveLength(1);
    expect(all[0]?.status).toBe("approved");
    expect(legacyFileExists).toBe(false);
  });
});
