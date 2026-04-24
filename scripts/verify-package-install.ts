import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function npmInvocation(args: string[]): { command: string; args: string[] } {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec ?? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe"),
      args: ["/c", "npm", ...args]
    };
  }

  return {
    command: "npm",
    args
  };
}

function run(command: string, args: string[], options: { cwd?: string; shell?: boolean } = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    shell: options.shell ?? false
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`,
        result.error instanceof Error ? result.error.message : "",
        result.stdout?.trim() ?? "",
        result.stderr?.trim() ?? ""
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return result.stdout;
}

function runInstalledBin(binPath: string, args: string[], options: { cwd?: string } = {}) {
  if (process.platform === "win32") {
    return run(binPath, args, { ...options, shell: true });
  }

  return run(binPath, args, options);
}

const packRoot = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-pack-"));
const installRoot = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-install-"));
const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-installed-workspace-"));

try {
  const packInvocation = npmInvocation(["pack", "--pack-destination", packRoot, "--silent"]);
  const packedName = run(packInvocation.command, packInvocation.args).trim();
  const tarballPath = path.join(packRoot, packedName);

  const installInvocation = npmInvocation(["install", "--prefix", installRoot, tarballPath, "--silent"]);
  run(installInvocation.command, installInvocation.args);

  const binPath = path.join(installRoot, "node_modules", ".bin", process.platform === "win32" ? "apcc.cmd" : "apcc");
  const helpOutput = runInstalledBin(binPath, ["--help"]);
  if (!helpOutput.includes("APCC CLI")) {
    throw new Error("installed apcc --help did not render the expected CLI help output.");
  }

  const guideIndexOutput = runInstalledBin(binPath, ["guide"]);
  if (!guideIndexOutput.includes("# APCC Guide") || !guideIndexOutput.includes("workflow")) {
    throw new Error("installed apcc guide did not render the bundled guide topic index.");
  }

  const publicTopic = (await fs.readdir(path.join(root, "docs", "public")))
    .filter((fileName) => /\.(md|mdx)$/i.test(fileName))
    .map((fileName) => fileName.replace(/\.(md|mdx)$/i, ""))
    .sort((a, b) => a.localeCompare(b))[0];
  if (!publicTopic) {
    throw new Error("no public docs topic is available for package install smoke verification.");
  }

  const publicGuideOutput = runInstalledBin(binPath, ["guide", publicTopic]);
  if (!publicGuideOutput.includes("# ")) {
    throw new Error(`installed apcc guide ${publicTopic} did not render a markdown document.`);
  }

  const workflowGuideOutput = runInstalledBin(binPath, ["guide", "workflow"]);
  if (!workflowGuideOutput.includes("# APCC Workflow Guide")) {
    throw new Error("installed apcc guide workflow did not render the workflow guide.");
  }

  runInstalledBin(binPath, [
    "init",
    "--target-path",
    workspaceRoot,
    "--project-name",
    "PackageInstallSmoke",
    "--project-summary",
    "PackageInstallSmoke",
    "--end-goal-name",
    "ValidateInstalledCli",
    "--end-goal-summary",
    "ValidateInstalledCli"
  ]);

  const planAddOutput = runInstalledBin(
    binPath,
    [
      "plan",
      "add",
      "--id",
      "release-hardening",
      "--name",
      "ReleaseHardening",
      "--parent",
      "root",
      "--summary",
      "ReleaseHardening"
    ],
    { cwd: workspaceRoot }
  );
  if (!planAddOutput.includes("release-hardening") || planAddOutput.includes("Top-level Plans")) {
    throw new Error("installed apcc plan add did not render a concise changed-plan delta.");
  }

  const taskAddOutput = runInstalledBin(
    binPath,
    [
      "task",
      "add",
      "--id",
      "release-check",
      "--name",
      "ReleaseCheck",
      "--parent",
      "root",
      "--plan",
      "release-hardening",
      "--summary",
      "ReleaseCheck"
    ],
    { cwd: workspaceRoot }
  );
  if (!taskAddOutput.includes("release-check") || taskAddOutput.includes("Task Tree")) {
    throw new Error("installed apcc task add did not render a concise changed-task delta.");
  }

  const validationOutput = runInstalledBin(binPath, ["validate"], { cwd: workspaceRoot });
  if (!validationOutput.includes("OK: yes")) {
    throw new Error("installed apcc validate did not report OK: yes.");
  }

  const siteBuildOutput = runInstalledBin(binPath, ["site", "build"], { cwd: workspaceRoot });
  const siteBuildRoot = path.join(workspaceRoot, "dist", "apcc-site");
  if (
    !siteBuildOutput.includes("Build output") ||
    !(await fs.stat(path.join(siteBuildRoot, "server.js")).then(() => true).catch(() => false)) ||
    !(await fs.stat(path.join(siteBuildRoot, "runtime-data", "docs-viewer.json")).then(() => true).catch(() => false))
  ) {
    throw new Error("installed apcc site build did not create a deployable docs-site artifact.");
  }

  console.log(
    JSON.stringify(
      {
        tarballPath,
        installRoot,
        workspaceRoot,
        ok: true
      },
      null,
      2
    )
  );
} finally {
  await Promise.all([
    fs.rm(packRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
    fs.rm(installRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
    fs.rm(workspaceRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  ]);
}
