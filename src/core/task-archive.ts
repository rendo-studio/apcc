import { readYamlFile, writeYamlFile } from "./storage.js";
import { getWorkspacePaths } from "./workspace.js";
import type { TaskArchiveEntry, TaskArchiveState } from "./types.js";

export async function loadTaskArchive(): Promise<TaskArchiveState> {
  try {
    return await readYamlFile<TaskArchiveState>(getWorkspacePaths().taskArchiveFile);
  } catch {
    return { items: [] };
  }
}

export async function saveTaskArchive(state: TaskArchiveState): Promise<void> {
  await writeYamlFile(getWorkspacePaths().taskArchiveFile, state);
}

export function sortArchivedTasks(items: TaskArchiveEntry[]): TaskArchiveEntry[] {
  return [...items].sort((left, right) => right.closedAt.localeCompare(left.closedAt));
}
