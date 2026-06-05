import { AclipApp, booleanArgument, stringArgument } from "@rendo-studio/aclip";

import {
  addPlan,
  buildPlanTree,
  describePlanTreeRoots,
  derivePlanStatuses,
  deletePlan,
  filterDerivedPlansByOwner,
  filterDerivedPlansByStatus,
  filterDerivedPlansByVersion,
  loadPlans,
  renderPlanTreeLines,
  updatePlan
} from "../../core/plans.js";
import { loadTasks } from "../../core/tasks.js";
import { loadOwners } from "../../core/owners.js";
import { resolveVersionRecordSelector } from "../../core/version.js";
import { TASK_STATUSES, type DerivedPlanNode, type TaskStatus } from "../../core/types.js";
import { withGuideHint } from "../guide-hint.js";

const DEFAULT_LIST_LIMIT = 50;

async function loadDerivedPlansForView(
  plansState?: Awaited<ReturnType<typeof loadPlans>>
) {
  const [plans, tasks] = await Promise.all([
    plansState ? Promise.resolve(plansState) : loadPlans(),
    loadTasks()
  ]);

  return derivePlanStatuses(plans, tasks);
}

function parseTaskStatus(value: string): TaskStatus {
  if (!(TASK_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Unsupported status "${value}". Use ${TASK_STATUSES.join(", ")}.`);
  }
  return value as TaskStatus;
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
): {
  pinnedItems: T[];
  pageItems: T[];
  pageInfo: {
    total: number;
    shown: number;
    pinned: number;
    hidden: number;
    limit: number | null;
    cursor: number;
    nextCursor: string | null;
    all: boolean;
  };
} {
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
        }),
        stringArgument("owner", {
          required: false,
          description: "Optional owner id from the owner registry."
        }),
        booleanArgument("pin", {
          required: false,
          description: "Pin this plan so it is always shown in progressive list output.",
          flag: "--pin"
        }),
        stringArgument("pinned-reason", {
          required: false,
          description: "Optional reason explaining why this plan is pinned.",
          flag: "--pinned-reason"
        })
      ],
      examples: [
        "apcc plan add --name 'Harden workspace refresh' --parent root",
        "apcc plan add --id harden-workspace-refresh --name 'Harden workspace refresh' --parent root --version 0.2.0",
        "apcc plan add --name 'Add console mutation coverage' --parent harden-workspace-refresh"
      ],
      handler: async ({ id, name, parent, summary, version, owner, pin, "pinned-reason": pinnedReason }) => {
        const versionRecord = version ? await resolveVersionRecordSelector(String(version)) : null;
        await assertOwnerExists(owner ? String(owner) : null);
        const result = await addPlan({
          id: id ? String(id) : undefined,
          name: String(name),
          parent: String(parent),
          summary: summary ? String(summary) : undefined,
          version: versionRecord?.id,
          owner: owner ? String(owner) : undefined,
          pinned: Boolean(pin),
          pinnedReason: pinnedReason ? String(pinnedReason) : undefined
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
          description: "Pin this plan.",
          flag: "--pin"
        }),
        booleanArgument("unpin", {
          required: false,
          description: "Unpin this plan.",
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
        "apcc plan update --id harden-workspace-refresh-1 --name 'Harden workspace refresh and console sync'",
        "apcc plan update --id harden-workspace-refresh-1 --version 0.2.0",
        "apcc plan update --id harden-workspace-refresh-1 --clear-version"
      ],
      handler: async ({
        id,
        name,
        summary,
        parent,
        version,
        "clear-version": clearVersion,
        owner,
        "clear-owner": clearOwner,
        pin,
        unpin,
        "pinned-reason": pinnedReason,
        "clear-pinned-reason": clearPinnedReason
      }) => {
        if (version && clearVersion) {
          throw new Error("Use either --version or --clear-version, not both.");
        }
        if (owner && clearOwner) {
          throw new Error("Use either --owner or --clear-owner, not both.");
        }
        if (pin && unpin) {
          throw new Error("Use either --pin or --unpin, not both.");
        }
        if (pinnedReason && clearPinnedReason) {
          throw new Error("Use either --pinned-reason or --clear-pinned-reason, not both.");
        }

        const versionRecord = version ? await resolveVersionRecordSelector(String(version)) : null;
        await assertOwnerExists(owner ? String(owner) : null);
        const result = await updatePlan({
          id: String(id),
          name: name ? String(name) : undefined,
          summary: summary ? String(summary) : undefined,
          parent: parent ? String(parent) : undefined,
          ...(clearVersion ? { version: null } : versionRecord ? { version: versionRecord.id } : {}),
          ...(clearOwner ? { owner: null } : owner ? { owner: String(owner) } : {}),
          ...(pin ? { pinned: true } : unpin ? { pinned: false } : {}),
          ...(clearPinnedReason ? { pinnedReason: null } : pinnedReason ? { pinnedReason: String(pinnedReason) } : {})
        });
        const plans = await loadDerivedPlansForView(result.plans);

        return {
          plan: plans.items.find((plan) => plan.id === result.plan.id) ?? result.plan
        };
      }
    })
    .command("list", {
      summary: "List the current plan tree.",
      description: withGuideHint("List the current structured plan tree."),
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
        }),
        stringArgument("status", {
          required: false,
          description: "Optional derived plan status filter.",
          flag: "--status"
        }),
        stringArgument("owner", {
          required: false,
          description: "Only show plans whose effective owner matches this owner id.",
          flag: "--owner"
        }),
        stringArgument("limit", {
          required: false,
          description: "Maximum non-pinned plans to show. Defaults to 50.",
          flag: "--limit"
        }),
        stringArgument("cursor", {
          required: false,
          description: "Numeric cursor returned by a previous list command.",
          flag: "--cursor"
        }),
        booleanArgument("all", {
          required: false,
          description: "Show all matching plans.",
          flag: "--all"
        })
      ],
      examples: [
        "apcc plan list",
        "apcc plan list --owner codex-main",
        "apcc plan list --status in_progress --limit 20",
        "apcc plan list --version 0.2.0",
        "apcc plan list --unversioned",
        "apcc plan list --all"
      ],
      handler: async ({ version, unversioned, status, owner, limit, cursor, all }) => {
        const resolved = await resolveVersionFilter({
          version: version ? String(version) : null,
          unversioned: Boolean(unversioned)
        });
        const statusFilter = status ? parseTaskStatus(String(status)) : null;
        await assertOwnerExists(owner ? String(owner) : null);
        const plans = await loadDerivedPlansForView();
        const filteredPlans = filterDerivedPlansByOwner(
          filterDerivedPlansByStatus(filterDerivedPlansByVersion(plans, resolved.filter), statusFilter),
          owner ? String(owner) : null
        );
        const paged = paginatePinnedAware<DerivedPlanNode>(filteredPlans, {
          limit: limit ? String(limit) : null,
          cursor: cursor ? String(cursor) : null,
          all: Boolean(all)
        });
        const tree = buildPlanTree(paged.pageItems, true);
        const pinnedTree = buildPlanTree(paged.pinnedItems, true);
        return {
          plans: {
            ...plans,
            items: filteredPlans
          },
          planTree: tree,
          pinnedLines: renderPlanTreeLines(pinnedTree),
          lines: renderPlanTreeLines(tree),
          topLevelPlans: describePlanTreeRoots(tree),
          pageInfo: paged.pageInfo,
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
