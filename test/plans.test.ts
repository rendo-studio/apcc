import { afterEach, describe, expect, it } from "vitest";

import {
  addPlan,
  buildPlanTree,
  deletePlan,
  derivePlanStatuses,
  filterDerivedPlansByVersion,
  filterTasksByPlanVersion,
  loadPlans,
  updatePlan
} from "../src/core/plans.js";
import { writeYamlFile } from "../src/core/storage.js";
import { loadTasks } from "../src/core/tasks.js";
import { getWorkspacePaths } from "../src/core/workspace.js";
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

describe("plan control plane", () => {
  it("adds and reparents plan nodes without breaking the tree", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const addedRoot = await addPlan({
      name: "Harden workspace refresh",
      parent: "root"
    });
    const addedChild = await addPlan({
      name: "Add console mutation coverage",
      parent: addedRoot.plan.id
    });

    const updated = await updatePlan({
      id: addedChild.plan.id,
      name: "Add human and agent source classification"
    });

    const tasks = await loadTasks();
    const plans = await loadPlans();
    const tree = buildPlanTree(derivePlanStatuses(plans, tasks).items);

    expect("status" in updated.plan).toBe(false);
    expect(tree.some((node) => node.id === addedRoot.plan.id)).toBe(true);
    expect(tree.find((node) => node.id === addedRoot.plan.id)?.children[0]?.id).toBe(
      addedChild.plan.id
    );
  });

  it("allows explicit plan ids while rejecting invalid or duplicate ids", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const added = await addPlan({
      id: "release-hardening",
      name: "Release hardening",
      parent: "root"
    });

    expect(added.plan.id).toBe("release-hardening");
    await expect(
      addPlan({
        id: "release-hardening",
        name: "Duplicate release hardening",
        parent: "root"
      })
    ).rejects.toThrow(/already exists/i);
    await expect(
      addPlan({
        id: "Release Hardening",
        name: "Invalid release hardening",
        parent: "root"
      })
    ).rejects.toThrow(/lowercase letters/i);
    await expect(
      addPlan({
        id: "root",
        name: "Reserved root",
        parent: "root"
      })
    ).rejects.toThrow(/reserved/i);
  });

  it("skips already-used generated plan ids after deleted sibling gaps", async () => {
    const fixture = await createWorkspaceFixture({
      plans: {
        endGoalRef: "goal-test",
        items: [
          {
            id: "duplicate-name-2",
            name: "Duplicate Name",
            summary: "Existing generated id after a deleted first sibling.",
            parentPlanId: null,
            versionRef: null
          }
        ]
      }
    });
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const added = await addPlan({
      name: "Duplicate Name",
      parent: "root"
    });

    expect(added.plan.id).toBe("duplicate-name-3");
  });

  it("derives descendant task status back to parent plans without persisting plan status fields", async () => {
    const fixture = await createWorkspaceFixture({
      plans: {
        endGoalRef: "goal-test",
        items: [
          {
            id: "plan-root",
            name: "Production hardening",
            summary: "Drive the control plane toward a stronger production baseline.",
            parentPlanId: null,
            versionRef: null
          },
          {
            id: "plan-child",
            name: "Status projection",
            summary: "Keep the control-plane projection aligned with task state.",
            parentPlanId: "plan-root",
            versionRef: null
          }
        ]
      },
      tasks: {
        items: [
          {
            id: "task-1",
            name: "Recompute status projection",
            summary: "Refresh plan status from current task state.",
            status: "done",
            planRef: "plan-child",
            parentTaskId: null,
            countedForProgress: true
          }
        ]
      }
    });
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const plans = derivePlanStatuses(await loadPlans(), await loadTasks());
    const persistedPlanFile = await loadPlans();

    expect(plans.items.find((plan) => plan.id === "plan-child")?.status).toBe("done");
    expect(plans.items.find((plan) => plan.id === "plan-root")?.status).toBe("done");
    expect(persistedPlanFile.items.every((plan) => !("status" in plan))).toBe(true);
  });

  it("deletes a plan subtree together with attached tasks", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const rootPlan = await addPlan({
      name: "Disposable plan",
      parent: "root"
    });
    const childPlan = await addPlan({
      name: "Disposable child",
      parent: rootPlan.plan.id
    });

    const tasksFile = await loadTasks();
    tasksFile.items.push({
      id: "task-plan-delete",
      name: "Linked task",
      summary: "Task linked to the disposable plan subtree.",
      status: "pending",
      planRef: childPlan.plan.id,
      parentTaskId: null,
      countedForProgress: true
    });
    await writeYamlFile(getWorkspacePaths().taskFile, tasksFile);

    const deleted = await deletePlan({
      id: rootPlan.plan.id
    });
    const plans = await loadPlans();
    const tasks = await loadTasks();

    expect(deleted.deletedPlanIds).toEqual([rootPlan.plan.id, childPlan.plan.id]);
    expect(deleted.deletedTaskIds).toEqual(["task-plan-delete"]);
    expect(plans.items.some((plan) => plan.id === rootPlan.plan.id)).toBe(false);
    expect(tasks.items.some((task) => task.id === "task-plan-delete")).toBe(false);
  });

  it("derives effective version scopes and filters plans and tasks by version", async () => {
    const fixture = await createWorkspaceFixture({
      plans: {
        endGoalRef: "goal-test",
        items: [
          {
            id: "plan-unversioned",
            name: "Unversioned plan",
            summary: "Work not yet attached to a project version.",
            parentPlanId: null,
            versionRef: null
          },
          {
            id: "plan-versioned",
            name: "Versioned plan",
            summary: "Work tracked under an explicit release anchor.",
            parentPlanId: null,
            versionRef: "release-0-2-0"
          },
          {
            id: "plan-versioned-child",
            name: "Inherited child plan",
            summary: "Child work should inherit the parent version scope.",
            parentPlanId: "plan-versioned",
            versionRef: null
          }
        ]
      },
      tasks: {
        items: [
          {
            id: "task-unversioned",
            name: "Unversioned task",
            summary: "Backlog work outside a release boundary.",
            status: "pending",
            planRef: "plan-unversioned",
            parentTaskId: null,
            countedForProgress: true
          },
          {
            id: "task-versioned",
            name: "Versioned task",
            summary: "Top-level versioned work.",
            status: "done",
            planRef: "plan-versioned",
            parentTaskId: null,
            countedForProgress: true
          },
          {
            id: "task-versioned-child",
            name: "Inherited versioned task",
            summary: "Child work should stay in the same version scope.",
            status: "in_progress",
            planRef: "plan-versioned-child",
            parentTaskId: null,
            countedForProgress: true
          }
        ]
      },
      versions: {
        items: [
          {
            id: "release-0-2-0",
            version: "0.2.0",
            title: "Stable baseline",
            summary: "First stable project version.",
            docPath: null,
            status: "recorded",
            decisionRefs: [],
            highlights: [],
            breakingChanges: [],
            migrationNotes: [],
            validationSummary: null,
            createdAt: "2026-04-30T00:00:00Z",
            recordedAt: "2026-04-30T00:10:00Z"
          }
        ]
      }
    });
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const tasks = await loadTasks();
    const plans = derivePlanStatuses(await loadPlans(), tasks);
    const versionedPlans = filterDerivedPlansByVersion(plans, { versionRef: "release-0-2-0" });
    const unversionedPlans = filterDerivedPlansByVersion(plans, { unversioned: true });
    const versionedTasks = filterTasksByPlanVersion(tasks.items, plans, { versionRef: "release-0-2-0" });
    const unversionedTasks = filterTasksByPlanVersion(tasks.items, plans, { unversioned: true });

    expect(plans.items.find((plan) => plan.id === "plan-versioned")?.effectiveVersionRef).toBe("release-0-2-0");
    expect(plans.items.find((plan) => plan.id === "plan-versioned-child")?.effectiveVersionRef).toBe("release-0-2-0");
    expect(plans.items.find((plan) => plan.id === "plan-unversioned")?.effectiveVersionRef).toBeNull();
    expect(versionedPlans.map((plan) => plan.id)).toEqual(["plan-versioned", "plan-versioned-child"]);
    expect(unversionedPlans.map((plan) => plan.id)).toEqual(["plan-unversioned"]);
    expect(versionedTasks.map((task) => task.id)).toEqual(["task-versioned", "task-versioned-child"]);
    expect(unversionedTasks.map((task) => task.id)).toEqual(["task-unversioned"]);
  });

  it("rejects a descendant plan that conflicts with an inherited version scope", async () => {
    const fixture = await createWorkspaceFixture({
      plans: {
        endGoalRef: "goal-test",
        items: [
          {
            id: "plan-versioned",
            name: "Versioned parent",
            summary: "Parent plan anchored to a recorded version.",
            parentPlanId: null,
            versionRef: "release-0-2-0"
          }
        ]
      },
      versions: {
        items: [
          {
            id: "release-0-2-0",
            version: "0.2.0",
            title: "Stable baseline",
            summary: "First stable project version.",
            docPath: null,
            status: "recorded",
            decisionRefs: [],
            highlights: [],
            breakingChanges: [],
            migrationNotes: [],
            validationSummary: null,
            createdAt: "2026-04-30T00:00:00Z",
            recordedAt: "2026-04-30T00:10:00Z"
          },
          {
            id: "release-0-3-0",
            version: "0.3.0",
            title: "Next baseline",
            summary: "Next project version.",
            docPath: null,
            status: "draft",
            decisionRefs: [],
            highlights: [],
            breakingChanges: [],
            migrationNotes: [],
            validationSummary: null,
            createdAt: "2026-04-30T01:00:00Z",
            recordedAt: null
          }
        ]
      }
    });
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    await expect(
      addPlan({
        name: "Conflicting child",
        parent: "plan-versioned",
        version: "release-0-3-0"
      })
    ).rejects.toThrow(/cannot override inherited version scope/i);
  });
});
