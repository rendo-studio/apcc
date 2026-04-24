import { readYamlFile, writeYamlFile } from "./storage.js";
import { getWorkspacePaths } from "./workspace.js";
import type { GoalState } from "./types.js";

export async function loadEndGoal(): Promise<GoalState> {
  const paths = getWorkspacePaths();
  return readYamlFile<GoalState>(paths.endGoalFile);
}

export async function saveEndGoal(input: GoalState): Promise<GoalState> {
  const paths = getWorkspacePaths();
  await writeYamlFile(paths.endGoalFile, input);
  return input;
}

export async function updateEndGoal(input: Partial<Pick<GoalState, "name" | "summary" | "docPath">>): Promise<GoalState> {
  const current = await loadEndGoal();
  const next: GoalState = {
    ...current,
    ...(input.name ? { name: input.name } : {}),
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.docPath ? { docPath: input.docPath } : {})
  };

  return saveEndGoal(next);
}
