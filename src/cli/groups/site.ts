import { AclipApp, booleanArgument, integerArgument, stringArgument } from "@rendo-studio/aclip";
import {
  buildSiteRuntime,
  cleanSiteRuntime,
  getSiteRuntimeStatus,
  listSiteRuntimes,
  startSiteRuntime,
  stopAllSiteRuntimes,
  stopSiteRuntime
} from "../../core/site.js";
import { withGuideHint } from "../guide-hint.js";

export function registerSiteGroup(app: AclipApp) {
  app
    .group("site", {
      summary: "Run the docs site view.",
      description: withGuideHint(
        "Start a local live docs-site view or build a deployable read-only docs-site artifact from a project root or docs-pack path."
      )
    })
    .command("start", {
      summary: "Start or reuse the local docs site runtime.",
      description: withGuideHint(
        "Resolve the configured or explicit docs pack path, stage runtime data, start or reuse the shared prebuilt viewer shell, and return the live access URL."
      ),
      arguments: [
        stringArgument("path", {
          required: false,
          description: "Optional project root or docs-pack path. Defaults to the configured docs-site source path."
        }),
        integerArgument("port", {
          required: false,
          description: "Optional explicit local port for this site start. Reuses the runtime only when the running port already matches.",
          flag: "--port"
        })
      ],
      examples: [
        "apcc site start",
        "apcc site start --port 4317",
        "apcc site start --path D:/project/example",
        "apcc site start --path D:/project/example/docs",
        "apcc site start --path D:/project/example --port 4317"
      ],
      handler: async ({ path, port }) => {
        const runtime = await startSiteRuntime(path ? String(path) : undefined, {
          port: typeof port === "number" ? port : undefined
        });
        return {
          site: {
            sourcePath: runtime.sourceDocsRoot,
            runtimeMode: "live",
            framework: "fumadocs",
            runtimeRoot: runtime.runtimeRoot,
            stagedSourcePath: runtime.sourceDocsRoot,
            stagedDocsRoot: runtime.stagedDocsRoot,
            stagedFileCount: runtime.fileCount,
            port: runtime.port,
            url: runtime.url,
            alreadyRunning: runtime.alreadyRunning,
            pid: runtime.pid,
            logFile: runtime.logFile
          }
        };
      }
    })
    .command("status", {
      summary: "Inspect the local docs site runtime for one workspace.",
      description: withGuideHint(
        "Read whether the targeted docs-site runtime is absent, staged, or live, and report the current URL and port only when a healthy live instance exists."
      ),
      arguments: [
        stringArgument("path", {
          required: false,
          description: "Optional project root or docs-pack path. Defaults to the configured docs-site source path."
        })
      ],
      examples: ["apcc site status", "apcc site status --path D:/project/example"],
      handler: async ({ path }) => {
        const runtime = await getSiteRuntimeStatus(path ? String(path) : undefined);
        return {
          site: {
            sourcePath: runtime.sourceDocsRoot,
            state: runtime.state,
            runtimeMode: runtime.state,
            framework: "fumadocs",
            runtimeRoot: runtime.runtimeRoot,
            runtimeDataRoot: runtime.runtimeDataRoot,
            stagedDocsRoot: runtime.stagedDocsRoot,
            preferredPort: runtime.preferredPort,
            docsLanguage: runtime.docsLanguage,
            port: runtime.port,
            url: runtime.url,
            healthy: runtime.healthy,
            runtimePresent: runtime.runtimePresent,
            startedAt: runtime.startedAt,
            pid: runtime.pid,
            watcherPid: runtime.watcherPid,
            logFile: runtime.logFile
          }
        };
      }
    })
    .command("list", {
      summary: "List running local docs site runtimes.",
      description: withGuideHint(
        "Show the currently healthy APCC docs-site runtimes with their project identity, docs root, URL, and runtime state."
      ),
      examples: ["apcc site list"],
      handler: async () => ({
        site: {
          items: await listSiteRuntimes()
        }
      })
    })
    .command("build", {
      summary: "Build a deployable docs site artifact.",
      description: withGuideHint(
        "Build a standalone, read-only APCC docs site artifact from the configured or explicit docs pack without stopping any live runtime."
      ),
      arguments: [
        stringArgument("path", {
          required: false,
          description: "Optional project root or docs-pack path. Defaults to the current workspace docs."
        }),
        stringArgument("out", {
          required: false,
          description: "Optional output directory. Defaults to dist/apcc-site for APCC workspaces.",
          flag: "--out"
        })
      ],
      examples: [
        "apcc site build",
        "apcc site build --path D:/project/example/docs",
        "apcc site build --out ./public-docs-site"
      ],
      handler: async ({ path, out }) => ({
        site: await buildSiteRuntime(path ? String(path) : undefined, {
          outputPath: out ? String(out) : undefined
        })
      })
    })
    .command("stop", {
      summary: "Stop the local docs runtime but keep the staged runtime.",
      description: withGuideHint(
        "Terminate the managed local docs server and watcher while preserving the staged runtime so the next start can restart faster. Use --all to stop every active APCC docs runtime."
      ),
      arguments: [
        booleanArgument("all", {
          required: false,
          description: "Stop every active APCC docs runtime instead of only one targeted workspace.",
          flag: "--all"
        }),
        stringArgument("path", {
          required: false,
          description: "Optional project root or docs-pack path. Defaults to the configured docs-site source path."
        })
      ],
      examples: [
        "apcc site stop",
        "apcc site stop --path D:/project/example",
        "apcc site stop --all"
      ],
      handler: async ({ all, path }) => {
        if (all && path) {
          throw new Error("Use either --all or --path for site stop, not both.");
        }

        return {
          site: all ? await stopAllSiteRuntimes() : await stopSiteRuntime(path ? String(path) : undefined)
        };
      }
    })
    .command("clean", {
      summary: "Stop and clean the local docs runtime.",
      description: withGuideHint(
        "Terminate the managed local docs server if it is running and remove the staged runtime so the next start begins from a cold state."
      ),
      arguments: [
        stringArgument("path", {
          required: false,
          description: "Optional project root or docs-pack path. Defaults to the configured docs-site source path."
        })
      ],
      examples: ["apcc site clean", "apcc site clean --path D:/project/example"],
      handler: async ({ path }) => ({
        site: await cleanSiteRuntime(path ? String(path) : undefined)
      })
    });
}
