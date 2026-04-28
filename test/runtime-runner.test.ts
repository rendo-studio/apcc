import { AclipApp } from "@rendo-studio/aclip";
import { describe, expect, it } from "vitest";

import { runAppWithRenderedIo } from "../src/cli/runtime-runner.js";

function createRenderTestApp(): AclipApp {
  const app = new AclipApp({
    name: "apcc",
    version: "0.2.1",
    summary: "APCC CLI.",
    description: "APCC CLI."
  });

  app.command("status", {
    summary: "Show status.",
    description: "Show status.",
    examples: ["apcc status"],
    handler: async () => ({
      status: {
        endGoal: {
          name: "Ship APCC",
          summary: "Keep the workspace stable.",
          successCriteria: ["Stable control plane."],
          nonGoals: ["Hosted service."]
        },
        phase: "Release hardening",
        progress: {
          percent: 50,
          countedTasks: 2,
          doneTasks: 1
        },
        topLevelPlans: ["Release hardening [in_progress]"],
        nextActions: ["Verify the built CLI artifact."],
        blockers: ["No blocker"]
      }
    })
  });

  return app;
}

describe("runtime runner", () => {
  it("renders structured command output as markdown by default", async () => {
    const app = createRenderTestApp();
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runAppWithRenderedIo(app.run.bind(app), ["status"], {
      stdout: (text) => {
        stdout.push(text);
      },
      stderr: (text) => {
        stderr.push(text);
      }
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("# Status");
    expect(stdout.join("")).toContain("Progress: `50%` (1/2)");
    expect(stdout.join("")).not.toContain("\"status\"");
    expect(stderr.join("")).toBe("");
  });

  it("preserves raw JSON when --json is present", async () => {
    const app = createRenderTestApp();
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runAppWithRenderedIo(app.run.bind(app), ["status", "--json"], {
      stdout: (text) => {
        stdout.push(text);
      },
      stderr: (text) => {
        stderr.push(text);
      }
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.join(""))).toMatchObject({
      status: {
        phase: "Release hardening"
      }
    });
    expect(stderr.join("")).toBe("");
  });
});
