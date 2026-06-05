import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { addTask, deleteTask, loadTasks, updateTask, updateTaskStatus } from "../src/core/tasks.js";
import { createWorkspaceFixture } from "./helpers/workspace.js";

const restorers: Array<() => void> = [];
const cleanups: Array<() => Promise<void>> = [];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runTaskCli(args: string[], workspaceRoot: string) {
  const result = spawnSync(process.execPath, ["--import", "tsx", path.join(repoRoot, "src", "bin", "apcc.ts"), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      APCC_WORKSPACE_ROOT: workspaceRoot
    }
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

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

  it("accepts an optional initial status while keeping pending as the default", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const inProgressTask = await addTask({
      name: "Started task",
      parent: "root",
      plan: "plan-root",
      status: "in_progress"
    });
    const defaultTask = await addTask({
      name: "Default task",
      parent: "root",
      plan: "plan-root"
    });

    expect(inProgressTask.task.status).toBe("in_progress");
    expect(defaultTask.task.status).toBe("pending");

    await expect(
      addTask({
        name: "Invalid task",
        parent: "root",
        plan: "plan-root",
        status: "todo" as never
      })
    ).rejects.toThrow(/unsupported status/i);
  });

  it("rejects child tasks that try to diverge from the parent task plan", async () => {
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
          },
          {
            id: "plan-other",
            name: "Other plan",
            summary: "Alternate plan for invalid task reassignment checks.",
            parentPlanId: null,
            versionRef: null
          }
        ]
      }
    });
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const rootTask = await addTask({
      name: "Root task",
      parent: "root",
      plan: "plan-root"
    });

    await expect(
      addTask({
        name: "Child task",
        parent: rootTask.task.id,
        plan: "plan-other"
      })
    ).rejects.toThrow(/cannot override the parent task plan/i);

    await expect(
      updateTask({
        id: rootTask.task.id,
        parent: "root",
        plan: "plan-other"
      })
    ).resolves.toMatchObject({
      task: {
        planRef: "plan-other"
      }
    });

    const childTask = await addTask({
      name: "Aligned child",
      parent: rootTask.task.id
    });

    await expect(
      updateTask({
        id: childTask.task.id,
        plan: "plan-root"
      })
    ).rejects.toThrow(/cannot override the parent task plan/i);
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

  it("serializes concurrent task additions so both changes persist", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    await Promise.all([
      addTask({
        name: "Concurrent task A",
        parent: "root",
        plan: "plan-root"
      }),
      addTask({
        name: "Concurrent task B",
        parent: "root",
        plan: "plan-root"
      })
    ]);

    const tasks = await loadTasks();

    expect(tasks.items).toHaveLength(2);
    expect(tasks.items.map((task) => task.name).sort()).toEqual([
      "Concurrent task A",
      "Concurrent task B"
    ]);
  });

  it("supports the optional --status flag through the CLI and rejects unsupported values", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const added = runTaskCli(
      [
        "task",
        "add",
        "--id",
        "cli-started-task",
        "--name",
        "CLI Started Task",
        "--parent",
        "root",
        "--plan",
        "plan-root",
        "--status",
        "in_progress"
      ],
      fixture.root
    );

    expect(added.status).toBe(0);
    expect(added.stdout).toContain("# Task");
    expect(added.stdout).toContain("`cli-started-task`");
    expect(added.stdout).toContain("Status: `in progress`");

    const invalid = runTaskCli(
      [
        "task",
        "add",
        "--name",
        "CLI Invalid Task",
        "--parent",
        "root",
        "--plan",
        "plan-root",
        "--status",
        "todo"
      ],
      fixture.root
    );

    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toContain("Unsupported task status");
  });

  it("lists tasks with plan context, filters by plan, and shows one task", async () => {
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
          },
          {
            id: "plan-other",
            name: "Other plan",
            summary: "Alternate plan for task inspection checks.",
            parentPlanId: null,
            versionRef: null
          }
        ]
      },
      tasks: {
        items: [
          {
            id: "task-root",
            name: "Root task",
            summary: "Inspect the root task in list and detail views.",
            status: "pending",
            planRef: "plan-root",
            parentTaskId: null,
            countedForProgress: true
          },
          {
            id: "task-other",
            name: "Other task",
            summary: "Task that should be filtered out by plan.",
            status: "pending",
            planRef: "plan-other",
            parentTaskId: null,
            countedForProgress: true
          }
        ]
      }
    });
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const listed = runTaskCli(["task", "list"], fixture.root);
    expect(listed.status).toBe(0);
    expect(listed.stdout).toContain("task-root");
    expect(listed.stdout).toContain("plan: plan-root");

    const filtered = runTaskCli(["task", "list", "--plan", "plan-root", "--details"], fixture.root);
    expect(filtered.status).toBe(0);
    expect(filtered.stdout).toContain("Plan: plan-root (Root plan)");
    expect(filtered.stdout).toContain("task-root");
    expect(filtered.stdout).toContain("summary: Inspect the root task in list and detail views.");
    expect(filtered.stdout).not.toContain("task-other");

    const shown = runTaskCli(["task", "show", "task-root"], fixture.root);
    expect(shown.status).toBe(0);
    expect(shown.stdout).toContain("# Task");
    expect(shown.stdout).toContain("`task-root`");
    expect(shown.stdout).toContain("Plan: `plan-root`");
    expect(shown.stdout).toContain("Inspect the root task in list and detail views.");
  });

  it("filters tasks by owner and status while keeping pinned tasks visible outside the page limit", async () => {
    const fixture = await createWorkspaceFixture({
      owners: {
        items: [
          {
            id: "codex-main",
            name: "Codex Main",
            kind: "agent",
            status: "active",
            aliases: [],
            createdAt: "2026-06-01T00:00:00Z",
            updatedAt: "2026-06-01T00:00:00Z"
          }
        ]
      },
      plans: {
        endGoalRef: "end-goal-test",
        items: [
          {
            id: "plan-root",
            name: "Root plan",
            summary: "Plan owner should be inherited by tasks.",
            parentPlanId: null,
            versionRef: null,
            owner: "codex-main",
            pinned: false,
            pinnedReason: null,
            createdAt: "2026-06-01T00:00:00Z",
            updatedAt: "2026-06-01T00:00:00Z"
          }
        ]
      },
      tasks: {
        items: [
          {
            id: "task-pinned",
            name: "Pinned task",
            summary: "Pinned task should stay visible.",
            status: "in_progress",
            planRef: "plan-root",
            parentTaskId: null,
            countedForProgress: true,
            owner: null,
            pinned: true,
            pinnedReason: "Important context.",
            createdAt: "2026-06-01T00:00:00Z",
            updatedAt: "2026-06-01T00:00:00Z",
            statusChangedAt: "2026-06-01T00:00:00Z"
          },
          {
            id: "task-page",
            name: "Page task",
            summary: "First non-pinned page item.",
            status: "in_progress",
            planRef: "plan-root",
            parentTaskId: null,
            countedForProgress: true,
            owner: null,
            pinned: false,
            pinnedReason: null,
            createdAt: "2026-06-01T00:00:00Z",
            updatedAt: "2026-06-01T00:00:00Z",
            statusChangedAt: "2026-06-01T00:00:00Z"
          },
          {
            id: "task-hidden",
            name: "Hidden task",
            summary: "Hidden by page limit.",
            status: "in_progress",
            planRef: "plan-root",
            parentTaskId: null,
            countedForProgress: true,
            owner: null,
            pinned: false,
            pinnedReason: null,
            createdAt: "2026-06-01T00:00:00Z",
            updatedAt: "2026-06-01T00:00:00Z",
            statusChangedAt: "2026-06-01T00:00:00Z"
          }
        ]
      }
    });
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const listed = runTaskCli(["task", "list", "--owner", "codex-main", "--status", "in_progress", "--limit", "1"], fixture.root);
    const shown = runTaskCli(["task", "show", "task-pinned"], fixture.root);

    expect(listed.status).toBe(0);
    expect(listed.stdout).toContain("## Pinned");
    expect(listed.stdout).toContain("task-pinned");
    expect(listed.stdout).toContain("task-page");
    expect(listed.stdout).not.toContain("task-hidden");
    expect(listed.stdout).toContain("Next cursor: `1`");
    expect(listed.stdout).toContain("owner: codex-main");
    expect(shown.status).toBe(0);
    expect(shown.stdout).toContain("Owner: `codex-main`");
    expect(shown.stdout).toContain("Pinned: yes");
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
