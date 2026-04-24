import { describeTopLevelPlans, derivePlanStatuses, getCurrentPhase, loadPlans } from "./plans.js";
import { computeProgress } from "./progress.js";
import { loadEndGoal } from "./end-goal.js";
import {
  describeBlockers,
  findNextActions,
  loadTasks
} from "./tasks.js";

export async function getStatusSnapshot() {
  const [endGoal, tasks, plans] = await Promise.all([
    loadEndGoal(),
    loadTasks(),
    loadPlans()
  ]);
  const derivedPlans = derivePlanStatuses(plans, tasks);
  const progress = computeProgress(tasks.items);

  return {
    endGoal,
    phase: getCurrentPhase(derivedPlans),
    progress,
    topLevelPlans: describeTopLevelPlans(derivedPlans),
    nextActions: findNextActions(tasks.items),
    blockers: describeBlockers(tasks.items)
  };
}
