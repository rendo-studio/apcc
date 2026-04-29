import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getStatusSnapshot } from "../src/core/status.js";
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

describe("status snapshot", () => {
  it("derives current phase and progress without mutating persisted workspace files", async () => {
    const fixture = await createWorkspaceFixture({
      plans: {
        endGoalRef: "end-goal-test",
        items: [
          {
            id: "plan-root",
            name: "Root plan",
            summary: "Default top-level plan used by workspace fixtures.",
            parentPlanId: null,
            versionRef: null
          }
        ]
      },
      tasks: {
        items: [
          {
            id: "task-root-1",
            name: "Done task",
            summary: "Finished work item.",
            status: "done",
            planRef: "plan-root",
            parentTaskId: null,
            countedForProgress: true
          }
        ]
      }
    });
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const planFile = path.join(fixture.root, ".apcc", "plans", "current.yaml");
    await fs.writeFile(
      planFile,
      [
        "endGoalRef: end-goal-test",
        "items:",
        "  - id: plan-root",
        "    name: Root plan",
        "    summary: Default top-level plan used by workspace fixtures.",
        "    status: pending",
        "    parentPlanId: null",
        ""
      ].join("\n"),
      "utf8"
    );
    const beforePlan = await fs.readFile(planFile, "utf8");

    const status = await getStatusSnapshot();

    const afterPlan = await fs.readFile(planFile, "utf8");

    expect(status.phase).toBe("Completed");
    expect(status.progress.percent).toBe(100);
    expect(status.topLevelPlans).toEqual(["Root plan [done]"]);
    expect(beforePlan).toBe(afterPlan);
  });
});
