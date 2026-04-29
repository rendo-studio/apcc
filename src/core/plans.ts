import { getWorkspacePaths } from "./workspace.js";
import { readYamlFile, writeYamlFile } from "./storage.js";
import { assertControlPlaneId } from "./ids.js";
import { loadVersionState } from "./version.js";
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
import { withWorkspaceMutationLock } from "./workspace-mutation.js";

export interface VersionScopeFilter {
  versionRef?: string;
  unversioned?: boolean;
}

function normalizePlanNode(raw: PlanNode): PlanNode {
  return {
    id: raw.id,
    name: raw.name,
    summary: raw.summary ?? null,
    parentPlanId: raw.parentPlanId ?? null,
    versionRef: raw.versionRef ?? null
  };
}

function normalizePlanItems(plans: PlanNode[]): PlanNode[] {
  return plans.map(normalizePlanNode);
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
  await withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    await writeYamlFile(paths.planFile, normalizePlansState(plans));
  });
}

function buildChildrenByParent(plans: PlanNode[]): Map<string | null, PlanNode[]> {
  const result = new Map<string | null, PlanNode[]>();

  for (const plan of normalizePlanItems(plans)) {
    const key = plan.parentPlanId ?? null;
    const children = result.get(key) ?? [];
    children.push(plan);
    result.set(key, children);
  }

  return result;
}

function assertConsistentPlanVersionScopes(plans: PlanNode[]): void {
  const childrenByParent = buildChildrenByParent(plans);

  const visit = (parentId: string | null, inheritedVersionRef: string | null) => {
    for (const plan of childrenByParent.get(parentId) ?? []) {
      if (
        plan.versionRef !== null &&
        inheritedVersionRef !== null &&
        plan.versionRef !== inheritedVersionRef
      ) {
        throw new Error(
          `Plan ${plan.id} cannot override inherited version scope ${inheritedVersionRef} with ${plan.versionRef}`
        );
      }

      visit(plan.id, plan.versionRef ?? inheritedVersionRef);
    }
  };

  visit(null, null);
}

export function assertPlanVersionRefsExist(plans: PlanNode[], versionIds: Set<string>): void {
  for (const plan of normalizePlanItems(plans)) {
    if (plan.versionRef !== null && !versionIds.has(plan.versionRef)) {
      throw new Error(`Plan ${plan.id} points to missing version record ${plan.versionRef}`);
    }
  }
}

export function assertValidPlanTree(plans: PlanNode[]): void {
  const normalizedPlans = normalizePlanItems(plans);
  const ids = new Set(normalizedPlans.map((plan) => plan.id));

  if (ids.size !== normalizedPlans.length) {
    throw new Error("Plan tree contains duplicate plan ids");
  }

  for (const plan of normalizedPlans) {
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

  assertConsistentPlanVersionScopes(normalizedPlans);

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const parentById = new Map(normalizedPlans.map((plan) => [plan.id, plan.parentPlanId]));

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

  for (const plan of normalizedPlans) {
    visit(plan.id);
  }
}

function buildEffectivePlanVersionRefs(plans: PlanNode[]): Map<string, string | null> {
  const normalizedPlans = normalizePlanItems(plans);
  const byId = new Map(normalizedPlans.map((plan) => [plan.id, plan]));
  const cache = new Map<string, string | null>();

  const resolve = (planId: string): string | null => {
    if (cache.has(planId)) {
      return cache.get(planId) ?? null;
    }

    const plan = byId.get(planId);
    if (!plan) {
      return null;
    }

    const resolved = plan.versionRef ?? (plan.parentPlanId ? resolve(plan.parentPlanId) : null);
    cache.set(planId, resolved);
    return resolved;
  };

  for (const plan of normalizedPlans) {
    resolve(plan.id);
  }

  return cache;
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

export function buildPlanTree(plans: DerivedPlanNode[], allowOrphanRoots = false): PlanTreeNode[] {
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
      if (allowOrphanRoots) {
        roots.push(node);
        continue;
      }
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

export function describePlanTreeRoots(tree: PlanTreeNode[]): string[] {
  return tree.map((plan) => `${plan.name} [${plan.status}]`);
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
  return withWorkspaceMutationLock(async () => {
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
    await writeYamlFile(paths.planFile, normalizePlansState(nextPlans));
    await writeYamlFile(paths.taskFile, nextTasks);

    return {
      deletedPlanIds,
      deletedTaskIds,
      plans: nextPlans
    };
  });
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
  const effectiveVersionRefs = buildEffectivePlanVersionRefs(plans.items);
  const items = plans.items.map((plan) => {
    const relevantPlanIds = new Set([plan.id, ...collectDescendantPlanIds(plans.items, plan.id)]);
    const planTasks = tasks.items.filter((task) => relevantPlanIds.has(task.planRef));

    return {
      ...plan,
      status: derivePlanStatus(planTasks),
      effectiveVersionRef: effectiveVersionRefs.get(plan.id) ?? null
    };
  });

  const nextPlans: DerivedPlansState = {
    ...plans,
    items
  };
  assertValidPlanTree(plans.items);
  return nextPlans;
}

export function filterDerivedPlansByVersion(
  plans: DerivedPlansState,
  filter?: VersionScopeFilter
): DerivedPlanNode[] {
  if (!filter?.versionRef && !filter?.unversioned) {
    return plans.items;
  }

  return plans.items.filter((plan) =>
    filter.unversioned ? plan.effectiveVersionRef === null : plan.effectiveVersionRef === filter.versionRef
  );
}

export function filterTasksByPlanVersion(
  tasks: TaskNode[],
  plans: DerivedPlansState,
  filter?: VersionScopeFilter
): TaskNode[] {
  if (!filter?.versionRef && !filter?.unversioned) {
    return tasks;
  }

  const planVersionById = new Map(plans.items.map((plan) => [plan.id, plan.effectiveVersionRef]));
  return tasks.filter((task) =>
    filter.unversioned
      ? (planVersionById.get(task.planRef) ?? null) === null
      : planVersionById.get(task.planRef) === filter.versionRef
  );
}

export async function addPlan(input: {
  id?: string;
  name: string;
  parent: string;
  summary?: string;
  version?: string;
}): Promise<{ plan: PlanNode; plans: PlansState }> {
  return withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    const [plans, versions] = await Promise.all([loadPlans(), loadVersionState()]);
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

    if (input.version && !versions.items.some((record) => record.id === input.version)) {
      throw new Error(`Version record "${input.version}" does not exist.`);
    }

    const plan: PlanNode = {
      id,
      name: input.name,
      summary: input.summary ?? input.name,
      parentPlanId,
      versionRef: input.version ?? null
    };

    const next: PlansState = {
      ...plans,
      items: [...plans.items, plan]
    };
    assertValidPlanTree(next.items);
    assertPlanVersionRefsExist(next.items, new Set(versions.items.map((record) => record.id)));
    await writeYamlFile(paths.planFile, normalizePlansState(next));

    return { plan, plans: next };
  });
}

export async function updatePlan(input: {
  id: string;
  name?: string;
  summary?: string;
  parent?: string;
  version?: string | null;
}): Promise<{ plan: PlanNode; plans: PlansState }> {
  return withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    const [plans, versions] = await Promise.all([loadPlans(), loadVersionState()]);
    const index = plans.items.findIndex((plan) => plan.id === input.id);

    if (index === -1) {
      throw new Error(`Plan "${input.id}" does not exist.`);
    }

    if (!input.name && input.summary === undefined && input.parent === undefined && input.version === undefined) {
      throw new Error("Plan update requires at least one of name, summary, parent, or version.");
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

    if (
      input.version !== undefined &&
      input.version !== null &&
      !versions.items.some((record) => record.id === input.version)
    ) {
      throw new Error(`Version record "${input.version}" does not exist.`);
    }

    const nextItems = [...plans.items];
    nextItems[index] = {
      ...current,
      ...(input.name ? { name: input.name } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.version !== undefined ? { versionRef: input.version } : {}),
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
    assertPlanVersionRefsExist(next.items, new Set(versions.items.map((record) => record.id)));
    await writeYamlFile(paths.planFile, normalizePlansState(next));

    return { plan: next.items[index], plans: next };
  });
}
