import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createVersionRecord,
  getVersionRecord,
  listVersionRecords,
  updateVersionRecord
} from "../src/core/version.js";
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

describe("version control plane", () => {
  it("creates, updates, and records low-frequency project-level version records through explicit doc paths", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const docPath = "internal/changelog/0-2-0.md";
    await fs.mkdir(path.join(fixture.root, "docs", "internal", "changelog"), { recursive: true });
    await fs.writeFile(
      path.join(fixture.root, "docs", "internal", "changelog", "0-2-0.md"),
      "---\nname: v0.2.0\ndescription: Version log.\n---\n\n# v0.2.0\n",
      "utf8"
    );

    const draft = await createVersionRecord({
      version: "0.2.0",
      title: "Stable control-plane baseline",
      summary: "First version where the APCC control plane is stable enough to preserve as a project-level milestone.",
      docPath,
      decisionRefs: ["define-version-record-policy"]
    });

    const updated = await updateVersionRecord({
      id: draft.id,
      addHighlights: ["Removed persisted derived state", "Made init safe for existing repos by default"],
      addMigrationNotes: ["Existing repositories can keep their current docs layout; the new docs package profile is only the recommended default for new scaffolds."],
      validationSummary: "Core version record and docs projection flow validated."
    });

    const recorded = await updateVersionRecord({
      id: draft.id,
      status: "recorded"
    });

    const listed = await listVersionRecords();
    const loaded = await getVersionRecord(draft.id);

    expect(updated.status).toBe("draft");
    expect(recorded.status).toBe("recorded");
    expect(loaded.recordedAt).not.toBeNull();
    expect(listed).toHaveLength(1);
    expect(loaded.docPath).toBe(docPath);
    expect(loaded.highlights).toContain("Removed persisted derived state");
  });
});
