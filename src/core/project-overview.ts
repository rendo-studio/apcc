import { readYamlFile, writeYamlFile } from "./storage.js";
import { getWorkspacePaths } from "./workspace.js";
import { withWorkspaceMutationLock } from "./workspace-mutation.js";
import type { ProjectOverviewState } from "./types.js";

export async function loadProjectOverview(): Promise<ProjectOverviewState> {
  const paths = getWorkspacePaths();
  return readYamlFile<ProjectOverviewState>(paths.projectOverviewFile);
}

export async function saveProjectOverview(input: ProjectOverviewState): Promise<ProjectOverviewState> {
  return withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    await writeYamlFile(paths.projectOverviewFile, input);
    return input;
  });
}

export async function updateProjectOverview(
  input: Partial<ProjectOverviewState>
): Promise<ProjectOverviewState> {
  return withWorkspaceMutationLock(async () => {
    const current = await loadProjectOverview();
    const next = {
      ...current,
      ...input
    };
    const paths = getWorkspacePaths();
    await writeYamlFile(paths.projectOverviewFile, next);
    return next;
  });
}
