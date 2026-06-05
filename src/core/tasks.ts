import { renderBulletList } from "./markdown.js";
import { readYamlFile, writeYamlFile } from "./storage.js";
import { getWorkspacePaths } from "./workspace.js";
import { computeProgress } from "./progress.js";
import { assertControlPlaneId } from "./ids.js";
import { TASK_STATUSES, type DerivedPlansState, type TaskNode, type TasksState, type TaskStatus, type TaskTreeNode } from "./types.js";
import { loadPlans } from "./plans.js";
import { withWorkspaceMutationLock } from "./workspace-mutation.js";

export function normalizeTaskNode(raw: TaskNode): TaskNode {
  return {
    id: raw.id,
    name: raw.name,
    summary: raw.summary ?? null,
    status: raw.status,
    planRef: raw.planRef,
    parentTaskId: raw.parentTaskId ?? null,
    countedForProgress: raw.countedForProgress,
    owner: raw.owner ?? null,
    pinned: Boolean(raw.pinned),
    pinnedReason: raw.pinnedReason ?? null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? null,
    statusChangedAt: raw.statusChangedAt ?? raw.updatedAt ?? raw.createdAt ?? null
  };
}

export function normalizeTasksState(tasks: TasksState): TasksState {
  return {
    items: Array.isArray(tasks.items) ? tasks.items.map(normalizeTaskNode) : []
  };
}

export async function loadTasks(): Promise<TasksState> {
  const paths = getWorkspacePaths();
  return normalizeTasksState(await readYamlFile<TasksState>(paths.taskFile));
}

export async function saveTasks(tasks: TasksState): Promise<void> {
  await withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    await writeYamlFile(paths.taskFile, normalizeTasksState(tasks));
  });
}

function assertTaskPlanAlignment(tasks: TaskNode[]): void {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  for (const task of tasks) {
    if (task.parentTaskId === null) {
      continue;
    }

    const parent = tasksById.get(task.parentTaskId);
    if (!parent) {
      continue;
    }

    if (task.planRef !== parent.planRef) {
      throw new Error(
        `Task ${task.id} must use the same planRef as its parent ${parent.id}. Expected ${parent.planRef}, received ${task.planRef}`
      );
    }
  }
}

export function assertValidTaskTree(tasks: TaskNode[]): void {
  const ids = new Set(tasks.map((task) => task.id));

  if (ids.size !== tasks.length) {
    throw new Error("Task tree contains duplicate task ids");
  }

  for (const task of tasks) {
    assertControlPlaneId(task.id, "Task");
    if (!task.name || task.name.trim().length === 0) {
      throw new Error(`Task ${task.id} is missing name`);
    }
    if (!task.summary || task.summary.trim().length === 0) {
      throw new Error(`Task ${task.id} is missing summary`);
    }
    if (!(TASK_STATUSES as readonly string[]).includes(task.status)) {
      throw new Error(`Task ${task.id} uses unsupported status "${String(task.status)}"`);
    }
    if (!task.planRef || task.planRef.trim().length === 0) {
      throw new Error(`Task ${task.id} is missing planRef`);
    }
    if (typeof task.countedForProgress !== "boolean") {
      throw new Error(`Task ${task.id} must set countedForProgress to true or false`);
    }
    if (task.parentTaskId !== null && !ids.has(task.parentTaskId)) {
      throw new Error(`Task ${task.id} points to missing parent ${task.parentTaskId}`);
    }
  }

  assertTaskPlanAlignment(tasks);
}

export function createTaskId(name: string, siblingCount: number): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug ? `${slug}-${siblingCount + 1}` : `task-${siblingCount + 1}`;
}

function createAvailableTaskId(name: string, siblingCount: number, tasks: TaskNode[]): string {
  const ids = new Set(tasks.map((task) => task.id));
  let nextSiblingCount = siblingCount;
  let id = createTaskId(name, nextSiblingCount);

  while (ids.has(id)) {
    nextSiblingCount += 1;
    id = createTaskId(name, nextSiblingCount);
  }

  return id;
}

function collectDescendantTaskIds(tasks: TaskNode[], taskId: string): string[] {
  const children = tasks.filter((task) => task.parentTaskId === taskId);
  return children.flatMap((child) => [child.id, ...collectDescendantTaskIds(tasks, child.id)]);
}

export async function addTask(input: {
  id?: string;
  name: string;
  parent: string;
  plan?: string;
  summary?: string;
  status?: TaskStatus;
  owner?: string | null;
  pinned?: boolean;
  pinnedReason?: string | null;
}): Promise<{ task: TaskNode; progressPercent: number }> {
  return withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    const [current, plans] = await Promise.all([loadTasks(), loadPlans()]);
    const parentTaskId = input.parent === "root" ? null : input.parent;

    if (parentTaskId !== null && !current.items.some((task) => task.id === parentTaskId)) {
      throw new Error(`Parent task "${input.parent}" does not exist.`);
    }

    const inheritedPlanRef =
      parentTaskId !== null
        ? current.items.find((task) => task.id === parentTaskId)?.planRef
        : undefined;
    if (parentTaskId !== null && input.plan && inheritedPlanRef && input.plan !== inheritedPlanRef) {
      throw new Error(
        `Task "${input.name}" cannot override the parent task plan "${inheritedPlanRef}" with "${input.plan}".`
      );
    }
    const planRef = input.plan ?? inheritedPlanRef;

    if (!planRef) {
      throw new Error(`Task "${input.name}" requires an explicit plan when added at the root level.`);
    }

    if (!plans.items.some((plan) => plan.id === planRef)) {
      throw new Error(`Plan "${planRef}" does not exist.`);
    }

    const siblings = current.items.filter((task) => task.parentTaskId === parentTaskId);
    const id = input.id ?? createAvailableTaskId(input.name, siblings.length, current.items);
    assertControlPlaneId(id, "Task");

    if (current.items.some((task) => task.id === id)) {
      throw new Error(`Task "${id}" already exists.`);
    }

    if (input.status && !(TASK_STATUSES as readonly string[]).includes(input.status)) {
      throw new Error(`Task "${input.name}" uses unsupported status "${String(input.status)}".`);
    }

    const now = new Date().toISOString();
    const task: TaskNode = {
      id,
      name: input.name,
      summary: input.summary ?? input.name,
      status: input.status ?? "pending",
      planRef,
      parentTaskId,
      countedForProgress: true,
      owner: input.owner ?? null,
      pinned: input.pinned ?? false,
      pinnedReason: input.pinnedReason ?? null,
      createdAt: now,
      updatedAt: now,
      statusChangedAt: now
    };

    const next: TasksState = {
      items: [...current.items, task]
    };
    assertValidTaskTree(next.items);
    await writeYamlFile(paths.taskFile, next);
    const progress = computeProgress(next.items);

    return { task, progressPercent: progress.percent };
  });
}

export async function updateTaskStatus(input: {
  id: string;
  status: TaskStatus;
}): Promise<{ task: TaskNode; progressPercent: number }> {
  return updateTask({
    id: input.id,
    status: input.status
  });
}

export async function updateTask(input: {
  id: string;
  name?: string;
  summary?: string;
  status?: TaskStatus;
  parent?: string;
  plan?: string;
  countedForProgress?: boolean;
  owner?: string | null;
  pinned?: boolean;
  pinnedReason?: string | null;
}): Promise<{ task: TaskNode; progressPercent: number }> {
  return withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    const [current, plans] = await Promise.all([loadTasks(), loadPlans()]);
    const index = current.items.findIndex((task) => task.id === input.id);

    if (index === -1) {
      throw new Error(`Task "${input.id}" does not exist.`);
    }

    const currentTask = current.items[index];
    const nextParent =
      input.parent === undefined
        ? currentTask.parentTaskId
        : input.parent === "root"
          ? null
          : input.parent;
    const inheritedPlanRef =
      nextParent !== null
        ? current.items.find((task) => task.id === nextParent)?.planRef
        : undefined;
    if (nextParent !== null && input.plan && inheritedPlanRef && input.plan !== inheritedPlanRef) {
      throw new Error(
        `Task "${input.id}" cannot override the parent task plan "${inheritedPlanRef}" with "${input.plan}".`
      );
    }
    const nextPlanRef = input.plan ?? inheritedPlanRef ?? currentTask.planRef;

    if (nextParent === input.id) {
      throw new Error("A task cannot be its own parent.");
    }

    if (nextParent !== null && !current.items.some((task) => task.id === nextParent)) {
      throw new Error(`Parent task "${nextParent}" does not exist.`);
    }

    if (!plans.items.some((plan) => plan.id === nextPlanRef)) {
      throw new Error(`Plan "${nextPlanRef}" does not exist.`);
    }

    const descendants = new Set(collectDescendantTaskIds(current.items, input.id));
    if (nextParent !== null && descendants.has(nextParent)) {
      throw new Error(`Task "${input.id}" cannot be re-parented under its descendant "${nextParent}".`);
    }

    const now = new Date().toISOString();
    const nextStatus = input.status ?? currentTask.status;
    const updatedTask: TaskNode = {
      ...currentTask,
      ...(input.name ? { name: input.name } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      status: nextStatus,
      ...(input.countedForProgress !== undefined ? { countedForProgress: input.countedForProgress } : {}),
      ...(input.owner !== undefined ? { owner: input.owner } : {}),
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
      ...(input.pinnedReason !== undefined ? { pinnedReason: input.pinnedReason } : {}),
      updatedAt: now,
      statusChangedAt: nextStatus !== currentTask.status ? now : currentTask.statusChangedAt,
      parentTaskId: nextParent,
      planRef: nextPlanRef
    };

    const nextItems = [...current.items];
    nextItems[index] = updatedTask;
    const next: TasksState = { items: nextItems };
    assertValidTaskTree(next.items);
    await writeYamlFile(paths.taskFile, next);
    const progress = computeProgress(next.items);

    return { task: updatedTask, progressPercent: progress.percent };
  });
}

export async function deleteTask(input: {
  id: string;
}): Promise<{ deletedTaskIds: string[]; progressPercent: number }> {
  return withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    const current = await loadTasks();

    if (!current.items.some((task) => task.id === input.id)) {
      throw new Error(`Task "${input.id}" does not exist.`);
    }

    const deletedTaskIds = [input.id, ...collectDescendantTaskIds(current.items, input.id)];
    const next: TasksState = {
      items: current.items.filter((task) => !deletedTaskIds.includes(task.id))
    };

    await writeYamlFile(paths.taskFile, next);
    const progress = computeProgress(next.items);

    return {
      deletedTaskIds,
      progressPercent: progress.percent
    };
  });
}

export function buildTaskTree(tasks: TaskNode[], allowOrphanRoots = false): TaskTreeNode[] {
  const nodes = new Map<string, TaskTreeNode>();
  const roots: TaskTreeNode[] = [];

  for (const task of tasks) {
    nodes.set(task.id, { ...task, children: [] });
  }

  for (const task of tasks) {
    const node = nodes.get(task.id)!;
    if (task.parentTaskId === null) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(task.parentTaskId);
    if (!parent) {
      if (allowOrphanRoots) {
        roots.push(node);
        continue;
      }
      throw new Error(`Task ${task.id} points to missing parent ${task.parentTaskId}`);
    }
    parent.children.push(node);
  }

  return roots;
}

export function renderTaskTreeLines(
  tree: TaskTreeNode[],
  depth = 0,
  options: { details?: boolean; ownerByTaskId?: Map<string, string | null> } = {}
): string[] {
  return tree.flatMap((node) => {
    const prefix = `${"  ".repeat(depth)}- `;
    const owner = options.ownerByTaskId?.get(node.id) ?? node.owner;
    const ownerText = owner ? ` owner: ${owner}` : "";
    const pinned = node.pinned ? " [pinned]" : "";
    const line = `${prefix}${node.name} (${node.id}) [${node.status}]${pinned} plan: ${node.planRef}${ownerText}`;
    const detailLines =
      options.details && node.summary ? [`${"  ".repeat(depth + 1)}summary: ${node.summary}`] : [];
    return [line, ...detailLines, ...renderTaskTreeLines(node.children, depth + 1, options)];
  });
}

export function resolveEffectiveTaskOwner(task: TaskNode, plans: DerivedPlansState): string | null {
  return task.owner ?? plans.items.find((plan) => plan.id === task.planRef)?.effectiveOwner ?? null;
}

export function buildEffectiveTaskOwnerMap(tasks: TaskNode[], plans: DerivedPlansState): Map<string, string | null> {
  return new Map(tasks.map((task) => [task.id, resolveEffectiveTaskOwner(task, plans)]));
}

export function filterTasksByStatus(tasks: TaskNode[], status?: TaskStatus | null): TaskNode[] {
  return status ? tasks.filter((task) => task.status === status) : tasks;
}

export function filterTasksByOwner(
  tasks: TaskNode[],
  plans: DerivedPlansState,
  owner?: string | null
): TaskNode[] {
  if (!owner) {
    return tasks;
  }

  return tasks.filter((task) => resolveEffectiveTaskOwner(task, plans) === owner);
}

export function findNextActions(tasks: TaskNode[]): string[] {
  return tasks
    .filter((task) => task.countedForProgress && task.status !== "done")
    .slice(0, 3)
    .map((task) => task.name);
}

export function summarizeRecentCompleted(tasks: TaskNode[]): string[] {
  return tasks
    .filter((task) => task.countedForProgress && task.status === "done")
    .slice(-4)
    .map((task) => task.name);
}

export function describeBlockers(tasks: TaskNode[]): string[] {
  const blockers = tasks
    .filter((task) => task.status === "blocked")
    .map((task) => task.name);

  return blockers.length > 0 ? blockers : ["暂无明确 blocker"];
}

export function renderCurrentHighLevelPlan(tasks: TaskNode[]): string {
  const roots = buildTaskTree(tasks)
    .filter((task) => task.status !== "done")
    .map((task) => task.name);

  return renderBulletList(roots.length > 0 ? roots : ["当前高层任务已全部完成"]);
}
