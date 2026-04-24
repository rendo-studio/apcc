import path from "node:path";

import { resolveWorkspaceRoot } from "./workspace.js";

export function resolveSiteWatchRoots(sourceDocsRoot: string): string[] {
  const watchRoots = new Set<string>([path.resolve(sourceDocsRoot)]);

  try {
    const workspaceRoot = resolveWorkspaceRoot(path.dirname(sourceDocsRoot));
    for (const relative of [".apcc", ".agents"]) {
      watchRoots.add(path.join(workspaceRoot, relative));
    }
  } catch {
    // A docs-only pack can still be watched from its docs root alone.
  }

  return [...watchRoots];
}
