import crypto from "node:crypto";
import fs from "node:fs/promises";
import nodeFs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { getApccPackageFile, getApccPackageRoot, getCurrentModulePath } from "./package-runtime.js";
import { loadDocsRevisionState, syncDocsRevisionState } from "./docs-revisions.js";
import { readText, readYamlFile, writeText } from "./storage.js";
import { buildSiteControlPlaneSnapshot, type SiteControlPlaneSnapshot } from "./site-data.js";
import { buildSiteViewerData } from "./site-viewer-data.js";
import { loadWorkspaceConfig } from "./workspace-config.js";
import { getWorkspacePaths, resolveWorkspaceRoot, withWorkspaceRoot } from "./workspace.js";

interface SiteRuntimeRegistry {
  siteId: string;
  pid: number | null;
  watcherPid: number | null;
  port: number;
  url: string;
  runtimeBase: string;
  runtimeRoot: string;
  templateRoot: string;
  sourceDocsRoot: string;
  sourceWorkspaceRoot: string | null;
  stagedDocsRoot: string;
  logFile: string;
  startedAt: string;
  mode: "live" | "build";
}

interface GlobalSiteRegistryEntry {
  siteId: string;
  sourceDocsRoot: string;
  sourceWorkspaceRoot: string | null;
  runtimeRoot: string;
  port: number;
  url: string;
  startedAt: string;
  mode: "live" | "build";
}

type GlobalSiteRegistry = Record<string, GlobalSiteRegistryEntry>;

export interface SiteRuntimeListEntry {
  siteId: string;
  projectName: string | null;
  sourceDocsRoot: string;
  sourceWorkspaceRoot: string | null;
  runtimeRoot: string;
  port: number;
  url: string;
  startedAt: string;
  mode: "live" | "build";
}

interface SiteRuntimeMetadata {
  siteId: string;
  sourceDocsRoot: string;
  sourceWorkspaceRoot: string | null;
  runtimeRoot: string;
  templateRoot: string;
  mode: "staged" | "live" | "build";
  port: number | null;
  url: string | null;
  updatedAt: string;
}

export interface SiteRuntimeStatusEntry {
  siteId: string;
  sourceDocsRoot: string;
  sourceWorkspaceRoot: string | null;
  runtimeRoot: string;
  runtimeDataRoot: string;
  docsLanguage: "en" | "zh-CN";
  preferredPort: number | null;
  state: "absent" | "staged" | "live";
  runtimePresent: boolean;
  healthy: boolean;
  stagedDocsRoot: string | null;
  port: number | null;
  url: string | null;
  startedAt: string | null;
  pid: number | null;
  watcherPid: number | null;
  logFile: string | null;
}

interface StageResult {
  siteId: string;
  sourceDocsRoot: string;
  sourceWorkspaceRoot: string | null;
  docsLanguage: "en" | "zh-CN";
  runtimeBase: string;
  runtimeRoot: string;
  templateRoot: string;
  stagedDocsRoot: string;
  runtimeDataRoot: string;
  fileCount: number;
  pageCount: number;
  registryFile: string;
  dataFile: string;
  docsRevisionDataFile: string;
  viewerDataFile: string;
  versionFile: string;
  runtimeFile: string;
  logFile: string;
  preferredPort: number | null;
  portSource: "workspace" | "explicit" | null;
}

interface StageDocsOptions {
  syncDocs?: boolean;
}

interface StartSiteRuntimeOptions {
  port?: number;
}

interface StageSiteRuntimeOptions extends StageDocsOptions {
  preferredPort?: number;
}

interface StageSiteDataOptions extends StageDocsOptions {
  mode: "staged" | "live" | "build";
  port?: number;
  url?: string;
  sanitizeForDeployment?: boolean;
  templateRoot: string;
}

interface SiteBuildOptions {
  outputPath?: string;
}

interface ResolvedSiteRuntimeLocation {
  sourceDocsRoot: string;
  sourceWorkspaceRoot: string | null;
  siteId: string;
  runtimeBase: string;
  runtimeRoot: string;
  runtimeDataRoot: string;
  templateRoot: string;
}

interface RootMetaFile {
  title?: string;
  pages?: string[];
}

interface SiteSourceContext {
  sourceDocsRoot: string;
  sourceWorkspaceRoot: string | null;
  docsLanguage: "en" | "zh-CN";
  siteId: string;
  workspaceConfig: Awaited<ReturnType<typeof loadWorkspaceConfig>> | null;
}

function isMarkdownFile(filePath: string): boolean {
  return [".md", ".mdx"].includes(path.extname(filePath).toLowerCase());
}

async function collectSiteSourceFiles(root: string, base = root): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.name.startsWith(".")) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await collectSiteSourceFiles(fullPath, base)));
      continue;
    }

    if (entry.isFile()) {
      files.push(path.relative(base, fullPath).replace(/\\/g, "/"));
    }
  }

  return files.sort();
}

async function pruneEmptyDirectories(root: string, preserveRoot = true): Promise<void> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    await pruneEmptyDirectories(path.join(root, entry.name), false);
  }

  if (preserveRoot) {
    return;
  }

  const remaining = await fs.readdir(root).catch(() => []);
  if (remaining.length === 0) {
    await fs.rmdir(root).catch(() => undefined);
  }
}

async function syncDirectoryContents(sourceRoot: string, targetRoot: string): Promise<void> {
  await fs.mkdir(targetRoot, { recursive: true });

  const sourceFiles = await collectSiteSourceFiles(sourceRoot);
  const targetFiles = await collectSiteSourceFiles(targetRoot).catch(() => []);
  const sourceSet = new Set(sourceFiles);

  for (const relativePath of sourceFiles) {
    const sourceFile = path.join(sourceRoot, relativePath);
    const targetFile = path.join(targetRoot, relativePath);
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    await fs.copyFile(sourceFile, targetFile);
  }

  for (const relativePath of targetFiles.filter((file) => !sourceSet.has(file)).sort().reverse()) {
    await fs.rm(path.join(targetRoot, relativePath), {
      force: true,
      maxRetries: 3,
      retryDelay: 200
    });
  }

  await pruneEmptyDirectories(targetRoot);
}

async function looksLikeDocsPack(root: string): Promise<boolean> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  return entries.some((entry) => {
    if (!entry.isFile()) {
      return false;
    }

    if (entry.name === "meta.json") {
      return true;
    }

    return isMarkdownLike(entry.name);
  });
}

async function resolveDocsRoot(inputPath?: string): Promise<string> {
  if (!inputPath) {
    const paths = getWorkspacePaths();
    const config = await loadWorkspaceConfig(paths.root).catch(() => null);
    if (config?.docsSite.sourcePath) {
      const configuredPath = path.resolve(paths.root, config.docsSite.sourcePath);
      return resolveDocsRoot(configuredPath);
    }
    return paths.docsRoot;
  }

  const absolute = path.resolve(inputPath);
  const stats = await fs.stat(absolute);

  if (stats.isDirectory()) {
    if (path.basename(absolute) === "docs") {
      return absolute;
    }

    const nestedDocs = path.join(absolute, "docs");
    const nestedStats = await fs.stat(nestedDocs).catch(() => null);
    if (nestedStats?.isDirectory()) {
      return nestedDocs;
    }

    if (await looksLikeDocsPack(absolute)) {
      return absolute;
    }
  }

  throw new Error(`Unable to resolve a docs root from ${inputPath}`);
}

function renderRuntimeConsoleDoc(title: string, description: string): string {
  return `---\nname: ${title}\ndescription: ${description}\n---\n\n# ${title}\n`;
}

function getRuntimeConsoleCopy(docsLanguage: "en" | "zh-CN") {
  if (docsLanguage === "zh-CN") {
    return {
      consoleTitle: "控制台",
      overviewTitle: "概览",
      overviewDescription: "APCC 运行时控制台概览。",
      plansTitle: "计划",
      plansDescription: "APCC 运行时计划控制台。"
    };
  }

  return {
    consoleTitle: "Console",
    overviewTitle: "Overview",
    overviewDescription: "APCC runtime console overview.",
    plansTitle: "Plans",
    plansDescription: "APCC runtime plan console."
  };
}

function isMarkdownLike(fileName: string): boolean {
  return [".md", ".mdx"].includes(path.extname(fileName).toLowerCase());
}

function isConsoleMetaSeparator(value: string): boolean {
  return /^---\s*console\s*---$/i.test(value.trim());
}

async function listDefaultRootPages(stagedDocsRoot: string): Promise<string[]> {
  const entries = await fs.readdir(stagedDocsRoot, { withFileTypes: true });
  const pages: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "meta.json" || entry.name === "console") {
      continue;
    }

    if (entry.isDirectory()) {
      pages.push(entry.name);
      continue;
    }

    if (entry.isFile() && isMarkdownLike(entry.name)) {
      pages.push(path.basename(entry.name, path.extname(entry.name)));
    }
  }

  const unique = [...new Set(pages)];
  return [
    ...unique.filter((item) => item === "index"),
    ...unique.filter((item) => item !== "index").sort((left, right) => left.localeCompare(right))
  ];
}

async function patchRootMetaForConsole(stagedDocsRoot: string): Promise<void> {
  const metaPath = path.join(stagedDocsRoot, "meta.json");
  let rootMeta: RootMetaFile = {};

  try {
    rootMeta = JSON.parse(await readText(metaPath)) as RootMetaFile;
  } catch {
    rootMeta = {};
  }

  const sourcePages = Array.isArray(rootMeta.pages) ? rootMeta.pages : await listDefaultRootPages(stagedDocsRoot);
  const nextPages = [
    "console",
    ...sourcePages.filter((item) => item !== "console" && item !== "index" && !isConsoleMetaSeparator(item))
  ];

  await writeText(
    metaPath,
    `${JSON.stringify(
      {
        ...rootMeta,
        pages: nextPages
      },
      null,
      2
    )}\n`
  );
}

async function injectRuntimeConsoleDocs(stagedDocsRoot: string, docsLanguage: "en" | "zh-CN"): Promise<void> {
  const copy = getRuntimeConsoleCopy(docsLanguage);
  const consoleRoot = path.join(stagedDocsRoot, "console");
  await fs.rm(consoleRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  await fs.mkdir(consoleRoot, { recursive: true });

  await writeText(
    path.join(consoleRoot, "meta.json"),
    `${JSON.stringify(
      {
        title: copy.consoleTitle,
        pages: ["index", "plans"]
      },
      null,
      2
    )}\n`
  );

  await writeText(
    path.join(consoleRoot, "index.md"),
    renderRuntimeConsoleDoc(copy.overviewTitle, copy.overviewDescription)
  );
  await writeText(
    path.join(consoleRoot, "plans.md"),
    renderRuntimeConsoleDoc(copy.plansTitle, copy.plansDescription)
  );

  await patchRootMetaForConsole(stagedDocsRoot);
}

function getTemplateRoot(): string {
  return getApccPackageFile("site-runtime");
}

function getRuntimeBase(): string {
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

function tryResolveWorkspaceRootFromDocsRoot(sourceDocsRoot: string): string | null {
  try {
    return resolveWorkspaceRoot(path.dirname(sourceDocsRoot));
  } catch {
    return null;
  }
}

function createSiteId(sourceDocsRoot: string, sourceWorkspaceRoot: string | null): string {
  const seed = sourceWorkspaceRoot ?? sourceDocsRoot;
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  return hash.slice(0, 16);
}

async function resolveSiteSourceContext(inputPath?: string): Promise<SiteSourceContext> {
  const sourceDocsRoot = await resolveDocsRoot(inputPath);
  const sourceWorkspaceRoot = tryResolveWorkspaceRootFromDocsRoot(sourceDocsRoot);
  const workspaceConfig = sourceWorkspaceRoot
    ? await loadWorkspaceConfig(sourceWorkspaceRoot).catch(() => null)
    : null;

  return {
    sourceDocsRoot,
    sourceWorkspaceRoot,
    docsLanguage: workspaceConfig?.docsLanguage ?? "en",
    siteId: createSiteId(sourceDocsRoot, sourceWorkspaceRoot),
    workspaceConfig
  };
}

function getRuntimeRoot(siteId: string, runtimeBase = getRuntimeBase()): string {
  return path.join(runtimeBase, "sites", siteId);
}

function getGlobalRegistryFile(runtimeBase = getRuntimeBase()): string {
  return path.join(runtimeBase, "registry", "sites.json");
}

function getRegistryFile(runtimeRoot: string): string {
  return path.join(runtimeRoot, "runtime-data", "registry.json");
}

async function readRegistry(runtimeRoot: string): Promise<SiteRuntimeRegistry | null> {
  try {
    return JSON.parse(await readText(getRegistryFile(runtimeRoot))) as SiteRuntimeRegistry;
  } catch {
    return null;
  }
}

async function readRuntimeMetadata(runtimeDataRoot: string): Promise<SiteRuntimeMetadata | null> {
  try {
    return JSON.parse(await readText(path.join(runtimeDataRoot, "runtime.json"))) as SiteRuntimeMetadata;
  } catch {
    return null;
  }
}

async function writeRegistry(registry: SiteRuntimeRegistry): Promise<void> {
  await writeText(getRegistryFile(registry.runtimeRoot), `${JSON.stringify(registry, null, 2)}\n`);
}

async function readGlobalRegistry(runtimeBase: string): Promise<GlobalSiteRegistry> {
  try {
    return JSON.parse(await readText(getGlobalRegistryFile(runtimeBase))) as GlobalSiteRegistry;
  } catch {
    return {};
  }
}

async function updateGlobalRegistry(runtimeBase: string, entry: GlobalSiteRegistryEntry): Promise<void> {
  const registry = await readGlobalRegistry(runtimeBase);
  registry[entry.siteId] = entry;
  await writeText(getGlobalRegistryFile(runtimeBase), `${JSON.stringify(registry, null, 2)}\n`);
}

async function removeGlobalRegistryEntry(runtimeBase: string, siteId: string): Promise<void> {
  const registry = await readGlobalRegistry(runtimeBase);
  delete registry[siteId];
  await writeText(getGlobalRegistryFile(runtimeBase), `${JSON.stringify(registry, null, 2)}\n`);
}

async function readProjectNameForSiteEntry(sourceWorkspaceRoot: string | null): Promise<string | null> {
  if (!sourceWorkspaceRoot) {
    return null;
  }

  const projectOverviewFile = path.join(sourceWorkspaceRoot, ".apcc", "project", "overview.yaml");
  const overview = await readYamlFile<{ name?: string }>(projectOverviewFile).catch(() => null);
  if (overview?.name) {
    return overview.name;
  }

  return path.basename(sourceWorkspaceRoot);
}

async function isSiteRuntimeRegistryHealthy(registry: SiteRuntimeRegistry): Promise<boolean> {
  if (await waitForPort(registry.port, 500)) {
    return true;
  }

  return Boolean(registry.pid && processExists(registry.pid));
}

async function isSiteRegistryEntryHealthy(entry: GlobalSiteRegistryEntry): Promise<boolean> {
  const registry = await readRegistry(entry.runtimeRoot);
  if (!registry) {
    return false;
  }

  return isSiteRuntimeRegistryHealthy(registry);
}

function runtimeBaseFromRoot(runtimeRoot: string): string {
  return path.dirname(path.dirname(runtimeRoot));
}

async function listGlobalSiteEntries(runtimeBase = getRuntimeBase()): Promise<GlobalSiteRegistryEntry[]> {
  const registry = await readGlobalRegistry(runtimeBase);
  return Object.values(registry).sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function targetFromGlobalSiteEntry(entry: GlobalSiteRegistryEntry, templateRoot: string): ResolvedSiteRuntimeLocation {
  return {
    sourceDocsRoot: entry.sourceDocsRoot,
    sourceWorkspaceRoot: entry.sourceWorkspaceRoot,
    siteId: entry.siteId,
    runtimeBase: runtimeBaseFromRoot(entry.runtimeRoot),
    runtimeRoot: entry.runtimeRoot,
    runtimeDataRoot: path.join(entry.runtimeRoot, "runtime-data"),
    templateRoot
  };
}

function createNpmInvocation(args: string[]): { command: string; args: string[] } {
  if (process.platform === "win32") {
    const command =
      process.env.ComSpec ??
      path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe");
    return {
      command,
      args: ["/c", "npm", ...args]
    };
  }

  return {
    command: "npm",
    args
  };
}

function createNextInvocation(
  runtimeRoot: string,
  subcommand: "dev" | "build",
  args: string[] = []
): { command: string; args: string[] } {
  const heapArgs = ["--max-old-space-size=4096"];
  return {
    command: process.execPath,
    args: [...heapArgs, path.join(runtimeRoot, "node_modules", "next", "dist", "bin", "next"), subcommand, ...args]
  };
}

function createPrebuiltServerInvocation(runtimeRoot: string): { command: string; args: string[] } {
  return {
    command: process.execPath,
    args: [path.join(runtimeRoot, "server.js")]
  };
}

function escapePowerShellSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function writeWindowsBackgroundScript(options: {
  scriptPath: string;
  cwd: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  logFile?: string;
  mirrorLogsToConsole?: boolean;
  bannerLines?: string[];
}): Promise<void> {
  const lines = [
    `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)`,
    `Set-Location -LiteralPath ${escapePowerShellSingleQuoted(options.cwd)}`
  ];
  const mirrorLogsToConsole = options.mirrorLogsToConsole ?? false;
  const logFileLiteral = options.logFile ? escapePowerShellSingleQuoted(options.logFile) : null;
  const invocation = [
    "&",
    escapePowerShellSingleQuoted(options.command),
    ...options.args.map((arg) => escapePowerShellSingleQuoted(arg))
  ].join(" ");
  const redirected = logFileLiteral
    ? mirrorLogsToConsole
      ? `${invocation} 2>&1 | Tee-Object -FilePath ${logFileLiteral} -Append`
      : `${invocation} *>> ${logFileLiteral}`
    : mirrorLogsToConsole
      ? invocation
      : `${invocation} *> $null`;

  for (const line of options.bannerLines ?? []) {
    const literal = escapePowerShellSingleQuoted(line);
    if (logFileLiteral && mirrorLogsToConsole) {
      lines.push(`Write-Output ${literal} | Tee-Object -FilePath ${logFileLiteral} -Append`);
      continue;
    }
    if (logFileLiteral) {
      lines.push(`Write-Output ${literal} | Out-File -FilePath ${logFileLiteral} -Append -Encoding utf8`);
      continue;
    }
    lines.push(`Write-Output ${literal}`);
  }

  for (const [key, value] of Object.entries(options.env ?? {})) {
    lines.push(`$env:${key} = ${escapePowerShellSingleQuoted(value)}`);
  }

  lines.push(redirected);
  lines.push("exit $LASTEXITCODE");

  await fs.writeFile(options.scriptPath, `${lines.join("\r\n")}\r\n`, "utf8");
}

function startHiddenWindowsScript(scriptPath: string): number | null {
  const launcherArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath]
    .map((value) => escapePowerShellSingleQuoted(value))
    .join(", ");
  const launcher = [
    `$process = Start-Process`,
    `-FilePath ${escapePowerShellSingleQuoted("powershell.exe")}`,
    `-ArgumentList @(${launcherArgs})`,
    `-WindowStyle Hidden`,
    `-WorkingDirectory ${escapePowerShellSingleQuoted(path.dirname(scriptPath))}`,
    `-PassThru;`,
    `$process.Id`
  ].join(" ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", launcher], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(output || `Failed to start hidden Windows background process for ${scriptPath}`);
  }

  const pid = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(pid) ? pid : null;
}

function processExists(pid: number | null): boolean {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openFileForAppendWithRetry(filePath: string, attempts = 8): number | null {
  let lastCode = "";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return nodeFs.openSync(filePath, "a");
    } catch (error) {
      lastCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (!["EBUSY", "EPERM"].includes(lastCode)) {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150 * (attempt + 1));
    }
  }

  return null;
}

async function resetLogFile(logFile: string): Promise<void> {
  try {
    await fs.writeFile(logFile, "", "utf8");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (["EBUSY", "EPERM"].includes(code) && nodeFs.existsSync(logFile)) {
      return;
    }
    throw error;
  }
}

async function waitForProcessExit(pid: number | null, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now();
  while (processExists(pid)) {
    if (Date.now() - startedAt >= timeoutMs) {
      break;
    }
    await delay(100);
  }
}

function isIgnorableWindowsTaskkillFailure(output: string): boolean {
  const normalized = output.toLowerCase();
  return [
    "not found",
    "no running instance of the task",
    "the operation attempted is not supported",
    "找不到",
    "没有运行的任务实例",
    "此操作不受支持"
  ].some((pattern) => normalized.includes(pattern));
}

async function renameWithRetries(fromPath: string, toPath: string, attempts = 8): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fs.rename(fromPath, toPath);
      return;
    } catch (error) {
      lastError = error;
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (!["EBUSY", "EPERM", "ENOTEMPTY"].includes(code)) {
        throw error;
      }
      await delay(150 * (attempt + 1));
    }
  }

  throw lastError;
}

async function clearDirectoryContents(root: string): Promise<void> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const targetPath = path.join(root, entry.name);
    try {
      await fs.rm(targetPath, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 200
      });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (!["EBUSY", "EPERM", "ENOTEMPTY"].includes(code)) {
        throw error;
      }
      if (entry.isDirectory()) {
        await clearDirectoryContents(targetPath);
      }
    }
  }
}

async function findWindowsRuntimeProcessIds(runtimeRoot: string): Promise<number[]> {
  const query = [
    `$needle = ${escapePowerShellSingleQuoted(runtimeRoot.toLowerCase())}`,
    `Get-CimInstance Win32_Process |`,
    `Where-Object { $_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains($needle) } |`,
    `Select-Object -ExpandProperty ProcessId`
  ].join(" ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", query], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((value) => Number.isFinite(value) && value !== process.pid);
}

async function terminateWindowsRuntimeProcesses(runtimeRoot: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const pids = [...new Set(await findWindowsRuntimeProcessIds(runtimeRoot))];
    if (pids.length === 0) {
      return;
    }

    for (const pid of pids) {
      if (processExists(pid)) {
        await terminateProcessTree(pid);
      }
    }

    await delay(200 * (attempt + 1));
  }
}

function waitForPort(port: number, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();

  return new Promise((resolve) => {
    const attempt = () => {
      const socket = net.createConnection({ port, host: "127.0.0.1" });

      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - start >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(attempt, 250);
      });
    };

    attempt();
  });
}

async function findAvailablePort(startPort = 4310): Promise<number> {
  for (let port = startPort; port < startPort + 100; port += 1) {
    const isOpen = await waitForPort(port, 250);
    if (!isOpen) {
      return port;
    }
  }

  throw new Error("Unable to find an available port for the APCC site runtime.");
}

function normalizeSitePort(port?: number | null): number | null {
  if (port === undefined || port === null) {
    return null;
  }

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("docs-site port must be an integer between 1 and 65535.");
  }

  return port;
}

async function terminateProcessTree(pid: number): Promise<void> {
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      encoding: "utf8"
    });
    if (result.status !== 0) {
      const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      if (!processExists(pid) || isIgnorableWindowsTaskkillFailure(output)) {
        return;
      }
      throw new Error(output || `Failed to terminate PID ${pid}`);
    }
    await waitForProcessExit(pid);
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }

  await waitForProcessExit(pid);
}

async function writeRuntimeVersion(runtimeDataRoot: string): Promise<string> {
  const payload = {
    updatedAt: new Date().toISOString()
  };
  const versionFile = path.join(runtimeDataRoot, "version.json");
  await writeText(versionFile, `${JSON.stringify(payload, null, 2)}\n`);
  return versionFile;
}

async function writeRuntimeMetadata(stage: {
  siteId: string;
  sourceDocsRoot: string;
  sourceWorkspaceRoot: string | null;
  runtimeRoot: string;
  templateRoot: string;
  runtimeDataRoot: string;
  mode: "staged" | "live" | "build";
  port?: number;
  url?: string;
}) {
  const runtimeFile = path.join(stage.runtimeDataRoot, "runtime.json");
  await writeText(
    runtimeFile,
    `${JSON.stringify(
      {
        siteId: stage.siteId,
        sourceDocsRoot: stage.sourceDocsRoot,
        sourceWorkspaceRoot: stage.sourceWorkspaceRoot,
        runtimeRoot: stage.runtimeRoot,
        templateRoot: stage.templateRoot,
        mode: stage.mode,
        port: stage.port ?? null,
        url: stage.url ?? null,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`
  );
  return runtimeFile;
}

function isSameOrWithinPath(candidate: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveBuildOutputRoot(context: SiteSourceContext, outputPath?: string): string {
  if (outputPath && outputPath.trim().length > 0) {
    return path.resolve(outputPath);
  }

  if (context.sourceWorkspaceRoot) {
    return path.join(context.sourceWorkspaceRoot, "dist", "apcc-site");
  }

  return path.join(context.sourceDocsRoot, ".apcc-site-build");
}

function assertSafeBuildOutputRoot(outputRoot: string, context: SiteSourceContext): void {
  if (isSameOrWithinPath(outputRoot, context.sourceDocsRoot) || isSameOrWithinPath(context.sourceDocsRoot, outputRoot)) {
    throw new Error("site build output must be outside the source docs root.");
  }

  if (
    context.sourceWorkspaceRoot &&
    isSameOrWithinPath(context.sourceWorkspaceRoot, outputRoot)
  ) {
    throw new Error("site build output must not be the workspace root or one of its parent directories.");
  }
}

function sanitizeSnapshotForDeployment(snapshot: SiteControlPlaneSnapshot): SiteControlPlaneSnapshot {
  return {
    ...snapshot,
    workspace: {
      ...snapshot.workspace,
      root: null,
      docsRoot: "content/docs",
      workspaceRoot: null,
      hasWorkspace: false,
      activeChange: null,
      currentRoundId: null,
      stateDigest: null
    }
  };
}

function toFinalOutputPath(filePath: string, tempRoot: string, outputRoot: string): string {
  return path.join(outputRoot, path.relative(tempRoot, filePath));
}

async function writeDeployableSiteSupportFiles(outputRoot: string): Promise<void> {
  await writeText(
    path.join(outputRoot, "start.mjs"),
    [
      "import path from \"node:path\";",
      "import { fileURLToPath } from \"node:url\";",
      "",
      "const root = path.dirname(fileURLToPath(import.meta.url));",
      "process.chdir(root);",
      "process.env.NODE_ENV = process.env.NODE_ENV || \"production\";",
      "process.env.HOSTNAME = process.env.HOSTNAME || \"0.0.0.0\";",
      "process.env.PORT = process.env.PORT || \"4310\";",
      "process.env.APCC_RUNTIME_DATA_ROOT = process.env.APCC_RUNTIME_DATA_ROOT || path.join(root, \"runtime-data\");",
      "",
      "await import(\"./server.js\");",
      ""
    ].join("\n")
  );

  await writeText(
    path.join(outputRoot, "README.md"),
    [
      "# APCC Docs Site",
      "",
      "This directory is a deployable APCC docs-site build artifact.",
      "",
      "Run it with:",
      "",
      "```bash",
      "node start.mjs",
      "```",
      "",
      "Set `PORT` and `HOSTNAME` to control the listening address.",
      ""
    ].join("\n")
  );
}

async function resolveSiteRuntimeLocation(inputPath?: string): Promise<ResolvedSiteRuntimeLocation> {
  const sourceDocsRoot = await resolveDocsRoot(inputPath);
  const sourceWorkspaceRoot = tryResolveWorkspaceRootFromDocsRoot(sourceDocsRoot);
  const runtimeBase = getRuntimeBase();
  const siteId = createSiteId(sourceDocsRoot, sourceWorkspaceRoot);
  const runtimeRoot = getRuntimeRoot(siteId, runtimeBase);
  const runtimeDataRoot = path.join(runtimeRoot, "runtime-data");

  return {
    sourceDocsRoot,
    sourceWorkspaceRoot,
    siteId,
    runtimeBase,
    runtimeRoot,
    runtimeDataRoot,
    templateRoot: getTemplateRoot()
  };
}

async function stageSiteData(
  context: SiteSourceContext,
  runtimeRoot: string,
  options: StageSiteDataOptions
): Promise<Omit<StageResult, "runtimeBase" | "preferredPort" | "portSource">> {
  const { sourceDocsRoot, sourceWorkspaceRoot, docsLanguage, siteId } = context;
  const stagedDocsRoot = path.join(runtimeRoot, "content", "docs");
  const nextDocsRoot = path.join(runtimeRoot, "content", ".next-docs");
  const runtimeDataRoot = path.join(runtimeRoot, "runtime-data");
  const logFile = path.join(runtimeRoot, "runtime-data", "site.log");

  await fs.mkdir(runtimeRoot, { recursive: true });
  await fs.mkdir(runtimeDataRoot, { recursive: true });
  const shouldSyncDocs = options.syncDocs ?? true;
  const sourceFiles = await collectSiteSourceFiles(sourceDocsRoot);
  let pageCount = 0;

  if (shouldSyncDocs) {
    await fs.rm(nextDocsRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    await fs.mkdir(nextDocsRoot, { recursive: true });

    for (const relativePath of sourceFiles) {
      const sourceFile = path.join(sourceDocsRoot, relativePath);
      const targetFile = path.join(nextDocsRoot, relativePath);
      await fs.mkdir(path.dirname(targetFile), { recursive: true });
      await fs.copyFile(sourceFile, targetFile);

      if (isMarkdownFile(relativePath)) {
        pageCount += 1;
      }
    }

    await injectRuntimeConsoleDocs(nextDocsRoot, context.docsLanguage);
    await syncDirectoryContents(nextDocsRoot, stagedDocsRoot);
    await fs.rm(nextDocsRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } else {
    pageCount = sourceFiles.filter((relativePath) => isMarkdownFile(relativePath)).length;
  }

  const docsRevisionDataFile = path.join(runtimeDataRoot, "docs-revisions.json");
  const docsRevisionState = shouldSyncDocs
    ? await syncDocsRevisionState(sourceDocsRoot, docsRevisionDataFile)
    : await loadDocsRevisionState(docsRevisionDataFile);
  await writeText(docsRevisionDataFile, `${JSON.stringify(docsRevisionState, null, 2)}\n`);
  const snapshot = await buildSiteControlPlaneSnapshot(sourceDocsRoot, {
    docsRevisionState
  });
  const outputSnapshot = options.sanitizeForDeployment
    ? sanitizeSnapshotForDeployment(snapshot)
    : snapshot;
  const dataFile = path.join(runtimeDataRoot, "control-plane.json");
  await writeText(dataFile, `${JSON.stringify(outputSnapshot, null, 2)}\n`);
  const viewerData = await buildSiteViewerData(stagedDocsRoot);
  const viewerDataFile = path.join(runtimeDataRoot, "docs-viewer.json");
  await writeText(viewerDataFile, `${JSON.stringify(viewerData, null, 2)}\n`);
  const versionFile = await writeRuntimeVersion(runtimeDataRoot);
  const runtimeFile = await writeRuntimeMetadata({
    siteId,
    sourceDocsRoot: options.sanitizeForDeployment ? "content/docs" : sourceDocsRoot,
    sourceWorkspaceRoot: options.sanitizeForDeployment ? null : sourceWorkspaceRoot,
    runtimeRoot: options.sanitizeForDeployment ? "." : runtimeRoot,
    templateRoot: options.templateRoot,
    runtimeDataRoot,
    mode: options.mode,
    port: options.port,
    url: options.url
  });

  return {
    siteId,
    sourceDocsRoot,
    sourceWorkspaceRoot,
    docsLanguage,
    runtimeRoot,
    templateRoot: options.templateRoot,
    stagedDocsRoot,
    runtimeDataRoot,
    fileCount: sourceFiles.length,
    pageCount,
    registryFile: getRegistryFile(runtimeRoot),
    dataFile,
    docsRevisionDataFile,
    viewerDataFile,
    versionFile,
    runtimeFile,
    logFile
  };
}

export async function stageDocsForSiteRuntime(
  inputPath?: string,
  options: StageSiteRuntimeOptions = {}
): Promise<StageResult> {
  const context = await resolveSiteSourceContext(inputPath);
  const runtimeBase = getRuntimeBase();
  const runtimeRoot = getRuntimeRoot(context.siteId, runtimeBase);
  const existingRegistry = await readRegistry(runtimeRoot);
  const explicitPort = "preferredPort" in options ? normalizeSitePort(options.preferredPort) : null;
  const activeRegistry =
    existingRegistry &&
    existingRegistry.pid !== null &&
    existingRegistry.port > 0 &&
    existingRegistry.url.length > 0 &&
    existingRegistry.mode !== "build"
      ? existingRegistry
      : null;
  const staged = await stageSiteData(context, runtimeRoot, {
    ...options,
    mode: activeRegistry?.mode ?? "staged",
    port: activeRegistry?.port,
    url: activeRegistry?.url,
    templateRoot: activeRegistry?.templateRoot ?? getPrebuiltShellRoot()
  });

  return {
    ...staged,
    runtimeBase,
    preferredPort: explicitPort ?? context.workspaceConfig?.docsSite.preferredPort ?? null,
    portSource: explicitPort === null ? "workspace" : "explicit"
  };
}

function getPrebuiltShellRoot(): string {
  return getApccPackageFile("dist", "site-runtime-prebuilt");
}

function resolvePrebuiltShellPointerRoot(artifactBase: string, root: string): string {
  return path.isAbsolute(root) ? root : path.join(artifactBase, root);
}

function hasPrebuiltShell(root: string): boolean {
  return (
    nodeFs.existsSync(path.join(root, "server.js")) &&
    nodeFs.existsSync(path.join(root, ".next", "static"))
  );
}

async function findPackagedPrebuiltShell(artifactBase: string): Promise<string | null> {
  const entries = await fs.readdir(artifactBase, { withFileTypes: true }).catch(() => []);
  const shells = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("shell-"))
    .map((entry) => path.join(artifactBase, entry.name))
    .filter((entryPath) => hasPrebuiltShell(entryPath))
    .sort((left, right) => {
      const leftVersion = Number.parseInt(path.basename(left).replace(/^shell-/, ""), 10);
      const rightVersion = Number.parseInt(path.basename(right).replace(/^shell-/, ""), 10);
      return (Number.isFinite(rightVersion) ? rightVersion : 0) - (Number.isFinite(leftVersion) ? leftVersion : 0);
    });

  return shells[0] ?? null;
}

async function getLatestSourceMtime(root: string): Promise<number> {
  let latest = 0;

  async function walk(currentRoot: string): Promise<void> {
    const entries = await fs.readdir(currentRoot, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git" || entry.name === ".cache") {
        continue;
      }

      const absolutePath = path.join(currentRoot, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const stats = await fs.stat(absolutePath).catch(() => null);
      if (!stats) {
        continue;
      }

      latest = Math.max(latest, stats.mtimeMs);
    }
  }

  await walk(root);
  return latest;
}

async function ensureSiteRuntimeSourceDependencies(sourceRoot: string): Promise<void> {
  const nodeModulesRoot = path.join(sourceRoot, "node_modules");
  const npmCacheRoot = path.join(sourceRoot, ".cache", "npm");
  const nextPackage = path.join(nodeModulesRoot, "next");
  const nextPackageJson = path.join(nextPackage, "package.json");
  const nextRequireHook = path.join(nextPackage, "dist", "server", "require-hook.js");
  const requiredPackages = [
    ["next", "package.json"],
    ["fumadocs-ui", "package.json"],
    ["fumadocs-core", "package.json"],
    ["@orama", "tokenizers", "package.json"],
    ["@radix-ui", "react-accordion", "package.json"],
    ["@radix-ui", "react-progress", "package.json"],
    ["@radix-ui", "react-tooltip", "package.json"],
    ["sonner", "package.json"]
  ];
  const missingRequiredPackage = requiredPackages.some((segments) => !nodeFs.existsSync(path.join(nodeModulesRoot, ...segments)));

  if (!nodeFs.existsSync(nextPackageJson) || !nodeFs.existsSync(nextRequireHook) || missingRequiredPackage) {
    await fs.rm(nodeModulesRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    await fs.mkdir(npmCacheRoot, { recursive: true });
    const hasLockfile = nodeFs.existsSync(path.join(sourceRoot, "package-lock.json"));
    const invocation = createNpmInvocation([
      hasLockfile ? "ci" : "install",
      "--cache",
      npmCacheRoot,
      "--no-fund",
      "--no-audit"
    ]);
    const child = spawn(invocation.command, invocation.args, {
      cwd: sourceRoot,
      stdio: "inherit",
      shell: false
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      throw new Error(`site runtime source dependency install failed with exit code ${exitCode}`);
    }
  }
}

async function findWindowsPortProcessIds(port: number): Promise<number[]> {
  const query = [
    `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue |`,
    `Select-Object -ExpandProperty OwningProcess`
  ].join(" ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", query], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((value) => Number.isFinite(value) && value !== process.pid);
}

export async function buildPrebuiltSiteShellArtifact(): Promise<string> {
  const sourceRoot = getTemplateRoot();
  const artifactBase = getPrebuiltShellRoot();
  const latestPointerPath = path.join(artifactBase, "latest.json");
  const latestSourceMtime = await getLatestSourceMtime(sourceRoot);
  const artifactRoot = path.join(artifactBase, `shell-${Math.floor(latestSourceMtime)}`);

  for (const legacyEntry of [".next", "node_modules", "package.json", "server.js", "artifact-manifest.json"]) {
    await fs.rm(path.join(artifactBase, legacyEntry), {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 200
    }).catch(() => undefined);
  }

  const latestPointer = await readText(latestPointerPath)
    .then((content) => JSON.parse(content) as { root?: string; sourceMtimeMs?: number })
    .catch(() => null);
  const latestPointerRoot = latestPointer?.root
    ? resolvePrebuiltShellPointerRoot(artifactBase, latestPointer.root)
    : null;
  if (
    latestPointerRoot &&
    latestPointer?.sourceMtimeMs !== undefined &&
    latestPointer.sourceMtimeMs >= latestSourceMtime &&
    hasPrebuiltShell(latestPointerRoot)
  ) {
    if (latestPointer.root !== path.basename(latestPointerRoot)) {
      await writeText(
        latestPointerPath,
        `${JSON.stringify(
          {
            root: path.basename(latestPointerRoot),
            sourceMtimeMs: latestPointer.sourceMtimeMs
          },
          null,
          2
        )}\n`
      );
    }
    return latestPointerRoot;
  }

  if (hasPrebuiltShell(artifactRoot)) {
    await writeText(
      latestPointerPath,
      `${JSON.stringify(
        {
          root: path.basename(artifactRoot),
          sourceMtimeMs: latestSourceMtime
        },
        null,
        2
      )}\n`
    );
    return artifactRoot;
  }

  const packagedShell = await findPackagedPrebuiltShell(artifactBase);
  if (!nodeFs.existsSync(sourceRoot)) {
    if (packagedShell) {
      await writeText(
        latestPointerPath,
        `${JSON.stringify(
          {
            root: path.basename(packagedShell),
            sourceMtimeMs: latestSourceMtime
          },
          null,
          2
        )}\n`
      );
      return packagedShell;
    }

    throw new Error("APCC package is missing the prebuilt docs viewer shell.");
  }

  await ensureSiteRuntimeSourceDependencies(sourceRoot);
  await fs.rm(path.join(sourceRoot, ".next"), { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });

  const invocation = createNextInvocation(sourceRoot, "build");
  const child = spawn(invocation.command, invocation.args, {
    cwd: sourceRoot,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1"
    }
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`prebuilt docs shell build failed with exit code ${exitCode}`);
  }

  const standaloneRoot = path.join(sourceRoot, ".next", "standalone");
  const staticRoot = path.join(sourceRoot, ".next", "static");
  if (!nodeFs.existsSync(path.join(standaloneRoot, "server.js")) || !nodeFs.existsSync(staticRoot)) {
    throw new Error("prebuilt docs shell output is incomplete after build.");
  }

  const tempRoot = `${artifactRoot}.tmp-${Date.now()}`;
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(tempRoot, { recursive: true });
  await fs.cp(standaloneRoot, tempRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(tempRoot, ".next"), { recursive: true });
  await fs.cp(staticRoot, path.join(tempRoot, ".next", "static"), { recursive: true, force: true });
  if (nodeFs.existsSync(path.join(sourceRoot, "public"))) {
    await fs.cp(path.join(sourceRoot, "public"), path.join(tempRoot, "public"), {
      recursive: true,
      force: true
    });
  }
  await writeText(
    path.join(tempRoot, "artifact-manifest.json"),
    `${JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        sourceMtimeMs: latestSourceMtime
      },
      null,
      2
    )}\n`
  );

  await fs.mkdir(artifactBase, { recursive: true });
  await renameWithRetries(tempRoot, artifactRoot);
  await writeText(
    latestPointerPath,
    `${JSON.stringify(
      {
        root: path.basename(artifactRoot),
        sourceMtimeMs: latestSourceMtime
      },
      null,
      2
    )}\n`
  );

  return artifactRoot;
}

function watcherWorkerPath(): { command: string; args: string[]; cwd: string } {
  const currentPath = getCurrentModulePath();
  const root = getApccPackageRoot();
  const builtPath = path.join(root, "dist", "core", "site-watch-worker.js");
  const tsPath = path.join(root, "src", "core", "site-watch-worker.ts");
  const jsSiblingPath = currentPath.replace(/site\.js$/, "site-watch-worker.js");

  if (currentPath.endsWith(".ts") && nodeFs.existsSync(tsPath)) {
    return {
      command: process.execPath,
      args: ["--import", "tsx", tsPath],
      cwd: root
    };
  }

  if (nodeFs.existsSync(builtPath)) {
    return {
      command: process.execPath,
      args: [builtPath],
      cwd: root
    };
  }

  return {
    command: process.execPath,
    args: [jsSiblingPath],
    cwd: root
  };
}

async function ensureWatcher(stage: StageResult, registry: SiteRuntimeRegistry | null): Promise<number | null> {
  if (registry?.watcherPid && processExists(registry.watcherPid)) {
    return registry.watcherPid;
  }

  await fs.rm(path.join(stage.runtimeDataRoot, "site-watch.ready"), { force: true });
  const worker = watcherWorkerPath();
  const watcherLogFile = path.join(stage.runtimeDataRoot, "site-watch.log");
  if (process.platform === "win32") {
    const output = openFileForAppendWithRetry(watcherLogFile);
    const child = spawn(worker.command, [...worker.args, stage.sourceDocsRoot, stage.runtimeRoot], {
      cwd: worker.cwd,
      detached: true,
      stdio: output === null ? "ignore" : ["ignore", output, output],
      shell: false,
      windowsHide: true
    });
    child.unref();
    await waitForWatcherReady(stage.runtimeDataRoot);
    return child.pid ?? null;
  }

  const child = spawn(worker.command, [...worker.args, stage.sourceDocsRoot, stage.runtimeRoot], {
    cwd: worker.cwd,
    detached: true,
    stdio: "ignore",
    shell: false,
    windowsHide: true
  });
  child.unref();
  await waitForWatcherReady(stage.runtimeDataRoot);
  return child.pid ?? null;
}

async function waitForWatcherReady(runtimeDataRoot: string, timeoutMs = 10000): Promise<void> {
  const readyFile = path.join(runtimeDataRoot, "site-watch.ready");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const exists = await fs.stat(readyFile).then(() => true).catch(() => false);
    if (exists) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("site watcher did not become ready within the timeout.");
}

async function ensureSiteRuntimeServer(stage: StageResult, mode: "live") {
  const existing = await readRegistry(stage.runtimeRoot);
  const configuredPort = stage.preferredPort;
  const portLabel = stage.portSource === "explicit" ? "Requested" : "Configured";
  const existingIsHealthy = Boolean(
    existing && processExists(existing.pid) && (await waitForPort(existing.port, 500))
  );

  if (existingIsHealthy && configuredPort !== null && existing!.port !== configuredPort) {
    throw new Error(
      `${portLabel} docs-site port ${configuredPort} does not match the running runtime at ${existing!.url}. Stop it first before starting on a different port.`
    );
  }

  const preferredPort = existing && existing.port > 0 ? existing.port : configuredPort ?? 4310;
  const reuseExisting = existingIsHealthy;
  let port = reuseExisting ? existing!.port : preferredPort;
  let pid = reuseExisting ? existing!.pid : null;
  let watcherPid = existing?.watcherPid ?? null;
  const startedAt = reuseExisting ? (existing?.startedAt ?? new Date().toISOString()) : new Date().toISOString();

  if (!reuseExisting) {
    const shellRoot = await buildPrebuiltSiteShellArtifact();

    if (configuredPort !== null) {
      const configuredPortInUse = await waitForPort(configuredPort, 250);
      if (configuredPortInUse) {
        throw new Error(
          `${portLabel} docs-site port ${configuredPort} is already in use. Pick a different port, update .apcc/config/workspace.yaml, or free the port first.`
        );
      }
      port = configuredPort;
    } else {
      port = await findAvailablePort(preferredPort);
    }

    const invocation = createPrebuiltServerInvocation(shellRoot);
    const serverEnv = {
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "production",
      APCC_RUNTIME_DATA_ROOT: stage.runtimeDataRoot
    };
    await resetLogFile(stage.logFile);

    const output =
      process.platform === "win32"
        ? openFileForAppendWithRetry(stage.logFile)
        : nodeFs.openSync(stage.logFile, "w");
    const child = spawn(invocation.command, invocation.args, {
      cwd: shellRoot,
      detached: true,
      stdio: output === null ? "ignore" : ["ignore", output, output],
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        ...serverEnv
      }
    });
    child.unref();
    pid = child.pid ?? null;

    const ready = await waitForPort(port, 90000);
    if (!ready) {
      const failedUrl = `http://127.0.0.1:${port}/docs`;
      throw new Error(`site runtime did not become reachable at ${failedUrl} within the timeout.`);
    }
  }

  const url = `http://127.0.0.1:${port}/docs`;
  const shellRoot = await buildPrebuiltSiteShellArtifact();

  if (mode === "live") {
    watcherPid = await ensureWatcher(stage, existing);
  }

  const nextRegistry: SiteRuntimeRegistry = {
    siteId: stage.siteId,
    pid,
    watcherPid,
    port,
    url,
    runtimeBase: stage.runtimeBase,
    runtimeRoot: stage.runtimeRoot,
    templateRoot: shellRoot,
    sourceDocsRoot: stage.sourceDocsRoot,
    sourceWorkspaceRoot: stage.sourceWorkspaceRoot,
    stagedDocsRoot: stage.stagedDocsRoot,
    logFile: stage.logFile,
    startedAt,
    mode
  };

  await writeRegistry(nextRegistry);
  await writeRuntimeMetadata({
    siteId: stage.siteId,
    sourceDocsRoot: stage.sourceDocsRoot,
    sourceWorkspaceRoot: stage.sourceWorkspaceRoot,
    runtimeRoot: stage.runtimeRoot,
    templateRoot: shellRoot,
    runtimeDataRoot: stage.runtimeDataRoot,
      mode,
      port,
      url
    });
  await updateGlobalRegistry(stage.runtimeBase, {
    siteId: stage.siteId,
    sourceDocsRoot: stage.sourceDocsRoot,
    sourceWorkspaceRoot: stage.sourceWorkspaceRoot,
    runtimeRoot: stage.runtimeRoot,
    port,
    url,
    startedAt: nextRegistry.startedAt,
    mode
  });

  return {
    ...stage,
    url,
    port,
    alreadyRunning: reuseExisting,
    pid,
    watcherPid
  };
}

export async function buildSiteRuntime(inputPath?: string, options: SiteBuildOptions = {}) {
  const context = await resolveSiteSourceContext(inputPath);
  const outputRoot = resolveBuildOutputRoot(context, options.outputPath);
  assertSafeBuildOutputRoot(outputRoot, context);
  const shellRoot = await buildPrebuiltSiteShellArtifact();
  const tempRoot = `${outputRoot}.tmp-${Date.now()}`;
  let finalized = false;

  try {
    await fs.rm(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    await fs.mkdir(path.dirname(tempRoot), { recursive: true });
    await fs.cp(shellRoot, tempRoot, { recursive: true, force: true });

    const previousDocsRevisionFile = path.join(outputRoot, "runtime-data", "docs-revisions.json");
    if (nodeFs.existsSync(previousDocsRevisionFile)) {
      const nextDocsRevisionFile = path.join(tempRoot, "runtime-data", "docs-revisions.json");
      await fs.mkdir(path.dirname(nextDocsRevisionFile), { recursive: true });
      await fs.copyFile(previousDocsRevisionFile, nextDocsRevisionFile);
    }

    const staged = await stageSiteData(context, tempRoot, {
      mode: "build",
      sanitizeForDeployment: true,
      templateRoot: "."
    });
    await writeDeployableSiteSupportFiles(tempRoot);
    await writeText(
      path.join(tempRoot, "apcc-site-manifest.json"),
      `${JSON.stringify(
        {
          builtAt: new Date().toISOString(),
          framework: "fumadocs",
          sourceDocsRoot: "content/docs",
          sourceWorkspaceRoot: null,
          docsLanguage: context.docsLanguage,
          fileCount: staged.fileCount,
          pageCount: staged.pageCount
        },
        null,
        2
      )}\n`
    );

    await fs.rm(outputRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    await fs.mkdir(path.dirname(outputRoot), { recursive: true });
    await renameWithRetries(tempRoot, outputRoot);
    finalized = true;

    return {
      siteId: context.siteId,
      sourceDocsRoot: context.sourceDocsRoot,
      sourceWorkspaceRoot: context.sourceWorkspaceRoot,
      docsLanguage: context.docsLanguage,
      runtimeMode: "build",
      framework: "fumadocs",
      buildOutput: outputRoot,
      serverFile: path.join(outputRoot, "server.js"),
      startFile: path.join(outputRoot, "start.mjs"),
      startCommand: "node start.mjs",
      stagedDocsRoot: toFinalOutputPath(staged.stagedDocsRoot, tempRoot, outputRoot),
      runtimeDataRoot: toFinalOutputPath(staged.runtimeDataRoot, tempRoot, outputRoot),
      fileCount: staged.fileCount,
      pageCount: staged.pageCount,
      dataFile: toFinalOutputPath(staged.dataFile, tempRoot, outputRoot),
      docsRevisionDataFile: toFinalOutputPath(staged.docsRevisionDataFile, tempRoot, outputRoot),
      viewerDataFile: toFinalOutputPath(staged.viewerDataFile, tempRoot, outputRoot),
      versionFile: toFinalOutputPath(staged.versionFile, tempRoot, outputRoot),
      runtimeFile: toFinalOutputPath(staged.runtimeFile, tempRoot, outputRoot)
    };
  } finally {
    if (!finalized) {
      await fs.rm(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(() => undefined);
    }
  }
}

export async function getSiteRuntimeStatus(inputPath?: string): Promise<SiteRuntimeStatusEntry> {
  const context = await resolveSiteSourceContext(inputPath);
  const runtimeBase = getRuntimeBase();
  const runtimeRoot = getRuntimeRoot(context.siteId, runtimeBase);
  const runtimeDataRoot = path.join(runtimeRoot, "runtime-data");
  const [registry, metadata] = await Promise.all([
    readRegistry(runtimeRoot),
    readRuntimeMetadata(runtimeDataRoot)
  ]);
  const runtimePresent = nodeFs.existsSync(runtimeRoot);
  const healthy = registry ? await isSiteRuntimeRegistryHealthy(registry) : false;

  if (healthy && registry) {
    return {
      siteId: context.siteId,
      sourceDocsRoot: context.sourceDocsRoot,
      sourceWorkspaceRoot: context.sourceWorkspaceRoot,
      runtimeRoot,
      runtimeDataRoot,
      docsLanguage: context.docsLanguage,
      preferredPort: context.workspaceConfig?.docsSite.preferredPort ?? null,
      state: "live",
      runtimePresent,
      healthy: true,
      stagedDocsRoot: registry.stagedDocsRoot,
      port: registry.port,
      url: registry.url,
      startedAt: registry.startedAt,
      pid: registry.pid,
      watcherPid: registry.watcherPid,
      logFile: registry.logFile
    };
  }

  if (runtimePresent || registry || metadata) {
    return {
      siteId: context.siteId,
      sourceDocsRoot: context.sourceDocsRoot,
      sourceWorkspaceRoot: context.sourceWorkspaceRoot,
      runtimeRoot,
      runtimeDataRoot,
      docsLanguage: context.docsLanguage,
      preferredPort: context.workspaceConfig?.docsSite.preferredPort ?? null,
      state: "staged",
      runtimePresent,
      healthy: false,
      stagedDocsRoot: registry?.stagedDocsRoot ?? path.join(runtimeRoot, "content", "docs"),
      port: null,
      url: null,
      startedAt: registry?.startedAt ?? metadata?.updatedAt ?? null,
      pid: null,
      watcherPid: null,
      logFile: registry?.logFile ?? path.join(runtimeDataRoot, "site.log")
    };
  }

  return {
    siteId: context.siteId,
    sourceDocsRoot: context.sourceDocsRoot,
    sourceWorkspaceRoot: context.sourceWorkspaceRoot,
    runtimeRoot,
    runtimeDataRoot,
    docsLanguage: context.docsLanguage,
    preferredPort: context.workspaceConfig?.docsSite.preferredPort ?? null,
    state: "absent",
    runtimePresent: false,
    healthy: false,
    stagedDocsRoot: null,
    port: null,
    url: null,
    startedAt: null,
    pid: null,
    watcherPid: null,
    logFile: null
  };
}

export async function startSiteRuntime(inputPath?: string, options: StartSiteRuntimeOptions = {}) {
  const stage = await stageDocsForSiteRuntime(inputPath, {
    preferredPort: options.port
  });
  return ensureSiteRuntimeServer(stage, "live");
}

export async function devSiteRuntime(inputPath?: string, options: StartSiteRuntimeOptions = {}) {
  return startSiteRuntime(inputPath, options);
}

async function stopSiteRuntimeAtLocation(target: ResolvedSiteRuntimeLocation) {
  const registry = await readRegistry(target.runtimeRoot);

  if (registry?.watcherPid && processExists(registry.watcherPid)) {
    await terminateProcessTree(registry.watcherPid);
  }

  if (registry?.pid && processExists(registry.pid)) {
    await terminateProcessTree(registry.pid);
  }

  if (process.platform === "win32" && nodeFs.existsSync(target.runtimeRoot)) {
    await terminateWindowsRuntimeProcesses(target.runtimeRoot);
    if ((registry?.port ?? 0) > 0 && (await waitForPort(registry!.port, 500))) {
      for (const pid of await findWindowsPortProcessIds(registry!.port)) {
        if (processExists(pid)) {
          await terminateProcessTree(pid);
        }
      }
    }
  }

  const runtimeExists = nodeFs.existsSync(target.runtimeRoot);
  if (runtimeExists) {
    const nextRegistry: SiteRuntimeRegistry = {
      siteId: target.siteId,
      pid: null,
      watcherPid: null,
      port: registry?.port ?? 0,
      url: registry?.url ?? "",
      runtimeBase: target.runtimeBase,
      runtimeRoot: target.runtimeRoot,
      templateRoot: target.templateRoot,
      sourceDocsRoot: target.sourceDocsRoot,
      sourceWorkspaceRoot: target.sourceWorkspaceRoot,
      stagedDocsRoot: registry?.stagedDocsRoot ?? path.join(target.runtimeRoot, "content", "docs"),
      logFile: registry?.logFile ?? path.join(target.runtimeDataRoot, "site.log"),
      startedAt: registry?.startedAt ?? new Date().toISOString(),
      mode: registry?.mode ?? "live"
    };
    await fs.mkdir(target.runtimeDataRoot, { recursive: true });
    await writeRegistry(nextRegistry);
    await writeRuntimeMetadata({
      siteId: target.siteId,
      sourceDocsRoot: target.sourceDocsRoot,
      sourceWorkspaceRoot: target.sourceWorkspaceRoot,
      runtimeRoot: target.runtimeRoot,
      templateRoot: target.templateRoot,
      runtimeDataRoot: target.runtimeDataRoot,
      mode: "staged"
    });
  }

  await removeGlobalRegistryEntry(target.runtimeBase, target.siteId);

  return {
    runtimeBase: target.runtimeBase,
    runtimeRoot: target.runtimeRoot,
    siteId: target.siteId,
    stopped: Boolean(registry?.pid || registry?.watcherPid || runtimeExists),
    preservedRuntime: runtimeExists,
    terminatedPid: registry?.pid ?? null,
    terminatedWatcherPid: registry?.watcherPid ?? null
  };
}

export async function stopSiteRuntime(inputPath?: string) {
  const target = await resolveSiteRuntimeLocation(inputPath);
  return stopSiteRuntimeAtLocation(target);
}

export async function cleanSiteRuntime(inputPath?: string) {
  const stopResult = await stopSiteRuntime(inputPath);
  const { runtimeBase, runtimeRoot, siteId } = stopResult;
  const existed = nodeFs.existsSync(runtimeRoot);

  if (existed) {
    const tombstoneRoot = `${runtimeRoot}.deleting-${Date.now()}`;
    try {
      await renameWithRetries(runtimeRoot, tombstoneRoot);
      await fs.rm(tombstoneRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (!["EBUSY", "EPERM", "ENOTEMPTY"].includes(code)) {
        throw error;
      }
      await clearDirectoryContents(runtimeRoot);
      await fs.rmdir(runtimeRoot).catch(() => undefined);
    }
  }

  await removeGlobalRegistryEntry(runtimeBase, siteId);

  return {
    runtimeBase,
    runtimeRoot,
    siteId,
    cleaned: existed,
    terminatedPid: stopResult.terminatedPid,
    terminatedWatcherPid: stopResult.terminatedWatcherPid
  };
}

export async function listSiteRuntimes(runtimeBase = getRuntimeBase()): Promise<SiteRuntimeListEntry[]> {
  const entries = await listGlobalSiteEntries(runtimeBase);
  const healthyEntries = await Promise.all(
    entries.map(async (entry) => {
      if (!(await isSiteRegistryEntryHealthy(entry))) {
        return null;
      }

      return {
        siteId: entry.siteId,
        projectName: await readProjectNameForSiteEntry(entry.sourceWorkspaceRoot),
        sourceDocsRoot: entry.sourceDocsRoot,
        sourceWorkspaceRoot: entry.sourceWorkspaceRoot,
        runtimeRoot: entry.runtimeRoot,
        port: entry.port,
        url: entry.url,
        startedAt: entry.startedAt,
        mode: entry.mode
      } satisfies SiteRuntimeListEntry;
    })
  );

  return healthyEntries.filter((entry): entry is SiteRuntimeListEntry => entry !== null);
}

export async function stopAllSiteRuntimes(runtimeBase = getRuntimeBase()) {
  const entries = await listGlobalSiteEntries(runtimeBase);
  const results = await Promise.all(
    entries.map(async (entry) => {
      const registry = await readRegistry(entry.runtimeRoot);
      const target = targetFromGlobalSiteEntry(
        entry,
        registry?.templateRoot ?? getPrebuiltShellRoot()
      );
      const result = await stopSiteRuntimeAtLocation(target);
      const projectName = await readProjectNameForSiteEntry(entry.sourceWorkspaceRoot);

      return {
        siteId: entry.siteId,
        projectName,
        sourceDocsRoot: entry.sourceDocsRoot,
        sourceWorkspaceRoot: entry.sourceWorkspaceRoot,
        runtimeRoot: entry.runtimeRoot,
        stopped: result.stopped,
        preservedRuntime: result.preservedRuntime,
        terminatedPid: result.terminatedPid,
        terminatedWatcherPid: result.terminatedWatcherPid
      };
    })
  );

  return {
    count: results.length,
    items: results
  };
}
