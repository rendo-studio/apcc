import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

export function getApccRuntimeBase(): string {
  const override = process.env.APCC_SITE_RUNTIME_BASE;
  if (override) {
    return path.resolve(override);
  }

  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "APCC", "runtime");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "APCC", "runtime");
  }

  return path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state"), "apcc", "runtime");
}

function normalizeWorkspaceRootForRuntimeId(root: string): string {
  const resolved = path.resolve(root);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function createWorkspaceRuntimeId(root: string): string {
  return crypto
    .createHash("sha256")
    .update(normalizeWorkspaceRootForRuntimeId(root))
    .digest("hex")
    .slice(0, 16);
}

export function getWorkspaceMutationLockDir(root: string, runtimeBase = getApccRuntimeBase()): string {
  return path.join(runtimeBase, "workspace-locks", createWorkspaceRuntimeId(root), "mutation.lock");
}
