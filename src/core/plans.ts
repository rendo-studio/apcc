import { getWorkspacePaths } from "./workspace.js";
import { readYamlFile, writeYamlFile } from "./storage.js";
import { assertControlPlaneId } from "./ids.js";
import type {
  DerivedPlanNode,
  DerivedPlansState,
  PlanNode,
  PlansState,
  PlanTreeNode,
  TaskNode,
  TaskStatus,
  TasksState
} from "./types.js";

function normalizePlanNode(raw: PlanNode): PlanNode {
  return {
    id: raw.id,
    name: raw.name,
    summary: raw.summary ?? null,
    parentPlanId: raw.parentPlanId ?? null
  };
}

export function normalizePlansState(plans: PlansState): PlansState {
  return {
    endGoalRef: plans.endGoalRef,
    items: plans.items.map(normalizePlanNode)
  };
}

export async function loadPlans(): Promise<PlansState> {
  const paths = getWorkspacePaths();
  const plans = await readYamlFile<PlansState>(paths.planFile);
  return normalizePlansState(plans);
}

export async function savePlans(plans: PlansState): Promise<void> {
  const paths = getWorkspacePaths();
  await writeYamlFile(paths.planFile, normalizePlansState(plans));
}

export function assertValidPlanTree(plans: PlanNode[]): void {
  const ids = new Set(plans.map((plan) => plan.id));

  if (ids.size !== plans.length) {
    throw new Error("Plan tree contains duplicate plan ids");
  }

  for (const plan of plans) {
    assertControlPlaneId(plan.id, "Plan");
    if (!plan.name || plan.name.trim().length === 0) {
      throw new Error(`Plan ${plan.id} is missing name`);
    }
    if (!plan.summary || plan.summary.trim().length === 0) {
      throw new Error(`Plan ${plan.id} is missing summary`);
    }
    if (plan.parentPlanId !== null && !ids.has(plan.parentPlanId)) {
      throw new Error(`Plan ${plan.id} points to missing parent ${plan.parentPlanId}`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const parentById = new Map(plans.map((plan) => [plan.id, plan.parentPlanId]));

  const visit = (id: string) => {
    if (visited.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      throw new Error(`Plan tree contains a cycle at ${id}`);
    }

    visiting.add(id);
    const parentId = parentById.get(id);
    if (parentId) {
      visit(parentId);
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const plan of plans) {
    visit(plan.id);
  }
}

export function createPlanId(name: string, siblingCount: number): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug ? `${slug}-${siblingCount + 1}` : `plan-${siblingCount + 1}`;
}

function createAvailablePlanId(name: string, siblingCount: number, plans: PlanNode[]): string {
  const ids = new Set(plans.map((plan) => plan.id));
  let nextSiblingCount = siblingCount;
  let id = createPlanId(name, nextSiblingCount);

  while (ids.has(id)) {
    nextSiblingCount += 1;
    id = createPlanId(name, nextSiblingCount);
  }

  return id;
}

export function buildPlanTree(plans: DerivedPlanNode[]): PlanTreeNode[] {
  const nodes = new Map<string, PlanTreeNode>();
  const roots: PlanTreeNode[] = [];

  for (const plan of plans) {
    nodes.set(plan.id, { ...plan, children: [] });
  }

  for (const plan of plans) {
    const node = nodes.get(plan.id)!;
    if (plan.parentPlanId === null) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(plan.parentPlanId);
    if (!parent) {
      throw new Error(`Plan ${plan.id} points to missing parent ${plan.parentPlanId}`);
    }
    parent.children.push(node);
  }

  return roots;
}

export function renderPlanTreeLines(tree: PlanTreeNode[], depth = 0): string[] {
  return tree.flatMap((node) => {
    const line = `${"  ".repeat(depth)}- ${node.name} (${node.id}) [${node.status}]`;
    return [line, ...renderPlanTreeLines(node.children, depth + 1)];
  });
}

export function getTopLevelPlans(plans: DerivedPlansState): DerivedPlanNode[] {
  return plans.items.filter((item) => item.parentPlanId === null);
}

export function describeTopLevelPlans(plans: DerivedPlansState): string[] {
  return getTopLevelPlans(plans).map((plan) => `${plan.name} [${plan.status}]`);
}

export function getCurrentPhase(plans: DerivedPlansState): string {
  const topLevel = getTopLevelPlans(plans);
  const active = topLevel.find((plan) => plan.status === "in_progress");
  if (active) {
    return active.name;
  }

  const blocked = topLevel.find((plan) => plan.status === "blocked");
  if (blocked) {
    return `Blocked: ${blocked.name}`;
  }

  const next = topLevel.find((plan) => plan.status === "pending");
  if (next) {
    return `Next: ${next.name}`;
  }

  const completed = topLevel.length > 0 && topLevel.every((plan) => plan.status === "done");
  return completed ? "Completed" : "No active phase";
}

function collectDescendantPlanIds(plans: PlanNode[], planId: string): string[] {
  const children = plans.filter((plan) => plan.parentPlanId === planId);
  return children.flatMap((child) => [child.id, ...collectDescendantPlanIds(plans, child.id)]);
}

export async function deletePlan(input: {
  id: string;
}): Promise<{ deletedPlanIds: string[]; deletedTaskIds: string[]; plans: PlansState }> {
  const paths = getWorkspacePaths();
  const [plans, tasks] = await Promise.all([
    loadPlans(),
    readYamlFile<TasksState>(paths.taskFile)
  ]);
  const current = plans.items.find((plan) => plan.id === input.id);

  if (!current) {
    throw new Error(`Plan "${input.id}" does not exist.`);
  }

  const deletedPlanIds = [input.id, ...collectDescendantPlanIds(plans.items, input.id)];
  const deletedTaskIds = tasks.items
    .filter((task) => deletedPlanIds.includes(task.planRef))
    .map((task) => task.id);

  const nextPlans: PlansState = {
    ...plans,
    items: plans.items.filter((plan) => !deletedPlanIds.includes(plan.id))
  };
  const nextTasks: TasksState = {
    items: tasks.items.filter((task) => !deletedPlanIds.includes(task.planRef))
  };

  assertValidPlanTree(nextPlans.items);
  await Promise.all([savePlans(nextPlans), writeYamlFile(paths.taskFile, nextTasks)]);

  return {
    deletedPlanIds,
    deletedTaskIds,
    plans: nextPlans
  };
}

function derivePlanStatus(tasks: TaskNode[]): TaskStatus {
  const actionableTasks = tasks.filter((task) => task.countedForProgress);
  const relevantTasks = actionableTasks.length > 0 ? actionableTasks : tasks;

  if (relevantTasks.length === 0) {
    return "pending";
  }

  if (relevantTasks.every((task) => task.status === "done")) {
    return "done";
  }

  if (relevantTasks.some((task) => task.status === "blocked")) {
    return "blocked";
  }

  if (relevantTasks.some((task) => task.status === "in_progress")) {
    return "in_progress";
  }

  if (relevantTasks.some((task) => task.status === "done")) {
    return "in_progress";
  }

  return "pending";
}

export function derivePlanStatuses(plans: PlansState, tasks: TasksState): DerivedPlansState {
  const items = plans.items.map((plan) => {
    const relevantPlanIds = new Set([plan.id, ...collectDescendantPlanIds(plans.items, plan.id)]);
    const planTasks = tasks.items.filter((task) => relevantPlanIds.has(task.planRef));

    return {
      ...plan,
      status: derivePlanStatus(planTasks)
    };
  });

  const nextPlans: DerivedPlansState = {
    ...plans,
    items
  };
  assertValidPlanTree(plans.items);
  return nextPlans;
}

export async function addPlan(input: {
  id?: string;
  name: string;
  parent: string;
  summary?: string;
}): Promise<{ plan: PlanNode; plans: PlansState }> {
  const plans = await loadPlans();
  const parentPlanId = input.parent === "root" ? null : input.parent;

  if (parentPlanId !== null && !plans.items.some((plan) => plan.id === parentPlanId)) {
    throw new Error(`Parent plan "${input.parent}" does not exist.`);
  }

  const siblings = plans.items.filter((plan) => plan.parentPlanId === parentPlanId);
  const id = input.id ?? createAvailablePlanId(input.name, siblings.length, plans.items);
  assertControlPlaneId(id, "Plan");

  if (plans.items.some((plan) => plan.id === id)) {
    throw new Error(`Plan "${id}" already exists.`);
  }

  const plan: PlanNode = {
    id,
    name: input.name,
    summary: input.summary ?? input.name,
    parentPlanId
  };

  const next: PlansState = {
    ...plans,
    items: [...plans.items, plan]
  };
  assertValidPlanTree(next.items);
  await savePlans(next);

  return { plan, plans: next };
}

export async function updatePlan(input: {
  id: string;
  name?: string;
  summary?: string;
  parent?: string;
}): Promise<{ plan: PlanNode; plans: PlansState }> {
  const plans = await loadPlans();
  const index = plans.items.findIndex((plan) => plan.id === input.id);

  if (index === -1) {
    throw new Error(`Plan "${input.id}" does not exist.`);
  }

  if (!input.name && input.summary === undefined && input.parent === undefined) {
    throw new Error("Plan update requires at least one of name, summary, or parent.");
  }

  const current = plans.items[index];
  const nextParent =
    input.parent === undefined
      ? current.parentPlanId
      : input.parent === "root"
        ? null
        : input.parent;

  if (nextParent === input.id) {
    throw new Error("A plan cannot be its own parent.");
  }

  const nextItems = [...plans.items];
  nextItems[index] = {
    ...current,
    ...(input.name ? { name: input.name } : {}),
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    parentPlanId: nextParent
  };

  assertValidPlanTree(nextItems);

  const descendants = new Set(collectDescendantPlanIds(nextItems, input.id));
  if (nextParent !== null && descendants.has(nextParent)) {
    throw new Error(`Plan "${input.id}" cannot be re-parented under its descendant "${nextParent}".`);
  }

  const next: PlansState = {
    ...plans,
    items: nextItems
  };
  await savePlans(next);

  return { plan: next.items[index], plans: next };
}
