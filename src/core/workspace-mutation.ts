import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs/promises";
import path from "node:path";

import { getWorkspaceMutationLockDir } from "./runtime-paths.js";
import { resolveWorkspaceRoot } from "./workspace.js";

const mutationContext = new AsyncLocalStorage<Set<string>>();

const DEFAULT_WAIT_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_INTERVAL_MS = 100;
const OWNERLESS_LOCK_STALE_MS = 5_000;

interface WorkspaceMutationLockOwner {
  pid: number;
  cwd: string;
  command: string;
  root: string;
  acquiredAt: string;
}

interface WorkspaceMutationLockOptions {
  root?: string;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
}

export class WorkspaceMutationLockError extends Error {
  readonly root: string;
  readonly waitedMs: number;
  readonly owner: WorkspaceMutationLockOwner | null;

  constructor(root: string, waitedMs: number, owner: WorkspaceMutationLockOwner | null) {
    super(buildLockErrorMessage(root, waitedMs, owner));
    this.name = "WorkspaceMutationLockError";
    this.root = root;
    this.waitedMs = waitedMs;
    this.owner = owner;
  }
}

function buildLockErrorMessage(root: string, waitedMs: number, owner: WorkspaceMutationLockOwner | null): string {
  if (!owner) {
    return `APCC workspace mutation lock is busy for ${root}. Waited ${waitedMs}ms for another mutation to finish.`;
  }

  return `APCC workspace mutation lock is busy for ${root}. Waited ${waitedMs}ms for pid ${owner.pid} (${owner.command}) started at ${owner.acquiredAt}.`;
}

function resolveMutationRoot(root?: string): string {
  return root ? path.resolve(root) : resolveWorkspaceRoot(process.cwd());
}

function getOwnerFile(lockDir: string): string {
  return path.join(lockDir, "owner.json");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function processExists(pid: number | null | undefined): boolean {
  if (!pid || !Number.isFinite(pid)) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error)) {
      return false;
    }

    return error.code !== "ESRCH";
  }
}

async function readOwner(ownerFile: string): Promise<WorkspaceMutationLockOwner | null> {
  try {
    const content = await fs.readFile(ownerFile, "utf8");
    const parsed = JSON.parse(content) as Partial<WorkspaceMutationLockOwner>;
    if (
      typeof parsed.pid === "number" &&
      typeof parsed.cwd === "string" &&
      typeof parsed.command === "string" &&
      typeof parsed.root === "string" &&
      typeof parsed.acquiredAt === "string"
    ) {
      return parsed as WorkspaceMutationLockOwner;
    }
    return null;
  } catch {
    return null;
  }
}

async function removeLockDir(lockDir: string): Promise<void> {
  await fs.rm(lockDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 });
}

async function reclaimStaleLock(lockDir: string, ownerFile: string): Promise<boolean> {
  const owner = await readOwner(ownerFile);
  if (owner) {
    if (!processExists(owner.pid)) {
      await removeLockDir(lockDir);
      return true;
    }
    return false;
  }

  try {
    const stat = await fs.stat(lockDir);
    if (Date.now() - stat.mtimeMs > OWNERLESS_LOCK_STALE_MS) {
      await removeLockDir(lockDir);
      return true;
    }
  } catch {
    return true;
  }

  return false;
}

async function acquireWorkspaceMutationLock(root: string, options: WorkspaceMutationLockOptions) {
  const waitTimeoutMs = options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const lockDir = getWorkspaceMutationLockDir(root);
  const ownerFile = getOwnerFile(lockDir);
  const startedAt = Date.now();

  await fs.mkdir(path.dirname(lockDir), { recursive: true });

  while (true) {
    try {
      await fs.mkdir(lockDir, { recursive: false });
      const owner: WorkspaceMutationLockOwner = {
        pid: process.pid,
        cwd: process.cwd(),
        command: process.argv.join(" "),
        root,
        acquiredAt: new Date().toISOString()
      };

      try {
        await fs.writeFile(ownerFile, `${JSON.stringify(owner, null, 2)}\n`, "utf8");
      } catch (error) {
        await removeLockDir(lockDir);
        throw error;
      }

      return async () => {
        await removeLockDir(lockDir);
      };
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }

      const reclaimed = await reclaimStaleLock(lockDir, ownerFile);
      if (reclaimed) {
        continue;
      }

      const waitedMs = Date.now() - startedAt;
      if (waitedMs >= waitTimeoutMs) {
        throw new WorkspaceMutationLockError(root, waitedMs, await readOwner(ownerFile));
      }

      await delay(pollIntervalMs);
    }
  }
}

export async function withWorkspaceMutationLock<T>(
  work: () => Promise<T>,
  options: WorkspaceMutationLockOptions = {}
): Promise<T> {
  const root = resolveMutationRoot(options.root);
  const heldRoots = mutationContext.getStore();

  if (heldRoots?.has(root)) {
    return work();
  }

  const release = await acquireWorkspaceMutationLock(root, options);
  const nextHeldRoots = new Set(heldRoots ?? []);
  nextHeldRoots.add(root);

  try {
    return await mutationContext.run(nextHeldRoots, work);
  } finally {
    await release();
  }
}
