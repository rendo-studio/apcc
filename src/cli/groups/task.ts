import { AclipApp, booleanArgument, stringArgument } from "@rendo-studio/aclip";
import {
  addTask,
  buildEffectiveTaskOwnerMap,
  buildTaskTree,
  deleteTask,
  filterTasksByOwner,
  filterTasksByStatus,
  loadTasks,
  renderTaskTreeLines,
  updateTask
} from "../../core/tasks.js";
import { loadOwners } from "../../core/owners.js";
import { derivePlanStatuses, filterTasksByPlanVersion, loadPlans } from "../../core/plans.js";
import { resolveVersionRecordSelector } from "../../core/version.js";
import { TASK_STATUSES, type DerivedPlansState, type TaskNode } from "../../core/types.js";
import { withGuideHint } from "../guide-hint.js";

const DEFAULT_LIST_LIMIT = 50;

async function resolveVersionFilter(input: {
  version?: string | null;
  unversioned?: boolean | null;
}) {
  if (input.version && input.unversioned) {
    throw new Error("Use either --version or --unversioned, not both.");
  }

  if (input.version) {
    const record = await resolveVersionRecordSelector(input.version);
    return {
      filter: { versionRef: record.id },
      versionRecord: record
    };
  }

  if (input.unversioned) {
    return {
      filter: { unversioned: true },
      versionRecord: null
    };
  }

  return {
    filter: undefined,
    versionRecord: null
  };
}

function parseTaskStatus(value: string): "pending" | "in_progress" | "done" | "blocked" {
  if (!(TASK_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Unsupported task status "${value}".`);
  }

  return value as "pending" | "in_progress" | "done" | "blocked";
}

function getTaskOrThrow(tasks: TaskNode[], id: string): TaskNode {
  const task = tasks.find((item) => item.id === id);
  if (!task) {
    throw new Error(`Task "${id}" does not exist.`);
  }
  return task;
}

function parseNonNegativeInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function paginatePinnedAware<T extends { pinned: boolean }>(
  items: T[],
  input: {
    limit?: string | null;
    cursor?: string | null;
    all?: boolean | null;
  }
) {
  const pinnedItems = items.filter((item) => item.pinned);
  const pageableItems = items.filter((item) => !item.pinned);
  const all = Boolean(input.all);
  const cursor = all ? 0 : input.cursor ? parseNonNegativeInteger(input.cursor, "--cursor") : 0;
  const numericLimit = input.limit ? parsePositiveInteger(input.limit, "--limit") : DEFAULT_LIST_LIMIT;
  const limit = all ? null : numericLimit;
  const pageItems = all ? pageableItems : pageableItems.slice(cursor, cursor + numericLimit);
  const nextOffset = all ? null : cursor + numericLimit;
  const nextCursor = nextOffset !== null && nextOffset < pageableItems.length ? String(nextOffset) : null;
  const shown = pinnedItems.length + pageItems.length;

  return {
    pinnedItems,
    pageItems,
    pageInfo: {
      total: items.length,
      shown,
      pinned: pinnedItems.length,
      hidden: Math.max(items.length - shown, 0),
      limit,
      cursor,
      nextCursor,
      all
    }
  };
}

async function assertOwnerExists(owner: string | null | undefined) {
  if (!owner) {
    return;
  }
  const owners = await loadOwners();
  if (!owners.items.some((item) => item.id === owner)) {
    throw new Error(`Owner "${owner}" does not exist. Run apcc owner list or apcc owner add first.`);
  }
}

function taskOwnerMap(tasks: TaskNode[], plans: DerivedPlansState): Map<string, string | null> {
  return buildEffectiveTaskOwnerMap(tasks, plans);
}

export function registerTaskGroup(app: AclipApp) {
  app
    .group("task", {
      summary: "Manage the structured task tree.",
      description: withGuideHint(
        "Create and inspect tree-shaped tasks that always carry an explicit parent reference."
      )
    })
    .command("add", {
      summary: "Add a task node.",
      description: withGuideHint(
        "Create a task node in the task tree, require an explicit parent marker or root, and optionally set its initial status."
      ),
      arguments: [
        stringArgument("name", {
          required: true,
          description: "Task node name."
        }),
        stringArgument("id", {
          required: false,
          description: "Optional explicit task id. Defaults to a generated id."
        }),
        stringArgument("parent", {
          required: true,
          description: "Parent task id, or root for top-level nodes."
        }),
        stringArgument("plan", {
          required: false,
          description:
            "Optional plan id. Required when creating a root-level task; inherited from the parent task otherwise."
        }),
        stringArgument("summary", {
          required: false,
          description: "Optional task summary. Defaults to the task name."
        }),
        stringArgument("status", {
          required: false,
          description: "Optional initial status: pending, in_progress, done, or blocked."
        }),
        stringArgument("owner", {
          required: false,
          description: "Optional owner id from the owner registry."
        }),
        booleanArgument("pin", {
          required: false,
          description: "Pin this task so it is always shown in progressive list output.",
          flag: "--pin"
        }),
        stringArgument("pinned-reason", {
          required: false,
          description: "Optional reason explaining why this task is pinned.",
          flag: "--pinned-reason"
        })
      ],
      examples: [
        "apcc task add --name 'Wire local site runtime' --parent root --plan implement-local-docs-site-runtime-4",
        "apcc task add --name 'Wire local site runtime' --parent root --plan implement-local-docs-site-runtime-4 --status in_progress",
        "apcc task add --id wire-local-site-runtime --name 'Wire local site runtime' --parent root --plan implement-local-docs-site-runtime-4",
        "apcc task add --name 'Add baseline registry' --parent task-site-runtime"
      ],
      handler: async ({ id, name, parent, plan, summary, status, owner, pin, "pinned-reason": pinnedReason }) => {
        await assertOwnerExists(owner ? String(owner) : null);
        return addTask({
          id: id ? String(id) : undefined,
          name: String(name),
          parent: String(parent),
          plan: plan ? String(plan) : undefined,
          summary: summary ? String(summary) : undefined,
          status: status ? parseTaskStatus(String(status)) : undefined,
          owner: owner ? String(owner) : undefined,
          pinned: Boolean(pin),
          pinnedReason: pinnedReason ? String(pinnedReason) : undefined
        });
      }
    })
    .command("update", {
      summary: "Update a task node.",
      description: withGuideHint(
        "Change task fields such as status, name, summary, parent, plan, and counted-for-progress behavior."
      ),
      arguments: [
        stringArgument("id", {
          required: true,
          description: "Task id."
        }),
        stringArgument("name", {
          required: false,
          description: "Optional replacement name."
        }),
        stringArgument("summary", {
          required: false,
          description: "Optional replacement summary."
        }),
        stringArgument("status", {
          required: false,
          description: "Optional target status: pending, in_progress, done, or blocked."
        }),
        stringArgument("parent", {
          required: false,
          description: "Optional replacement parent task id, or root."
        }),
        stringArgument("plan", {
          required: false,
          description: "Optional replacement plan id."
        }),
        stringArgument("counted-for-progress", {
          required: false,
          description: "Optional true or false flag for progress accounting."
        }),
        stringArgument("owner", {
          required: false,
          description: "Optional replacement owner id.",
          flag: "--owner"
        }),
        booleanArgument("clear-owner", {
          required: false,
          description: "Clear the direct owner id.",
          flag: "--clear-owner"
        }),
        booleanArgument("pin", {
          required: false,
          description: "Pin this task.",
          flag: "--pin"
        }),
        booleanArgument("unpin", {
          required: false,
          description: "Unpin this task.",
          flag: "--unpin"
        }),
        stringArgument("pinned-reason", {
          required: false,
          description: "Optional replacement pinned reason.",
          flag: "--pinned-reason"
        }),
        booleanArgument("clear-pinned-reason", {
          required: false,
          description: "Clear the pinned reason.",
          flag: "--clear-pinned-reason"
        })
      ],
      examples: [
        "apcc task update --id task-2-1 --status in_progress",
        "apcc task update --id task-2-1 --summary 'Track the new console sync behavior.'",
        "apcc task update --id task-2-1 --status done --counted-for-progress false"
      ],
      handler: async (input) => {
        if (
          !input.name &&
          !input.summary &&
          !input.status &&
          !input.parent &&
          !input.plan &&
          input["counted-for-progress"] === undefined &&
          !input.owner &&
          !input["clear-owner"] &&
          !input.pin &&
          !input.unpin &&
          !input["pinned-reason"] &&
          !input["clear-pinned-reason"]
        ) {
          throw new Error(
            "task update requires at least one field to change."
          );
        }
        if (input.owner && input["clear-owner"]) {
          throw new Error("Use either --owner or --clear-owner, not both.");
        }
        if (input.pin && input.unpin) {
          throw new Error("Use either --pin or --unpin, not both.");
        }
        if (input["pinned-reason"] && input["clear-pinned-reason"]) {
          throw new Error("Use either --pinned-reason or --clear-pinned-reason, not both.");
        }

        const nextStatus = input.status ? parseTaskStatus(String(input.status)) : undefined;
        await assertOwnerExists(input.owner ? String(input.owner) : null);

        let countedForProgress: boolean | undefined;
        if (input["counted-for-progress"] !== undefined) {
          const raw = String(input["counted-for-progress"]).toLowerCase();
          if (!["true", "false"].includes(raw)) {
            throw new Error(`Unsupported counted-for-progress value "${raw}". Use true or false.`);
          }
          countedForProgress = raw === "true";
        }

        return updateTask({
          id: String(input.id),
          ...(input.name ? { name: String(input.name) } : {}),
          ...(input.summary ? { summary: String(input.summary) } : {}),
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(input.parent ? { parent: String(input.parent) } : {}),
          ...(input.plan ? { plan: String(input.plan) } : {}),
          ...(countedForProgress !== undefined ? { countedForProgress } : {}),
          ...(input["clear-owner"] ? { owner: null } : input.owner ? { owner: String(input.owner) } : {}),
          ...(input.pin ? { pinned: true } : input.unpin ? { pinned: false } : {}),
          ...(input["clear-pinned-reason"]
            ? { pinnedReason: null }
            : input["pinned-reason"]
              ? { pinnedReason: String(input["pinned-reason"]) }
              : {})
        });
      }
    })
    .command("delete", {
      summary: "Delete a task node.",
      description: withGuideHint("Delete a task node together with all descendant tasks."),
      arguments: [
        stringArgument("id", {
          required: true,
          description: "Task id."
        })
      ],
      examples: ["apcc task delete --id task-2-1"],
      handler: async ({ id }) => {
        return deleteTask({
          id: String(id)
        });
      }
    })
    .command("show", {
      summary: "Show one task.",
      description: withGuideHint("Inspect one task with its plan, parent, progress behavior, and summary."),
      arguments: [
        stringArgument("id", {
          required: true,
          positional: true,
          description: "Task id."
        })
      ],
      examples: ["apcc task show release-check"],
      handler: async ({ id }) => {
        const tasks = await loadTasks();
        const derivedPlans = derivePlanStatuses(await loadPlans(), tasks);
        const ownerByTaskId = taskOwnerMap(tasks.items, derivedPlans);
        const task = getTaskOrThrow(tasks.items, String(id));
        return {
          task,
          effectiveOwner: ownerByTaskId.get(task.id) ?? null
        };
      }
    })
    .command("list", {
      summary: "List the current task tree.",
      description: withGuideHint("Inspect the current tree-shaped task structure."),
      arguments: [
        stringArgument("version", {
          required: false,
          description: "Optional version record id or version label filter.",
          flag: "--version"
        }),
        booleanArgument("unversioned", {
          required: false,
          description: "Only show tasks under plans without an effective version anchor.",
          flag: "--unversioned"
        }),
        stringArgument("plan", {
          required: false,
          description: "Only show tasks attached to the specified plan id.",
          flag: "--plan"
        }),
        stringArgument("status", {
          required: false,
          description: "Optional task status filter.",
          flag: "--status"
        }),
        stringArgument("owner", {
          required: false,
          description: "Only show tasks whose effective owner matches this owner id.",
          flag: "--owner"
        }),
        stringArgument("limit", {
          required: false,
          description: "Maximum non-pinned tasks to show. Defaults to 50.",
          flag: "--limit"
        }),
        stringArgument("cursor", {
          required: false,
          description: "Numeric cursor returned by a previous list command.",
          flag: "--cursor"
        }),
        booleanArgument("all", {
          required: false,
          description: "Show all matching tasks.",
          flag: "--all"
        }),
        booleanArgument("details", {
          required: false,
          description: "Include each listed task summary in addition to status and plan id.",
          flag: "--details"
        })
      ],
      examples: [
        "apcc task list",
        "apcc task list --plan release-hardening",
        "apcc task list --owner codex-main --status in_progress",
        "apcc task list --limit 20",
        "apcc task list --details",
        "apcc task list --version 0.2.0",
        "apcc task list --unversioned",
        "apcc task list --all"
      ],
      handler: async ({ version, unversioned, plan, status, owner, limit, cursor, all, details }) => {
        const resolved = await resolveVersionFilter({
          version: version ? String(version) : null,
          unversioned: Boolean(unversioned)
        });
        const statusFilter = status ? parseTaskStatus(String(status)) : null;
        await assertOwnerExists(owner ? String(owner) : null);
        const tasks = await loadTasks();
        const derivedPlans = derivePlanStatuses(await loadPlans(), tasks);
        const planId = plan ? String(plan) : null;
        if (planId && !derivedPlans.items.some((item) => item.id === planId)) {
          throw new Error(`Plan "${planId}" does not exist.`);
        }
        const versionFilteredTasks = filterTasksByPlanVersion(tasks.items, derivedPlans, resolved.filter);
        const planFilteredTasks = planId
          ? versionFilteredTasks.filter((task) => task.planRef === planId)
          : versionFilteredTasks;
        const filteredTasks = filterTasksByOwner(
          filterTasksByStatus(planFilteredTasks, statusFilter),
          derivedPlans,
          owner ? String(owner) : null
        );
        const paged = paginatePinnedAware<TaskNode>(filteredTasks, {
          limit: limit ? String(limit) : null,
          cursor: cursor ? String(cursor) : null,
          all: Boolean(all)
        });
        const ownerByTaskId = taskOwnerMap(filteredTasks, derivedPlans);
        const tree = buildTaskTree(paged.pageItems, true);
        const pinnedTree = buildTaskTree(paged.pinnedItems, true);
        return {
          tasks: filteredTasks,
          taskTree: tree,
          pinnedLines: renderTaskTreeLines(pinnedTree, 0, { details: Boolean(details), ownerByTaskId }),
          lines: renderTaskTreeLines(tree, 0, { details: Boolean(details), ownerByTaskId }),
          pageInfo: paged.pageInfo,
          planFilter: planId
            ? {
                id: planId,
                name: derivedPlans.items.find((item) => item.id === planId)?.name ?? planId
              }
            : null,
          statusFilter,
          ownerFilter: owner ? { id: String(owner) } : null,
          versionFilter: resolved.versionRecord
            ? {
                id: resolved.versionRecord.id,
                version: resolved.versionRecord.version,
                title: resolved.versionRecord.title
              }
            : resolved.filter?.unversioned
              ? { id: null, version: null, title: "unversioned" }
              : null
        };
      }
    });
}
