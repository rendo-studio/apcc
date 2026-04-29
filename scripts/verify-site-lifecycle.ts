import assert from "node:assert/strict";
import fs from "node:fs/promises";
import nodeFs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import { initWorkspace } from "../src/core/bootstrap.js";
import {
  buildSiteRuntime,
  cleanSiteRuntime,
  getSiteRuntimeStatus,
  startSiteRuntime,
  stopSiteRuntime
} from "../src/core/site.js";

interface RegistrySnapshot {
  siteId?: string;
  pid: number | null;
  watcherPid: number | null;
  startedAt: string;
  port: number;
  url: string;
  runtimeBase?: string;
  runtimeRoot?: string;
  templateRoot?: string;
  sourceDocsRoot?: string;
  sourceWorkspaceRoot?: string | null;
  stagedDocsRoot?: string;
  logFile?: string;
  mode?: "live" | "build";
}

async function waitFor(condition: () => Promise<boolean>, timeoutMs: number, intervalMs = 250): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

async function reserveAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("unable to reserve an ephemeral docs-site port"));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

let activeWorkspaceRoot: string | null = null;
let activeRuntimeBase: string | null = null;
let cleanupStarted = false;

async function cleanupTemporaryRoots() {
  if (cleanupStarted) {
    return;
  }

  cleanupStarted = true;

  if (activeWorkspaceRoot) {
    await cleanSiteRuntime(activeWorkspaceRoot).catch(() => undefined);
    await fs.rm(activeWorkspaceRoot, { recursive: true, force: true }).catch(() => undefined);
  }

  if (activeRuntimeBase) {
    await fs.rm(activeRuntimeBase, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function readRegistry(runtimeRoot: string): Promise<RegistrySnapshot> {
  return JSON.parse(
    await fs.readFile(path.join(runtimeRoot, "runtime-data", "registry.json"), "utf8")
  ) as RegistrySnapshot;
}

async function writeRegistry(runtimeRoot: string, value: RegistrySnapshot): Promise<void> {
  await fs.writeFile(
    path.join(runtimeRoot, "runtime-data", "registry.json"),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void cleanupTemporaryRoots().finally(() => {
      process.exit(130);
    });
  });
}

async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-lifecycle-workspace-"));
  const runtimeBase = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-lifecycle-runtime-"));
  const requestedPort = await reserveAvailablePort();
  const previousRuntimeBase = process.env.APCC_SITE_RUNTIME_BASE;
  activeWorkspaceRoot = workspaceRoot;
  activeRuntimeBase = runtimeBase;

  process.env.APCC_SITE_RUNTIME_BASE = runtimeBase;

  try {
    await initWorkspace({
      targetPath: workspaceRoot,
      projectName: "Lifecycle Smoke Workspace",
      endGoalName: "Verify the docs-site lifecycle",
      endGoalSummary:
        "Confirm that the local docs runtime starts, reuses, stops, restarts, and cleans predictably.",
      docsLanguage: "zh-CN"
    });

    await fs.writeFile(
      path.join(workspaceRoot, "docs", "public", "rendering-fixture.md"),
      [
        "---",
        "name: Rendering Fixture",
        "description: Markdown rendering fixture for docs-site verification.",
        "---",
        "",
        "# Rendering Fixture",
        "",
        "| 列 | 值 |",
        "| --- | --- |",
        "| One | Two |",
        "",
        "```bash",
        "npm install -g apcc",
        "apcc guide",
        "```",
        ""
      ].join("\n"),
      "utf8"
    );

    const statusBeforeStart = await getSiteRuntimeStatus(workspaceRoot);
    assert.equal(statusBeforeStart.state, "absent", "site status should report absent before the first start");

    const first = await startSiteRuntime(workspaceRoot, { port: requestedPort });
    const firstRegistry = await readRegistry(first.runtimeRoot);
    const siteOrigin = new URL(first.url).origin;
    const bareRootResponse = await fetch(siteOrigin, { redirect: "manual" });
    const firstHomeResponse = await fetch(first.url);
    const overviewUrl = `${siteOrigin}/zh-CN/docs/shared/${encodeURIComponent("概览")}`;
    const renderingFixtureUrl = `${siteOrigin}/zh-CN/docs/public/rendering-fixture`;
    const firstResponse = await fetch(overviewUrl);
    const renderingFixtureResponse = await fetch(renderingFixtureUrl);
    const renderingFixtureHtml = await renderingFixtureResponse.text();

    assert.equal(first.alreadyRunning, false, "first site start should start a fresh runtime");
    assert.equal(first.port, requestedPort, "site start should honor an explicit requested port");
    assert.equal(firstRegistry.pid, first.pid, "registry pid should match the started runtime pid");
    assert.equal(firstRegistry.port, first.port, "registry port should match the started runtime port");
    assert.equal(firstRegistry.url, first.url, "registry url should match the started runtime url");
    assert.match(
      firstRegistry.templateRoot ?? "",
      /[\\/]shared-shells[\\/]/,
      "source-repo live runtimes should launch from the local shared shell cache rather than dist"
    );
    assert.equal(
      bareRootResponse.headers.get("location"),
      "/zh-CN/docs/console",
      "the bare site root should respect the workspace docs language"
    );
    assert.equal(
      new URL(firstHomeResponse.url).pathname,
      "/zh-CN/docs/console",
      "the docs-site root should land on the localized console overview"
    );
    assert.equal(firstResponse.status, 200, "prebuilt runtime should serve the localized overview page");
    assert.equal(renderingFixtureResponse.status, 200, "prebuilt runtime should serve the markdown rendering fixture page");
    assert.match(renderingFixtureHtml, /<table/i, "markdown tables should render as HTML tables");
    assert.match(
      renderingFixtureHtml,
      /<pre[^>]*>[\s\S]*shiki/i,
      "fenced code blocks should render through the Fumadocs code-block pipeline"
    );
    assert.equal(nodeFs.existsSync(path.join(first.runtimeRoot, "server.js")), false, "runtime root should not carry a copied shell server");
    assert.equal(nodeFs.existsSync(path.join(first.runtimeRoot, "node_modules")), false, "runtime root should not install shell dependencies per project");

    const built = await buildSiteRuntime(workspaceRoot);
    const registryAfterBuild = await readRegistry(first.runtimeRoot);
    const responseAfterBuild = await fetch(overviewUrl);

    assert.equal(nodeFs.existsSync(path.join(built.buildOutput, "server.js")), true, "site build artifact should contain server.js");
    assert.equal(nodeFs.existsSync(path.join(built.buildOutput, "start.mjs")), true, "site build artifact should contain a start entrypoint");
    assert.equal(
      nodeFs.existsSync(path.join(built.buildOutput, "runtime-data", "docs-viewer.json")),
      true,
      "site build artifact should contain docs viewer runtime data"
    );
    assert.equal(registryAfterBuild.pid, firstRegistry.pid, "site build should not stop the live runtime");
    assert.equal(registryAfterBuild.watcherPid, firstRegistry.watcherPid, "site build should not stop the live watcher");
    assert.equal(registryAfterBuild.mode, "live", "site build should not downgrade live runtime metadata");
    assert.equal(responseAfterBuild.status, 200, "live runtime should remain reachable after site build");

    const statusAfterStart = await getSiteRuntimeStatus(workspaceRoot);
    assert.equal(statusAfterStart.state, "live", "site status should report live after start");
    assert.equal(statusAfterStart.port, requestedPort, "site status should expose the live port");
    assert.equal(statusAfterStart.url, first.url, "site status should expose the live url");

    const second = await startSiteRuntime(workspaceRoot, { port: requestedPort });
    const secondRegistry = await readRegistry(second.runtimeRoot);

    assert.equal(second.alreadyRunning, true, "second site start should reuse the healthy runtime");
    assert.equal(second.runtimeRoot, first.runtimeRoot, "reused runtime root should stay stable");
    assert.equal(second.port, requestedPort, "reused runtime should preserve the explicit port");
    assert.equal(secondRegistry.pid, firstRegistry.pid, "reused runtime pid should stay stable");
    assert.equal(
      secondRegistry.watcherPid,
      firstRegistry.watcherPid,
      "reused watcher pid should stay stable"
    );
    assert.equal(
      secondRegistry.startedAt,
      firstRegistry.startedAt,
      "reused runtime should preserve its original startedAt"
    );

    const docsViewerPath = path.join(first.runtimeRoot, "runtime-data", "docs-viewer.json");
    const versionPath = path.join(first.runtimeRoot, "runtime-data", "version.json");
    const previousViewerMtime = (await fs.stat(docsViewerPath)).mtimeMs;
    const previousVersion = await fs.readFile(versionPath, "utf8");
    const overviewPath = path.join(workspaceRoot, "docs", "shared", "概览.md");
    const originalOverview = await fs.readFile(overviewPath, "utf8");
    const markerOne = `Watcher Marker One ${Date.now()}`;
    await fs.writeFile(overviewPath, `${originalOverview}\n\n${markerOne}\n`, "utf8");

    const firstViewerUpdate = await waitFor(async () => {
      const stats = await fs.stat(docsViewerPath).catch(() => null);
      return Boolean(stats && stats.mtimeMs > previousViewerMtime);
    }, 15000);
    assert.equal(firstViewerUpdate, true, "docs watcher should refresh docs-viewer.json after the first authored docs change");

    const firstVersionUpdate = await waitFor(async () => {
      const current = await fs.readFile(versionPath, "utf8").catch(() => null);
      return current !== null && current !== previousVersion;
    }, 15000);
    assert.equal(firstVersionUpdate, true, "docs watcher should advance version.json after the first authored docs change");

    const firstPageUpdate = await waitFor(async () => {
      const response = await fetch(overviewUrl).catch(() => null);
      if (!response?.ok) {
        return false;
      }
      const content = await response.text();
      return content.includes(markerOne);
    }, 15000);
    assert.equal(firstPageUpdate, true, "prebuilt runtime should serve the first updated docs payload after watcher refresh");

    const viewerMtimeAfterFirstUpdate = (await fs.stat(docsViewerPath)).mtimeMs;
    const versionAfterFirstUpdate = await fs.readFile(versionPath, "utf8");
    const markerTwo = `Watcher Marker Two ${Date.now()}`;
    await fs.writeFile(overviewPath, `${originalOverview}\n\n${markerTwo}\n`, "utf8");

    const secondViewerUpdate = await waitFor(async () => {
      const stats = await fs.stat(docsViewerPath).catch(() => null);
      return Boolean(stats && stats.mtimeMs > viewerMtimeAfterFirstUpdate);
    }, 15000);
    assert.equal(secondViewerUpdate, true, "docs watcher should refresh docs-viewer.json after a later authored docs change");

    const secondVersionUpdate = await waitFor(async () => {
      const current = await fs.readFile(versionPath, "utf8").catch(() => null);
      return current !== null && current !== versionAfterFirstUpdate;
    }, 15000);
    assert.equal(secondVersionUpdate, true, "docs watcher should keep advancing version.json after later authored docs changes");

    const secondPageUpdate = await waitFor(async () => {
      const response = await fetch(overviewUrl).catch(() => null);
      if (!response?.ok) {
        return false;
      }
      const content = await response.text();
      return content.includes(markerTwo);
    }, 15000);
    assert.equal(secondPageUpdate, true, "prebuilt runtime should serve the second updated docs payload after watcher refresh");

    await fs.writeFile(overviewPath, originalOverview, "utf8");

    const stopped = await stopSiteRuntime(workspaceRoot);
    const stoppedRegistry = await readRegistry(first.runtimeRoot);
    const statusAfterStop = await getSiteRuntimeStatus(workspaceRoot);

    assert.equal(stopped.preservedRuntime, true, "site stop should preserve the staged runtime");
    assert.equal(stoppedRegistry.pid, null, "site stop should clear the runtime pid");
    assert.equal(stoppedRegistry.watcherPid, null, "site stop should clear the watcher pid");
    assert.equal(statusAfterStop.state, "staged", "site status should report staged after stop");

    const stalePid = 999_991;
    const staleWatcherPid = 999_992;
    await writeRegistry(first.runtimeRoot, {
      ...stoppedRegistry,
      pid: stalePid,
      watcherPid: staleWatcherPid,
      startedAt: firstRegistry.startedAt,
      mode: "live"
    });

    const restarted = await startSiteRuntime(workspaceRoot);
    const restartedRegistry = await readRegistry(restarted.runtimeRoot);

    assert.equal(restarted.alreadyRunning, false, "site start after stop should start a fresh runtime");
    assert.notEqual(
      restartedRegistry.startedAt,
      firstRegistry.startedAt,
      "restart after stop should refresh startedAt"
    );
    assert.notEqual(
      restartedRegistry.pid,
      stalePid,
      "site start should ignore a stale runtime pid and start a fresh runtime"
    );
    assert.notEqual(
      restartedRegistry.watcherPid,
      staleWatcherPid,
      "site start should ignore a stale watcher pid and start a fresh watcher"
    );

    const cleaned = await cleanSiteRuntime(workspaceRoot);
    const statusAfterClean = await getSiteRuntimeStatus(workspaceRoot);

    assert.equal(cleaned.cleaned, true, "site clean should remove the runtime root");
    assert.equal(statusAfterClean.state, "absent", "site status should return to absent after clean");
    await assert.rejects(
      fs.stat(restarted.runtimeRoot),
      "site clean should remove the runtime root from disk"
    );

    console.log(
      JSON.stringify(
        {
          workspaceRoot,
          runtimeBase,
          firstPid: firstRegistry.pid,
          reusedPid: secondRegistry.pid,
          restartedPid: restartedRegistry.pid
        },
        null,
        2
      )
    );
  } finally {
    if (previousRuntimeBase === undefined) {
      delete process.env.APCC_SITE_RUNTIME_BASE;
    } else {
      process.env.APCC_SITE_RUNTIME_BASE = previousRuntimeBase;
    }

    await cleanupTemporaryRoots();
    activeWorkspaceRoot = null;
    activeRuntimeBase = null;
  }
}

await main();
