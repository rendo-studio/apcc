import { AclipApp, stringArgument } from "@rendo-studio/aclip";

import {
  addPlan,
  buildPlanTree,
  derivePlanStatuses,
  deletePlan,
  describeTopLevelPlans,
  loadPlans,
  renderPlanTreeLines,
  updatePlan
} from "../../core/plans.js";
import { loadTasks } from "../../core/tasks.js";
import { withGuideHint } from "../guide-hint.js";

async function loadDerivedPlansForView(
  plansState?: Awaited<ReturnType<typeof loadPlans>>
) {
  const [plans, tasks] = await Promise.all([
    plansState ? Promise.resolve(plansState) : loadPlans(),
    loadTasks()
  ]);

  return derivePlanStatuses(plans, tasks);
}

export function registerPlanGroup(app: AclipApp) {
  app
    .group("plan", {
      summary: "Inspect the plan tree.",
      description: withGuideHint(
        "Read the current structured plan tree and its top-level execution phases."
      )
    })
    .command("add", {
      summary: "Add a plan node.",
      description: withGuideHint(
        "Create a plan node in the structured plan tree with an explicit parent marker or root."
      ),
      arguments: [
        stringArgument("name", {
          required: true,
          description: "Plan node name."
        }),
        stringArgument("id", {
          required: false,
          description: "Optional explicit plan id. Defaults to a generated id."
        }),
        stringArgument("parent", {
          required: true,
          description: "Parent plan id, or root for top-level plans."
        }),
        stringArgument("summary", {
          required: false,
          description: "Optional plan summary. Defaults to the plan name."
        })
      ],
      examples: [
        "apcc plan add --name 'Harden workspace refresh' --parent root",
        "apcc plan add --id harden-workspace-refresh --name 'Harden workspace refresh' --parent root",
        "apcc plan add --name 'Add console mutation coverage' --parent harden-workspace-refresh"
      ],
      handler: async ({ id, name, parent, summary }) => {
        const result = await addPlan({
          id: id ? String(id) : undefined,
          name: String(name),
          parent: String(parent),
          summary: summary ? String(summary) : undefined
        });
        const plans = await loadDerivedPlansForView(result.plans);

        return {
          plan: plans.items.find((plan) => plan.id === result.plan.id) ?? result.plan
        };
      }
    })
    .command("update", {
      summary: "Update a plan node.",
      description: withGuideHint(
        "Rename, re-parent, or edit a plan node in the structured plan tree."
      ),
      arguments: [
        stringArgument("id", {
          required: true,
          description: "Plan id."
        }),
        stringArgument("name", {
          required: false,
          description: "Optional replacement name."
        }),
        stringArgument("summary", {
          required: false,
          description: "Optional replacement summary."
        }),
        stringArgument("parent", {
          required: false,
          description: "Optional replacement parent id, or root."
        })
      ],
      examples: [
        "apcc plan update --id harden-workspace-refresh-1 --name 'Harden workspace refresh and console sync'"
      ],
      handler: async ({ id, name, summary, parent }) => {
        const result = await updatePlan({
          id: String(id),
          name: name ? String(name) : undefined,
          summary: summary ? String(summary) : undefined,
          parent: parent ? String(parent) : undefined
        });
        const plans = await loadDerivedPlansForView(result.plans);

        return {
          plan: plans.items.find((plan) => plan.id === result.plan.id) ?? result.plan
        };
      }
    })
    .command("show", {
      summary: "Show the current plan tree.",
      description: withGuideHint("Inspect the current structured plan tree."),
      examples: ["apcc plan show"],
      handler: async () => {
        const plans = await loadDerivedPlansForView();
        const tree = buildPlanTree(plans.items);
        return {
          plans,
          planTree: tree,
          lines: renderPlanTreeLines(tree),
          topLevelPlans: describeTopLevelPlans(plans)
        };
      }
    })
    .command("delete", {
      summary: "Delete a plan node.",
      description: withGuideHint(
        "Delete a plan node, all descendant plans, and any tasks attached to the removed plan subtree."
      ),
      arguments: [
        stringArgument("id", {
          required: true,
          description: "Plan id."
        })
      ],
      examples: ["apcc plan delete --id harden-workspace-refresh-1"],
      handler: async ({ id }) => {
        const result = await deletePlan({
          id: String(id)
        });
        return {
          deletedPlanIds: result.deletedPlanIds,
          deletedTaskIds: result.deletedTaskIds
        };
      }
    });
}
