import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { initWorkspace } from "../src/core/bootstrap.js";
import {
  getSiteRuntimeStatus,
  listSiteRuntimes,
  stageDocsForSiteRuntime,
  stopAllSiteRuntimes,
  stopSiteRuntime
} from "../src/core/site.js";
import { buildSiteControlPlaneSnapshot } from "../src/core/site-data.js";
import { resolveSiteWatchRoots } from "../src/core/site-watch-roots.js";
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

describe("site runtime staging", () => {
  it("stages a freshly initialized minimal docs package without requiring docs/index.md", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-site-init-"));
    cleanups.push(async () => {
      await fs.rm(root, { recursive: true, force: true });
    });

    await initWorkspace({
      targetPath: root,
      projectName: "Minimal Docs Workspace",
      endGoalName: "Stabilize minimal docs workspace",
      endGoalSummary: "Keep the docs site functional even when the scaffold only contains shared/public/internal."
    });

    const staged = await stageDocsForSiteRuntime(root);
    const sharedOverview = await fs.readFile(path.join(staged.stagedDocsRoot, "shared", "overview.md"), "utf8");
    const stagedMeta = await fs.readFile(path.join(staged.stagedDocsRoot, "meta.json"), "utf8");
    const stagedIndexExists = await fs
      .stat(path.join(staged.stagedDocsRoot, "index.md"))
      .then(() => true)
      .catch(() => false);

    expect(sharedOverview).toContain("name: Project Overview");
    expect(JSON.parse(stagedMeta)).toEqual({
      pages: ["console", "shared", "public", "internal"]
    });
    expect(stagedIndexExists).toBe(false);
  });

  it("localizes scaffolded folder titles and runtime console labels for zh-CN workspaces", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-site-init-zh-"));
    cleanups.push(async () => {
      await fs.rm(root, { recursive: true, force: true });
    });

    await initWorkspace({
      targetPath: root,
      projectName: "最小文档工作区",
      docsLanguage: "zh-CN"
    });

    const staged = await stageDocsForSiteRuntime(root);
    const stagedConsoleMeta = await fs.readFile(path.join(staged.stagedDocsRoot, "console", "meta.json"), "utf8");
    const stagedConsoleIndex = await fs.readFile(path.join(staged.stagedDocsRoot, "console", "index.md"), "utf8");
    const stagedSharedMeta = await fs.readFile(path.join(staged.stagedDocsRoot, "shared", "meta.json"), "utf8");
    const viewerData = JSON.parse(
      await fs.readFile(path.join(staged.runtimeDataRoot, "docs-viewer.json"), "utf8")
    ) as {
      navigation: Array<{ title: string }>;
    };

    expect(JSON.parse(stagedConsoleMeta)).toEqual({
      title: "控制台",
      pages: ["index", "plans"]
    });
    expect(stagedConsoleIndex).toContain("name: 概览");
    expect(JSON.parse(stagedSharedMeta)).toEqual({
      title: "共享",
      pages: ["概览", "目标"]
    });
    expect(viewerData.navigation.map((node) => node.title)).toEqual(
      expect.arrayContaining(["控制台", "共享", "公开", "内部"])
    );
  });

  it("preserves APCC authored frontmatter in the staged docs tree", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const staged = await stageDocsForSiteRuntime();
    const stagedIndex = await fs.readFile(path.join(staged.stagedDocsRoot, "index.md"), "utf8");

    expect(staged.fileCount).toBeGreaterThan(0);
    expect(stagedIndex).toContain("name: Test index");
    expect(stagedIndex).toContain("description: Workspace entry page.");
  });

  it("copies source docs assets and injects runtime-managed console pages into the staged tree", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    await fs.writeFile(
      path.join(fixture.root, "docs", "meta.json"),
      JSON.stringify(
        {
          pages: ["index", "project", "engineering"]
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    await fs.writeFile(path.join(fixture.root, "docs", "logo.txt"), "site-asset\n", "utf8");

    const staged = await stageDocsForSiteRuntime();
    const stagedMeta = await fs.readFile(path.join(staged.stagedDocsRoot, "meta.json"), "utf8");
    const stagedAsset = await fs.readFile(path.join(staged.stagedDocsRoot, "logo.txt"), "utf8");
    const stagedConsoleMeta = await fs.readFile(path.join(staged.stagedDocsRoot, "console", "meta.json"), "utf8");
    const stagedConsoleIndex = await fs.readFile(path.join(staged.stagedDocsRoot, "console", "index.md"), "utf8");

    expect(JSON.parse(stagedMeta)).toEqual({
      pages: ["console", "project", "engineering"]
    });
    expect(JSON.parse(stagedConsoleMeta)).toEqual({
      title: "Console",
      pages: ["index", "plans"]
    });
    expect(stagedConsoleIndex).toContain("name: Overview");
    expect(stagedAsset).toBe("site-asset\n");
  });

  it("reports absent and staged runtime states without starting a live server", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const absent = await getSiteRuntimeStatus();
    expect(absent.state).toBe("absent");
    expect(absent.runtimePresent).toBe(false);
    expect(absent.port).toBeNull();
    expect(absent.url).toBeNull();

    const staged = await stageDocsForSiteRuntime();
    const afterStage = await getSiteRuntimeStatus();

    expect(afterStage.state).toBe("staged");
    expect(afterStage.runtimePresent).toBe(true);
    expect(afterStage.runtimeRoot).toBe(staged.runtimeRoot);
    expect(afterStage.stagedDocsRoot).toBe(staged.stagedDocsRoot);
    expect(afterStage.port).toBeNull();
    expect(afterStage.url).toBeNull();
  });

  it("writes a viewer-data contract with navigation and authored page payloads", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    await fs.writeFile(
      path.join(fixture.root, "docs", "meta.json"),
      JSON.stringify(
        {
          pages: ["shared", "public", "internal"]
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(fixture.root, "docs", "public", "quickstart.md"),
      `---\nname: Quickstart\ndescription: Public quickstart guide.\n---\n\n# Quickstart\n\n## Install\n\nRun the CLI.\n`,
      "utf8"
    );

    const staged = await stageDocsForSiteRuntime();
    const viewerData = JSON.parse(
      await fs.readFile(path.join(staged.runtimeDataRoot, "docs-viewer.json"), "utf8")
    ) as {
      navigation: Array<{ type: string; title: string; path?: string; children?: unknown[] }>;
      pages: Array<{ path: string; title: string; headings: Array<{ text: string; id: string }> }>;
    };

    expect(viewerData.navigation.map((node) => node.title)).toEqual(
      expect.arrayContaining(["Console", "Shared", "Public"])
    );
    expect(viewerData.pages.find((page) => page.path === "public/quickstart.md")?.headings).toEqual([
      { depth: 1, text: "Quickstart", id: "quickstart" },
      { depth: 2, text: "Install", id: "install" }
    ]);
  });

  it("keeps staged runtime roots isolated across different workspaces", async () => {
    const runtimeBase = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-runtime-base-"));
    const previousRuntimeBase = process.env.APCC_SITE_RUNTIME_BASE;
    process.env.APCC_SITE_RUNTIME_BASE = runtimeBase;
    restorers.push(() => {
      if (previousRuntimeBase === undefined) {
        delete process.env.APCC_SITE_RUNTIME_BASE;
        return;
      }
      process.env.APCC_SITE_RUNTIME_BASE = previousRuntimeBase;
    });
    cleanups.push(async () => {
      await fs.rm(runtimeBase, { recursive: true, force: true });
    });

    const first = await createWorkspaceFixture();
    const second = await createWorkspaceFixture();
    cleanups.push(first.cleanup);
    cleanups.push(second.cleanup);

    const stagedFirst = await stageDocsForSiteRuntime(first.root);
    const stagedSecond = await stageDocsForSiteRuntime(second.root);

    expect(stagedFirst.siteId).not.toBe(stagedSecond.siteId);
    expect(stagedFirst.runtimeRoot).not.toBe(stagedSecond.runtimeRoot);
    expect(stagedFirst.runtimeRoot.startsWith(runtimeBase)).toBe(true);
    expect(stagedSecond.runtimeRoot.startsWith(runtimeBase)).toBe(true);
  });

  it("uses the persisted docs-site source path and preferred port when path is omitted", async () => {
    const fixture = await createWorkspaceFixture({
      config: {
        siteFramework: "fumadocs",
        packageManager: "npm",
        projectKind: "general",
        docsMode: "standard",
        docsSite: {
          enabled: true,
          sourcePath: "docs-pack",
          preferredPort: 4555
        },
        docsLanguage: "en",
        workspaceSchemaVersion: 10
      }
    });
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    await fs.mkdir(path.join(fixture.root, "docs-pack"), { recursive: true });
    await fs.writeFile(
      path.join(fixture.root, "docs-pack", "index.md"),
      `---\nname: Configured Index\ndescription: Configured docs site entry.\n---\n\n# Configured Docs\n`,
      "utf8"
    );

    const staged = await stageDocsForSiteRuntime();
    const stagedIndex = await fs.readFile(path.join(staged.stagedDocsRoot, "index.md"), "utf8");

    expect(staged.sourceDocsRoot).toBe(path.join(fixture.root, "docs-pack"));
    expect(staged.preferredPort).toBe(4555);
    expect(stagedIndex).toContain("name: Configured Index");
  });

  it("restages the same runtime without recreating source-loader scaffolding", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const first = await stageDocsForSiteRuntime();
    await fs.writeFile(
      path.join(fixture.root, "docs", "index.md"),
      `---\nname: Restaged Index\ndescription: Restaged docs entry.\n---\n\n# Restaged Docs\n`,
      "utf8"
    );

    const second = await stageDocsForSiteRuntime();
    const stagedIndex = await fs.readFile(path.join(second.stagedDocsRoot, "index.md"), "utf8");
    const generatedSourceExists = await fs
      .stat(path.join(second.runtimeRoot, ".source", "source.config.mjs"))
      .then(() => true)
      .catch(() => false);

    expect(second.runtimeRoot).toBe(first.runtimeRoot);
    expect(stagedIndex).toContain("name: Restaged Index");
    expect(generatedSourceExists).toBe(false);
  });

  it("can refresh runtime metadata without rewriting the staged docs tree", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const first = await stageDocsForSiteRuntime();
    const stagedIndexPath = path.join(first.stagedDocsRoot, "index.md");
    const initialIndex = await fs.readFile(stagedIndexPath, "utf8");

    await fs.writeFile(
      path.join(fixture.root, ".apcc", "project", "overview.yaml"),
      [
        "name: Test Project",
        "summary: Updated control-plane summary without touching authored docs.",
        "docPath: project/overview.md",
        ""
      ].join("\n"),
      "utf8"
    );

    const second = await stageDocsForSiteRuntime(undefined, { syncDocs: false });
    const restagedIndex = await fs.readFile(path.join(second.stagedDocsRoot, "index.md"), "utf8");

    expect(second.runtimeRoot).toBe(first.runtimeRoot);
    expect(restagedIndex).toBe(initialIndex);
  });

  it("tracks authored doc revisions and exposes changed docs in the site snapshot", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const first = await stageDocsForSiteRuntime();
    await fs.writeFile(
      path.join(fixture.root, "docs", "project", "overview.md"),
      `---\nname: Project Overview\ndescription: Project overview page.\n---\n\n# Project Overview\n\n## 项目摘要\n\n第二版项目介绍。\n`,
      "utf8"
    );

    const second = await stageDocsForSiteRuntime();
    const snapshot = await buildSiteControlPlaneSnapshot(path.join(fixture.root, "docs"), {
      docsRevisionFile: path.join(second.runtimeRoot, "runtime-data", "docs-revisions.json")
    });
    const overviewPage = snapshot.docs.pages.find((page) => page.path === "project/overview.md");
    const workspaceRevisionFileExists = await fs
      .stat(path.join(fixture.root, ".apcc", "state", "docs-revisions.json"))
      .then(() => true)
      .catch(() => false);
    const runtimeRevisionFileExists = await fs
      .stat(path.join(first.runtimeRoot, "runtime-data", "docs-revisions.json"))
      .then(() => true)
      .catch(() => false);

    expect(overviewPage?.revisionCount).toBe(2);
    expect(snapshot.docs.changedPages.some((page) => page.path === "project/overview.md")).toBe(true);
    expect(runtimeRevisionFileExists).toBe(true);
    expect(workspaceRevisionFileExists).toBe(false);
  });

  it("exposes project versions and decisions from explicit control-plane records", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    await fs.writeFile(
      path.join(fixture.root, ".apcc", "decisions", "records.yaml"),
      [
        "items:",
        "  - id: define-version-policy",
        "    name: Define version policy",
        "    description: Introduce low-frequency project-level versions.",
        "    docPath: internal/decision-log/version-policy.md",
        "    category: version",
        "    proposedBy: agent",
        "    context: The project needs a stable version model.",
        "    impactOfNoAction: Version history remains ambiguous.",
        "    expectedOutcome: Versions become explicit and low-frequency.",
        "    boundary: Only project-level version semantics.",
        "    status: approved",
        "    decisionSummary: Approved for the current framework model.",
        "    revisitCondition: Revisit if version semantics change materially.",
        "    createdAt: 2026-04-23T00:00:00Z",
        "    decidedAt: 2026-04-23T00:10:00Z",
        ""
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(fixture.root, ".apcc", "versions", "records.yaml"),
      [
        "items:",
        "  - id: 0-2-0-baseline",
        "    version: 0.2.0",
        "    title: Stable baseline",
        "    summary: First stable framework baseline.",
        "    docPath: internal/changelog/0-2-0.md",
        "    status: recorded",
        "    decisionRefs:",
        "      - define-version-policy",
        "    highlights:",
        "      - Introduced stable docs-site lifecycle",
        "    breakingChanges: []",
        "    migrationNotes: []",
        "    validationSummary: Core runtime and docs model validated.",
        "    createdAt: 2026-04-23T00:00:00Z",
        "    recordedAt: 2026-04-23T00:20:00Z",
        ""
      ].join("\n"),
      "utf8"
    );

    const snapshot = await buildSiteControlPlaneSnapshot(path.join(fixture.root, "docs"));

    expect(snapshot.decisions?.items[0]?.docPath).toBe("internal/decision-log/version-policy.md");
    expect(snapshot.decisions?.items[0]?.status).toBe("approved");
    expect(snapshot.versions?.items[0]?.docPath).toBe("internal/changelog/0-2-0.md");
    expect(snapshot.versions?.items[0]?.status).toBe("recorded");
  });

  it("stops the runtime without deleting the staged runtime root", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const staged = await stageDocsForSiteRuntime();
    await fs.writeFile(
      staged.registryFile,
      JSON.stringify(
        {
          siteId: staged.siteId,
          pid: null,
          watcherPid: null,
          port: 4310,
          url: "http://127.0.0.1:4310/docs",
          runtimeBase: staged.runtimeBase,
          runtimeRoot: staged.runtimeRoot,
          templateRoot: staged.templateRoot,
          sourceDocsRoot: staged.sourceDocsRoot,
          sourceWorkspaceRoot: staged.sourceWorkspaceRoot,
          stagedDocsRoot: staged.stagedDocsRoot,
          logFile: staged.logFile,
          startedAt: "2026-04-20T00:00:00.000Z",
          mode: "live"
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    const result = await stopSiteRuntime();
    const runtimeMetadata = JSON.parse(await fs.readFile(staged.runtimeFile, "utf8")) as {
      mode: string;
      port: number | null;
      url: string | null;
    };
    const registry = JSON.parse(await fs.readFile(staged.registryFile, "utf8")) as {
      pid: number | null;
      watcherPid: number | null;
      port: number;
    };

    expect(result.preservedRuntime).toBe(true);
    expect(result.runtimeRoot).toBe(staged.runtimeRoot);
    expect(runtimeMetadata.mode).toBe("staged");
    expect(runtimeMetadata.port).toBeNull();
    expect(runtimeMetadata.url).toBeNull();
    expect(registry.pid).toBeNull();
    expect(registry.watcherPid).toBeNull();
    expect(registry.port).toBe(4310);
  });

  it("watches the whole control-plane root so project/config changes can restage the runtime", async () => {
    const fixture = await createWorkspaceFixture();
    cleanups.push(fixture.cleanup);

    const watchRoots = resolveSiteWatchRoots(path.join(fixture.root, "docs"));

    expect(watchRoots).toContain(path.join(fixture.root, "docs"));
    expect(watchRoots).toContain(path.join(fixture.root, ".apcc"));
    expect(watchRoots).toContain(path.join(fixture.root, ".agents"));
  }, 15000);

  it("lists healthy running site instances with project identity", async () => {
    const runtimeBase = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-runtime-base-"));
    const previousRuntimeBase = process.env.APCC_SITE_RUNTIME_BASE;
    process.env.APCC_SITE_RUNTIME_BASE = runtimeBase;
    restorers.push(() => {
      if (previousRuntimeBase === undefined) {
        delete process.env.APCC_SITE_RUNTIME_BASE;
        return;
      }
      process.env.APCC_SITE_RUNTIME_BASE = previousRuntimeBase;
    });
    cleanups.push(async () => {
      await fs.rm(runtimeBase, { recursive: true, force: true });
    });

    const fixture = await createWorkspaceFixture();
    cleanups.push(fixture.cleanup);

    const staged = await stageDocsForSiteRuntime(fixture.root);
    const server = net.createServer((socket) => {
      socket.on("error", () => undefined);
      socket.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected a TCP address for the health-check server");
    }
    const port = address.port;
    cleanups.push(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    await fs.mkdir(path.join(runtimeBase, "registry"), { recursive: true });
    await fs.writeFile(
      staged.registryFile,
      JSON.stringify(
        {
          siteId: staged.siteId,
          pid: process.pid,
          watcherPid: null,
          port,
          url: `http://127.0.0.1:${port}/docs`,
          runtimeBase,
          runtimeRoot: staged.runtimeRoot,
          templateRoot: staged.templateRoot,
          sourceDocsRoot: staged.sourceDocsRoot,
          sourceWorkspaceRoot: staged.sourceWorkspaceRoot,
          stagedDocsRoot: staged.stagedDocsRoot,
          logFile: staged.logFile,
          startedAt: "2026-04-25T00:00:00.000Z",
          mode: "live"
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(runtimeBase, "registry", "sites.json"),
      JSON.stringify(
        {
          [staged.siteId]: {
            siteId: staged.siteId,
            sourceDocsRoot: staged.sourceDocsRoot,
            sourceWorkspaceRoot: staged.sourceWorkspaceRoot,
            runtimeRoot: staged.runtimeRoot,
            port,
            url: `http://127.0.0.1:${port}/docs`,
            startedAt: "2026-04-25T00:00:00.000Z",
            mode: "live"
          }
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    const runtimes = await listSiteRuntimes(runtimeBase);

    expect(runtimes).toEqual([
      expect.objectContaining({
        siteId: staged.siteId,
        projectName: "Test Workspace",
        sourceDocsRoot: staged.sourceDocsRoot,
        sourceWorkspaceRoot: staged.sourceWorkspaceRoot,
        runtimeRoot: staged.runtimeRoot,
        port,
        url: `http://127.0.0.1:${port}/docs`,
        mode: "live"
      })
    ]);
  });

  it("can stop all active site runtimes in one call", async () => {
    const runtimeBase = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-runtime-base-"));
    const previousRuntimeBase = process.env.APCC_SITE_RUNTIME_BASE;
    process.env.APCC_SITE_RUNTIME_BASE = runtimeBase;
    restorers.push(() => {
      if (previousRuntimeBase === undefined) {
        delete process.env.APCC_SITE_RUNTIME_BASE;
        return;
      }
      process.env.APCC_SITE_RUNTIME_BASE = previousRuntimeBase;
    });
    cleanups.push(async () => {
      await fs.rm(runtimeBase, { recursive: true, force: true });
    });

    const fixture = await createWorkspaceFixture();
    cleanups.push(fixture.cleanup);

    const staged = await stageDocsForSiteRuntime(fixture.root);
    const probe = net.createServer();
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", () => resolve()));
    const address = probe.address();
    if (!address || typeof address === "string") {
      throw new Error("expected a TCP address for the bulk-stop server probe");
    }
    const port = address.port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const child = spawn(process.execPath, [
      "-e",
      `const http=require('node:http'); const server=http.createServer((req,res)=>res.end('ok')); server.listen(${port},'127.0.0.1'); setInterval(()=>{},1000);`
    ], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    cleanups.push(async () => {
      try {
        process.kill(child.pid!, "SIGTERM");
      } catch {}
    });

    await fs.mkdir(path.join(runtimeBase, "registry"), { recursive: true });
    await fs.writeFile(
      staged.registryFile,
      JSON.stringify(
        {
          siteId: staged.siteId,
          pid: child.pid,
          watcherPid: null,
          port,
          url: `http://127.0.0.1:${port}/docs`,
          runtimeBase,
          runtimeRoot: staged.runtimeRoot,
          templateRoot: staged.templateRoot,
          sourceDocsRoot: staged.sourceDocsRoot,
          sourceWorkspaceRoot: staged.sourceWorkspaceRoot,
          stagedDocsRoot: staged.stagedDocsRoot,
          logFile: staged.logFile,
          startedAt: "2026-04-25T00:00:00.000Z",
          mode: "live"
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(runtimeBase, "registry", "sites.json"),
      JSON.stringify(
        {
          [staged.siteId]: {
            siteId: staged.siteId,
            sourceDocsRoot: staged.sourceDocsRoot,
            sourceWorkspaceRoot: staged.sourceWorkspaceRoot,
            runtimeRoot: staged.runtimeRoot,
            port,
            url: `http://127.0.0.1:${port}/docs`,
            startedAt: "2026-04-25T00:00:00.000Z",
            mode: "live"
          }
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    const result = await stopAllSiteRuntimes(runtimeBase);
    const globalRegistry = await fs.readFile(path.join(runtimeBase, "registry", "sites.json"), "utf8");
    const runtimeMetadata = JSON.parse(await fs.readFile(staged.runtimeFile, "utf8")) as {
      mode: string;
      port: number | null;
      url: string | null;
    };

    expect(result.count).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        siteId: staged.siteId,
        projectName: "Test Workspace",
        stopped: true,
        preservedRuntime: true
      })
    );
    expect(JSON.parse(globalRegistry)).toEqual({});
    expect(runtimeMetadata.mode).toBe("staged");
    expect(runtimeMetadata.port).toBeNull();
    expect(runtimeMetadata.url).toBeNull();
  });
});
