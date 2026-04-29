import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const smokeRoot = path.join(root, ".tmp", "production-smoke", "verify-package-install");

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

function quoteCmdArg(value: string): string {
  if (!/[\s"&()^<>|]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function runInstalledBin(binPath: string, args: string[], options: { cwd?: string } = {}) {
  if (process.platform === "win32") {
    const shell = process.env.ComSpec ?? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe");
    const wrapperPath = path.join(os.tmpdir(), `apcc-installed-bin-${randomUUID()}.cmd`);
    const commandLine = `@echo off\r\ncall ${quoteCmdArg(binPath)} ${args.map(quoteCmdArg).join(" ")}\r\n`;
    writeFileSync(wrapperPath, commandLine, "utf8");
    try {
      return run(shell, ["/d", "/s", "/c", quoteCmdArg(wrapperPath)], options);
    } finally {
      try {
        unlinkSync(wrapperPath);
      } catch {
        // best-effort cleanup
      }
    }
  }

  return run(binPath, args, options);
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

const packRoot = path.join(smokeRoot, "pack");
const installRoot = path.join(smokeRoot, "install");
const workspaceRoot = path.join(smokeRoot, "workspace");

try {
  await fs.rm(smokeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  await fs.mkdir(packRoot, { recursive: true });
  const packInvocation = npmInvocation(["pack", "--pack-destination", packRoot, "--silent"]);
  const packedName = run(packInvocation.command, packInvocation.args).trim();
  const tarballPath = path.join(packRoot, packedName);

  const installInvocation = npmInvocation(["install", "--prefix", installRoot, tarballPath, "--silent"]);
  run(installInvocation.command, installInvocation.args);

  const packageRoot = path.join(installRoot, "node_modules", "apcc");
  const binPath = path.join(installRoot, "node_modules", ".bin", process.platform === "win32" ? "apcc.cmd" : "apcc");
  const requestedPort = await reserveAvailablePort();
  const packagedCliEntry = path.join(packageRoot, "dist", "bin", "apcc.cjs");
  const packagedCliManifest = path.join(packageRoot, "dist", "bin", "apcc.aclip.json");
  if (
    !(await fs.stat(packagedCliEntry).then(() => true).catch(() => false)) ||
    !(await fs.stat(packagedCliManifest).then(() => true).catch(() => false))
  ) {
    throw new Error("installed package is missing the ACLIP-built CLI artifact or manifest.");
  }

  const helpOutput = runInstalledBin(binPath, ["--help"]);
  if (!helpOutput.includes("APCC CLI")) {
    throw new Error("installed apcc --help did not render the expected CLI help output.");
  }
  const directArtifactHelpOutput = run(process.execPath, [packagedCliEntry, "--help"]);
  if (!directArtifactHelpOutput.includes("APCC CLI")) {
    throw new Error("installed ACLIP-built CLI artifact did not render the expected help output.");
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
  const contractGuideOutput = runInstalledBin(binPath, ["guide", "control-plane-contract"]);
  if (
    !contractGuideOutput.includes("# Control Plane Contract") ||
    !contractGuideOutput.includes("status: pending") ||
    !contractGuideOutput.includes("versionRef: null")
  ) {
    throw new Error("installed apcc guide control-plane-contract did not render the bundled control-plane contract.");
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
    "VerifyInstalledCli",
    "--end-goal-summary",
    "VerifyInstalledCli"
  ]);

  const versionNewOutput = runInstalledBin(
    binPath,
    [
      "version",
      "new",
      "--version",
      "0.3.4",
      "--title",
      "Release Scope",
      "--summary",
      "ReleaseScope"
    ],
    { cwd: workspaceRoot }
  );
  if (!versionNewOutput.includes("# Version") || !versionNewOutput.includes("0.3.4")) {
    throw new Error("installed apcc version new did not create or render the expected version record.");
  }

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

  runInstalledBin(
    binPath,
    [
      "plan",
      "add",
      "--id",
      "release-0-3-4",
      "--name",
      "Release034",
      "--parent",
      "root",
      "--summary",
      "Release034",
      "--version",
      "0.3.4"
    ],
    { cwd: workspaceRoot }
  );
  runInstalledBin(
    binPath,
    [
      "task",
      "add",
      "--id",
      "release-0-3-4-check",
      "--name",
      "Release034Check",
      "--parent",
      "root",
      "--plan",
      "release-0-3-4",
      "--summary",
      "Release034Check"
    ],
    { cwd: workspaceRoot }
  );

  const versionedPlanShowOutput = runInstalledBin(binPath, ["plan", "show", "--version", "0.3.4"], {
    cwd: workspaceRoot
  });
  if (
    !versionedPlanShowOutput.includes("Version scope: 0.3.4") ||
    !versionedPlanShowOutput.includes("release-0-3-4") ||
    versionedPlanShowOutput.includes("release-hardening")
  ) {
    throw new Error("installed apcc plan show --version did not filter plans by effective version scope.");
  }

  const versionedTaskListOutput = runInstalledBin(binPath, ["task", "list", "--version", "0.3.4"], {
    cwd: workspaceRoot
  });
  if (
    !versionedTaskListOutput.includes("Version scope: 0.3.4") ||
    !versionedTaskListOutput.includes("release-0-3-4-check") ||
    versionedTaskListOutput.includes("release-check")
  ) {
    throw new Error("installed apcc task list --version did not filter tasks by effective plan version scope.");
  }

  const unversionedTaskListOutput = runInstalledBin(binPath, ["task", "list", "--unversioned"], {
    cwd: workspaceRoot
  });
  if (
    !unversionedTaskListOutput.includes("Version scope: unversioned") ||
    !unversionedTaskListOutput.includes("release-check") ||
    unversionedTaskListOutput.includes("release-0-3-4-check")
  ) {
    throw new Error("installed apcc task list --unversioned did not isolate unversioned task scopes.");
  }

  const doctorCheckOutput = runInstalledBin(binPath, ["doctor", "check"], { cwd: workspaceRoot });
  if (!doctorCheckOutput.includes("# Doctor") || !doctorCheckOutput.includes("- Status: `pass`")) {
    throw new Error("installed apcc doctor check did not report a healthy workspace.");
  }

  const siteStartOutput = runInstalledBin(binPath, ["site", "start", "--port", String(requestedPort)], {
    cwd: workspaceRoot
  });
  if (!siteStartOutput.includes(`Port: \`${requestedPort}\``)) {
    throw new Error("installed apcc site start did not launch the packaged docs-site runtime on the requested port.");
  }
  const siteStatusJson = JSON.parse(runInstalledBin(binPath, ["site", "status", "--json"], { cwd: workspaceRoot })) as {
    site?: { runtimeRoot?: string; state?: string };
  };
  const runtimeRoot = siteStatusJson.site?.runtimeRoot;
  if (!runtimeRoot || siteStatusJson.site?.state !== "live") {
    throw new Error("installed apcc site status --json did not expose a live runtime root after site start.");
  }
  const siteRegistry = JSON.parse(
    await fs.readFile(path.join(runtimeRoot, "runtime-data", "registry.json"), "utf8")
  ) as { templateRoot?: string };
  if (!siteRegistry.templateRoot?.startsWith(path.join(packageRoot, "dist", "site-runtime-prebuilt"))) {
    throw new Error("installed apcc site start did not keep using the packaged dist/site-runtime-prebuilt shell.");
  }
  runInstalledBin(binPath, ["site", "stop"], { cwd: workspaceRoot });

  const doctorCheckJson = JSON.parse(runInstalledBin(binPath, ["doctor", "check", "--json"], { cwd: workspaceRoot })) as {
    doctor?: { checks?: unknown[]; guidance_md?: string; validation?: unknown };
  };
  if (!Array.isArray(doctorCheckJson.doctor?.checks) || "validation" in (doctorCheckJson.doctor ?? {})) {
    throw new Error("installed apcc doctor check --json did not expose the expected ACLIP doctor payload shape.");
  }

  await fs.rm(path.join(workspaceRoot, ".apcc", "config", "workspace.yaml"), { force: true });
  const doctorFixOutput = runInstalledBin(binPath, ["doctor", "fix"], { cwd: workspaceRoot });
  if (!doctorFixOutput.includes("# Doctor Fix") || !doctorFixOutput.includes("- Repaired: yes")) {
    throw new Error("installed apcc doctor fix did not repair the damaged workspace.");
  }
  const doctorFixJson = JSON.parse(runInstalledBin(binPath, ["doctor", "fix", "--json"], { cwd: workspaceRoot })) as {
    doctor?: { workspace?: unknown; validation?: unknown };
  };
  if (!doctorFixJson.doctor?.workspace || "validation" in (doctorFixJson.doctor ?? {})) {
    throw new Error("installed apcc doctor fix --json did not expose the expected repair payload shape.");
  }

  const doctorCheckAfterFix = runInstalledBin(binPath, ["doctor", "check"], { cwd: workspaceRoot });
  if (!doctorCheckAfterFix.includes("- Status: `pass`")) {
    throw new Error("installed apcc doctor check did not pass after doctor fix repaired the workspace.");
  }

  let legacyValidateStillWorks = false;
  try {
    runInstalledBin(binPath, ["validate"], { cwd: workspaceRoot });
    legacyValidateStillWorks = true;
  } catch {
    legacyValidateStillWorks = false;
  }
  if (legacyValidateStillWorks) {
    throw new Error("installed apcc validate still resolved after the doctor migration removed the legacy command.");
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
