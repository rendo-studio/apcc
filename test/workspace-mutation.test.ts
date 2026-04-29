import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { getWorkspaceMutationLockDir } from "../src/core/runtime-paths.js";
import { withWorkspaceMutationLock } from "../src/core/workspace-mutation.js";
import { createWorkspaceFixture } from "./helpers/workspace.js";

const restorers: Array<() => void> = [];
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (restorers.length > 0) {
    restorers.pop()?.();
  }

  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function useRuntimeBase(runtimeBase: string) {
  const previous = process.env.APCC_SITE_RUNTIME_BASE;
  process.env.APCC_SITE_RUNTIME_BASE = runtimeBase;
  restorers.push(() => {
    if (previous === undefined) {
      delete process.env.APCC_SITE_RUNTIME_BASE;
      return;
    }
    process.env.APCC_SITE_RUNTIME_BASE = previous;
  });
}

async function waitForChild(child: ReturnType<typeof spawn>, label: string): Promise<void> {
  const stderr: string[] = [];
  const stdout: string[] = [];

  child.stdout?.on("data", (chunk) => {
    stdout.push(String(chunk));
  });
  child.stderr?.on("data", (chunk) => {
    stderr.push(String(chunk));
  });

  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          [
            `${label} exited with code ${code ?? "unknown"}`,
            stdout.join("").trim(),
            stderr.join("").trim()
          ]
            .filter(Boolean)
            .join("\n")
        )
      );
    });
  });
}

describe("workspace mutation lock", () => {
  it("allows nested mutation sections inside the same async flow", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);
    useRuntimeBase(path.join(fixture.root, ".runtime"));

    const events: string[] = [];

    await withWorkspaceMutationLock(
      async () => {
        events.push("outer-start");
        await withWorkspaceMutationLock(
          async () => {
            events.push("inner");
          },
          { root: fixture.root }
        );
        events.push("outer-end");
      },
      { root: fixture.root }
    );

    expect(events).toEqual(["outer-start", "inner", "outer-end"]);
  });

  it("serializes concurrent mutation attempts in the same process", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);
    useRuntimeBase(path.join(fixture.root, ".runtime"));

    const events: string[] = [];

    const first = withWorkspaceMutationLock(
      async () => {
        events.push("first-start");
        await delay(200);
        events.push("first-end");
      },
      { root: fixture.root }
    );

    await delay(25);

    const second = withWorkspaceMutationLock(
      async () => {
        events.push("second-start");
        events.push("second-end");
      },
      { root: fixture.root }
    );

    await Promise.all([first, second]);

    expect(events).toEqual(["first-start", "first-end", "second-start", "second-end"]);
  });

  it("reclaims a stale lock owned by a dead pid", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);
    const runtimeBase = path.join(fixture.root, ".runtime");
    useRuntimeBase(runtimeBase);

    const lockDir = getWorkspaceMutationLockDir(fixture.root, runtimeBase);
    await fs.mkdir(lockDir, { recursive: true });
    await fs.writeFile(
      path.join(lockDir, "owner.json"),
      `${JSON.stringify(
        {
          pid: 999999,
          cwd: fixture.root,
          command: "apcc task add",
          root: fixture.root,
          acquiredAt: new Date().toISOString()
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = await withWorkspaceMutationLock(
      async () => "ok",
      { root: fixture.root, waitTimeoutMs: 500, pollIntervalMs: 25 }
    );

    expect(result).toBe("ok");
    await expect(fs.stat(lockDir)).rejects.toThrow();
  });

  it("serializes mutations across separate Node processes", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);
    const runtimeBase = path.join(fixture.root, ".runtime");
    useRuntimeBase(runtimeBase);

    const logFile = path.join(fixture.root, "mutation-order.log");
    const workerModuleUrl = pathToFileURL(path.join(process.cwd(), "src", "core", "workspace-mutation.ts")).href;
    const workerSource = [
      "const [moduleUrl, root, logFile, holdMs, label] = process.argv.slice(1);",
      "const { appendFile } = await import('node:fs/promises');",
      "const { withWorkspaceMutationLock } = await import(moduleUrl);",
      "await withWorkspaceMutationLock(async () => {",
      "  await appendFile(logFile, `${label}-start\\n`, 'utf8');",
      "  await new Promise((resolve) => setTimeout(resolve, Number(holdMs)));",
      "  await appendFile(logFile, `${label}-end\\n`, 'utf8');",
      "}, { root });"
    ].join(" ");

    const spawnWorker = (label: string, holdMs: number) =>
      spawn(process.execPath, ["--import", "tsx", "-e", workerSource, workerModuleUrl, fixture.root, logFile, String(holdMs), label], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          APCC_SITE_RUNTIME_BASE: runtimeBase,
          APCC_WORKSPACE_ROOT: fixture.root
        },
        stdio: ["ignore", "pipe", "pipe"]
      });

    const first = spawnWorker("first", 250);
    await delay(50);
    const second = spawnWorker("second", 10);

    await Promise.all([waitForChild(first, "first worker"), waitForChild(second, "second worker")]);

    const lines = (await fs.readFile(logFile, "utf8"))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines).toEqual(["first-start", "first-end", "second-start", "second-end"]);
  });
});
