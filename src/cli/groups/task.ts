import { AclipApp, stringArgument } from "@rendo-studio/aclip";
import {
  addTask,
  buildTaskTree,
  deleteTask,
  loadTasks,
  renderTaskTreeLines,
  updateTask
} from "../../core/tasks.js";
import { TASK_STATUSES } from "../../core/types.js";
import { withGuideHint } from "../guide-hint.js";

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
        "Create a task node in the task tree and require an explicit parent marker or root."
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
        })
      ],
      examples: [
        "apcc task add --name 'Wire local site runtime' --parent root --plan implement-local-docs-site-runtime-4",
        "apcc task add --id wire-local-site-runtime --name 'Wire local site runtime' --parent root --plan implement-local-docs-site-runtime-4",
        "apcc task add --name 'Add baseline registry' --parent task-site-runtime"
      ],
      handler: async ({ id, name, parent, plan, summary }) => {
        return addTask({
          id: id ? String(id) : undefined,
          name: String(name),
          parent: String(parent),
          plan: plan ? String(plan) : undefined,
          summary: summary ? String(summary) : undefined
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
          input["counted-for-progress"] === undefined
        ) {
          throw new Error(
            "task update requires at least one of --name, --summary, --status, --parent, --plan, or --counted-for-progress."
          );
        }

        const nextStatus = input.status ? String(input.status) : undefined;
        if (nextStatus && !(TASK_STATUSES as readonly string[]).includes(nextStatus)) {
          throw new Error(`Unsupported task status "${nextStatus}".`);
        }

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
          ...(nextStatus ? { status: nextStatus as "pending" | "in_progress" | "done" | "blocked" } : {}),
          ...(input.parent ? { parent: String(input.parent) } : {}),
          ...(input.plan ? { plan: String(input.plan) } : {}),
          ...(countedForProgress !== undefined ? { countedForProgress } : {})
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
    .command("list", {
      summary: "List the current task tree.",
      description: withGuideHint("Inspect the current tree-shaped task structure."),
      examples: ["apcc task list"],
      handler: async () => {
        const tasks = await loadTasks();
        const tree = buildTaskTree(tasks.items);
        return {
          tasks: tasks.items,
          taskTree: tree,
          lines: renderTaskTreeLines(tree)
        };
      }
    });
}
