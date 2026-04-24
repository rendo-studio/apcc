import type { ProgressState, TaskNode } from "./types.js";

export function computeProgress(tasks: TaskNode[]): ProgressState {
  const countedTasks = tasks.filter((task) => task.countedForProgress);
  const doneTasks = countedTasks.filter((task) => task.status === "done");
  const percent =
    countedTasks.length === 0
      ? 0
      : Math.round((doneTasks.length / countedTasks.length) * 100);

  return {
    percent,
    countedTasks: countedTasks.length,
    doneTasks: doneTasks.length,
    computedAt: new Date().toISOString()
  };
}
