import { afterEach, describe, expect, it } from "vitest";

import { addTask, deleteTask, loadTasks, updateTask, updateTaskStatus } from "../src/core/tasks.js";
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

describe("task control plane", () => {
  it("requires an explicit plan for root tasks and inherits plan from parent tasks", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    await expect(
      addTask({
        name: "Root task without plan",
        parent: "root"
      })
    ).rejects.toThrow(/requires an explicit plan/i);

    const rootTask = await addTask({
      name: "Root task",
      parent: "root",
      plan: "plan-root"
    });
    const childTask = await addTask({
      name: "Child task",
      parent: rootTask.task.id
    });

    expect(rootTask.task.planRef).toBe("plan-root");
    expect(childTask.task.planRef).toBe("plan-root");
  });

  it("allows explicit task ids while rejecting invalid or duplicate ids", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const added = await addTask({
      id: "release-check",
      name: "Release check",
      parent: "root",
      plan: "plan-root"
    });

    expect(added.task.id).toBe("release-check");
    await expect(
      addTask({
        id: "release-check",
        name: "Duplicate release check",
        parent: "root",
        plan: "plan-root"
      })
    ).rejects.toThrow(/already exists/i);
    await expect(
      addTask({
        id: "Release Check",
        name: "Invalid release check",
        parent: "root",
        plan: "plan-root"
      })
    ).rejects.toThrow(/lowercase letters/i);
    await expect(
      addTask({
        id: "root",
        name: "Reserved root",
        parent: "root",
        plan: "plan-root"
      })
    ).rejects.toThrow(/reserved/i);
  });

  it("skips already-used generated task ids after deleted sibling gaps", async () => {
    const fixture = await createWorkspaceFixture({
      tasks: {
        items: [
          {
            id: "duplicate-name-2",
            name: "Duplicate Name",
            summary: "Existing generated id after a deleted first sibling.",
            status: "pending",
            planRef: "plan-root",
            parentTaskId: null,
            countedForProgress: true
          }
        ]
      }
    });
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const added = await addTask({
      name: "Duplicate Name",
      parent: "root",
      plan: "plan-root"
    });

    expect(added.task.id).toBe("duplicate-name-3");
  });

  it("returns computed progress when task statuses change without persisting a progress cache", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const first = await addTask({
      name: "Task A",
      parent: "root",
      plan: "plan-root"
    });
    const second = await addTask({
      name: "Task B",
      parent: "root",
      plan: "plan-root"
    });

    const updated = await updateTaskStatus({
      id: first.task.id,
      status: "done"
    });

    const tasks = await loadTasks();

    expect(tasks.items).toHaveLength(2);
    expect(first.progressPercent).toBe(0);
    expect(second.progressPercent).toBe(0);
    expect(updated.progressPercent).toBe(50);
  });

  it("updates task fields and deletes task subtrees", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const rootTask = await addTask({
      name: "Root task",
      parent: "root",
      plan: "plan-root"
    });
    const childTask = await addTask({
      name: "Child task",
      parent: rootTask.task.id
    });

    const updated = await updateTask({
      id: childTask.task.id,
      name: "Child task renamed",
      summary: "Renamed child summary.",
      countedForProgress: false,
      status: "in_progress"
    });
    const deleted = await deleteTask({
      id: rootTask.task.id
    });
    const tasks = await loadTasks();

    expect(updated.task.name).toBe("Child task renamed");
    expect(updated.task.summary).toBe("Renamed child summary.");
    expect(updated.task.countedForProgress).toBe(false);
    expect(deleted.deletedTaskIds).toEqual([rootTask.task.id, childTask.task.id]);
    expect(tasks.items).toHaveLength(0);
  });
});
