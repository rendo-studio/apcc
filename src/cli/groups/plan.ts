import { AclipApp, booleanArgument, stringArgument } from "@rendo-studio/aclip";

import {
  addPlan,
  buildPlanTree,
  describePlanTreeRoots,
  derivePlanStatuses,
  deletePlan,
  filterDerivedPlansByVersion,
  loadPlans,
  renderPlanTreeLines,
  updatePlan
} from "../../core/plans.js";
import { loadTasks } from "../../core/tasks.js";
import { resolveVersionRecordSelector } from "../../core/version.js";
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
        }),
        stringArgument("version", {
          required: false,
          description: "Optional version record id or version label to scope the plan.",
          flag: "--version"
        })
      ],
      examples: [
        "apcc plan add --name 'Harden workspace refresh' --parent root",
        "apcc plan add --id harden-workspace-refresh --name 'Harden workspace refresh' --parent root --version 0.2.0",
        "apcc plan add --name 'Add console mutation coverage' --parent harden-workspace-refresh"
      ],
      handler: async ({ id, name, parent, summary, version }) => {
        const versionRecord = version ? await resolveVersionRecordSelector(String(version)) : null;
        const result = await addPlan({
          id: id ? String(id) : undefined,
          name: String(name),
          parent: String(parent),
          summary: summary ? String(summary) : undefined,
          version: versionRecord?.id
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
        }),
        stringArgument("version", {
          required: false,
          description: "Optional replacement version record id or version label.",
          flag: "--version"
        }),
        booleanArgument("clear-version", {
          required: false,
          description: "Remove the direct version anchor from this plan.",
          flag: "--clear-version"
        })
      ],
      examples: [
        "apcc plan update --id harden-workspace-refresh-1 --name 'Harden workspace refresh and console sync'",
        "apcc plan update --id harden-workspace-refresh-1 --version 0.2.0",
        "apcc plan update --id harden-workspace-refresh-1 --clear-version"
      ],
      handler: async ({ id, name, summary, parent, version, "clear-version": clearVersion }) => {
        if (version && clearVersion) {
          throw new Error("Use either --version or --clear-version, not both.");
        }

        const versionRecord = version ? await resolveVersionRecordSelector(String(version)) : null;
        const result = await updatePlan({
          id: String(id),
          name: name ? String(name) : undefined,
          summary: summary ? String(summary) : undefined,
          parent: parent ? String(parent) : undefined,
          ...(clearVersion ? { version: null } : versionRecord ? { version: versionRecord.id } : {})
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
      arguments: [
        stringArgument("version", {
          required: false,
          description: "Optional version record id or version label filter.",
          flag: "--version"
        }),
        booleanArgument("unversioned", {
          required: false,
          description: "Only show plans without an effective version anchor.",
          flag: "--unversioned"
        })
      ],
      examples: ["apcc plan show", "apcc plan show --version 0.2.0", "apcc plan show --unversioned"],
      handler: async ({ version, unversioned }) => {
        const resolved = await resolveVersionFilter({
          version: version ? String(version) : null,
          unversioned: Boolean(unversioned)
        });
        const plans = await loadDerivedPlansForView();
        const filteredPlans = filterDerivedPlansByVersion(plans, resolved.filter);
        const tree = buildPlanTree(filteredPlans, true);
        return {
          plans: {
            ...plans,
            items: filteredPlans
          },
          planTree: tree,
          lines: renderPlanTreeLines(tree),
          topLevelPlans: describePlanTreeRoots(tree),
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
