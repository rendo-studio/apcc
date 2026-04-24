import fs from "node:fs/promises";
import path from "node:path";

import { stageDocsForSiteRuntime } from "./site.js";
import { writeText } from "./storage.js";
import { resolveSiteWatchRoots } from "./site-watch-roots.js";

const sourceDocsRoot = process.argv[2];
const runtimeRoot = process.argv[3];

if (!sourceDocsRoot) {
  throw new Error("site-watch-worker requires a docs root path argument.");
}

const watchRoots = resolveSiteWatchRoots(sourceDocsRoot);
const readyFile = runtimeRoot ? path.join(runtimeRoot, "runtime-data", "site-watch.ready") : null;
let closed = false;
let pending = false;
let currentRun: Promise<void> | null = null;

async function snapshotRoot(root: string, base = root): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") {
      continue;
    }

    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await snapshotRoot(absolutePath, base)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stats = await fs.stat(absolutePath).catch(() => null);
    if (!stats) {
      continue;
    }

    files.push(`${path.relative(base, absolutePath).replace(/\\/g, "/")}:${stats.size}:${stats.mtimeMs}`);
  }

  return files.sort();
}

async function computeSnapshot(): Promise<string> {
  const payload = await Promise.all(
    watchRoots.map(async (root) => {
      const absoluteRoot = path.resolve(root);
      const stats = await fs.stat(absoluteRoot).catch(() => null);
      if (!stats?.isDirectory()) {
        return `${absoluteRoot}:missing`;
      }

      const files = await snapshotRoot(absoluteRoot);
      return `${absoluteRoot}\n${files.join("\n")}`;
    })
  );

  return payload.join("\n---\n");
}

async function restage(): Promise<void> {
  if (closed || pending) {
    return;
  }

  pending = true;
  try {
    console.error("[APCC site-watch-worker] change detected, restaging runtime data");
    await stageDocsForSiteRuntime(sourceDocsRoot, { syncDocs: true });
    console.error("[APCC site-watch-worker] restage complete");
  } catch (error) {
    console.error("[APCC site-watch-worker] restage failed", error);
  } finally {
    pending = false;
  }
}

async function pollLoop() {
  let previousSnapshot = await computeSnapshot();

  while (!closed) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (closed) {
      break;
    }

    const nextSnapshot = await computeSnapshot();
    if (nextSnapshot === previousSnapshot) {
      continue;
    }

    previousSnapshot = nextSnapshot;
    currentRun = restage();
    await currentRun;
    currentRun = null;
  }
}

console.error(
  `[APCC site-watch-worker] polling ${watchRoots
    .map((root) => path.resolve(root))
    .join(", ")}`
);

if (readyFile) {
  await writeText(
    readyFile,
    `${JSON.stringify(
      {
        readyAt: new Date().toISOString(),
        watchRoots: watchRoots.map((root) => path.resolve(root))
      },
      null,
      2
    )}\n`
  );
}

const stop = async () => {
  closed = true;
  await currentRun?.catch(() => undefined);
};

process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});

void pollLoop();
