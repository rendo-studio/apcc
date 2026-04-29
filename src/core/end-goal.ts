import { readYamlFile, writeYamlFile } from "./storage.js";
import { getWorkspacePaths } from "./workspace.js";
import { withWorkspaceMutationLock } from "./workspace-mutation.js";
import type { GoalState } from "./types.js";

export async function loadEndGoal(): Promise<GoalState> {
  const paths = getWorkspacePaths();
  return readYamlFile<GoalState>(paths.endGoalFile);
}

export async function saveEndGoal(input: GoalState): Promise<GoalState> {
  return withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    await writeYamlFile(paths.endGoalFile, input);
    return input;
  });
}

export async function updateEndGoal(input: Partial<Pick<GoalState, "name" | "summary" | "docPath">>): Promise<GoalState> {
  return withWorkspaceMutationLock(async () => {
    const current = await loadEndGoal();
    const next: GoalState = {
      ...current,
      ...(input.name ? { name: input.name } : {}),
      ...(input.summary ? { summary: input.summary } : {}),
      ...(input.docPath ? { docPath: input.docPath } : {})
    };
    const paths = getWorkspacePaths();
    await writeYamlFile(paths.endGoalFile, next);
    return next;
  });
}
