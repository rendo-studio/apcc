import { derivePlanStatuses, getCurrentPhase, getTopLevelPlans, loadPlans } from "./plans.js";
import { computeProgress } from "./progress.js";
import { loadEndGoal } from "./end-goal.js";
import type { DerivedPlanNode, DerivedPlansState } from "./types.js";
import {
  describeBlockers,
  findNextActions,
  loadTasks
} from "./tasks.js";
import { validateWorkspace } from "./validate.js";

const STATUS_PLAN_LIMIT = 12;

function planStatusLine(plan: DerivedPlanNode): string {
  const pinned = plan.pinned ? " pinned" : "";
  const owner = plan.effectiveOwner ? ` owner: ${plan.effectiveOwner}` : "";
  return `${plan.name} [${plan.status}${pinned}${owner}]`;
}

function describeStatusPlans(plans: DerivedPlansState): string[] {
  const topLevel = getTopLevelPlans(plans);
  const selected: DerivedPlanNode[] = [];
  const seen = new Set<string>();
  const add = (plan: DerivedPlanNode) => {
    if (!seen.has(plan.id) && selected.length < STATUS_PLAN_LIMIT) {
      selected.push(plan);
      seen.add(plan.id);
    }
  };

  for (const plan of topLevel.filter((item) => item.pinned)) {
    add(plan);
  }
  for (const plan of topLevel.filter((item) => item.status === "blocked" || item.status === "in_progress")) {
    add(plan);
  }
  for (const plan of topLevel.filter((item) => item.status === "pending")) {
    add(plan);
  }

  if (selected.length === 0) {
    for (const plan of topLevel) {
      add(plan);
    }
  }

  const hidden = Math.max(topLevel.length - selected.length, 0);
  const lines = selected.map(planStatusLine);
  if (hidden > 0) {
    lines.push(`${hidden} more top-level plan(s) hidden; run apcc plan list --all for the full tree.`);
  }
  return lines;
}

export async function getStatusSnapshot() {
  const [endGoal, tasks, plans, validation] = await Promise.all([
    loadEndGoal(),
    loadTasks(),
    loadPlans(),
    validateWorkspace()
  ]);
  const derivedPlans = derivePlanStatuses(plans, tasks);
  const progress = computeProgress(tasks.items);

  return {
    endGoal,
    phase: getCurrentPhase(derivedPlans),
    progress,
    topLevelPlans: describeStatusPlans(derivedPlans),
    nextActions: findNextActions(tasks.items),
    blockers: describeBlockers(tasks.items),
    reminders: validation.warnings.slice(0, 5)
  };
}
