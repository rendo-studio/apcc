import { readYamlFile, writeYamlFile } from "./storage.js";
import { getWorkspacePaths } from "./workspace.js";
import type { ProjectOverviewState } from "./types.js";

export async function loadProjectOverview(): Promise<ProjectOverviewState> {
  const paths = getWorkspacePaths();
  return readYamlFile<ProjectOverviewState>(paths.projectOverviewFile);
}

export async function saveProjectOverview(input: ProjectOverviewState): Promise<ProjectOverviewState> {
  const paths = getWorkspacePaths();
  await writeYamlFile(paths.projectOverviewFile, input);
  return input;
}

export async function updateProjectOverview(
  input: Partial<ProjectOverviewState>
): Promise<ProjectOverviewState> {
  const current = await loadProjectOverview();
  return saveProjectOverview({
    ...current,
    ...input
  });
}
