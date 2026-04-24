import { describe, expect, it } from "vitest";

import { renderCapturedOutput, stripGlobalJsonFlag } from "../src/cli/output-renderer.js";

describe("output renderer", () => {
  it("strips the global --json flag before passing argv to the CLI", () => {
    expect(stripGlobalJsonFlag(["status", "show", "--json"])).toEqual({
      argv: ["status", "show"],
      json: true
    });
  });

  it("renders the guide payload as markdown instead of a JSON envelope", () => {
    const rendered = renderCapturedOutput(
      JSON.stringify({
        guide: {
          markdown: "# APCC Workflow Guide\n\nRun `apcc site open` first.\n"
        }
      }),
      "stdout"
    );

    expect(rendered).toContain("# APCC Workflow Guide");
    expect(rendered).toContain("apcc site open");
    expect(rendered).not.toContain('"guide"');
  });

  it("renders status payloads as agent-friendly markdown summaries", () => {
    const rendered = renderCapturedOutput(
      JSON.stringify({
        status: {
          endGoal: {
            goalId: "end-goal-apcc",
            name: "APCC long-term end goal",
            summary: "Keep project context durable.",
            successCriteria: ["Stable anchors."],
            nonGoals: ["Hosted SaaS."]
          },
          phase: "Ship Agent-friendly CLI output",
          progress: {
            percent: 89,
            countedTasks: 28,
            doneTasks: 25
          },
          topLevelPlans: ["Ship Agent-friendly CLI output [in_progress]"],
          nextActions: ["Add a CLI entry renderer with explicit --json passthrough"],
          blockers: ["No blocker"]
        }
      }),
      "stdout"
    );

    expect(rendered).toContain("# Status");
    expect(rendered).toContain("Progress: `89%` (25/28)");
    expect(rendered).toContain("## Top-level Plans");
    expect(rendered).not.toContain('"status"');
  });

  it("renders plan mutation payloads without requiring full top-level context", () => {
    const rendered = renderCapturedOutput(
      JSON.stringify({
        plan: {
          id: "release-hardening",
          name: "Release hardening",
          summary: "Prepare release-facing CLI behavior.",
          parentPlanId: null,
          status: "pending"
        }
      }),
      "stdout"
    );

    expect(rendered).toContain("# Plan");
    expect(rendered).toContain("`release-hardening`");
    expect(rendered).not.toContain("Top-level Plans");
  });

  it("renders task mutation payloads as a single changed task and progress", () => {
    const rendered = renderCapturedOutput(
      JSON.stringify({
        task: {
          id: "release-check",
          name: "Release check",
          summary: "Verify the release package.",
          status: "pending",
          planRef: "release-hardening",
          parentTaskId: null,
          countedForProgress: true
        },
        progressPercent: 80
      }),
      "stdout"
    );

    expect(rendered).toContain("# Task");
    expect(rendered).toContain("`release-check`");
    expect(rendered).toContain("Progress: `80%`");
    expect(rendered).not.toContain("Task Tree");
  });

  it("renders error envelopes as markdown", () => {
    const rendered = renderCapturedOutput(
      JSON.stringify({
        error: {
          message: "Plan does not exist.",
          code: "not_found",
          hint: "Run `apcc plan show` first."
        }
      }),
      "stderr"
    );

    expect(rendered).toContain("# Error");
    expect(rendered).toContain("Plan does not exist.");
    expect(rendered).toContain("## Hint");
  });

  it("renders site instance lists without requiring --json", () => {
    const rendered = renderCapturedOutput(
      JSON.stringify({
        site: {
          items: [
            {
              siteId: "efab4b08e11c2c32",
              projectName: "APCC",
              sourceDocsRoot: "D:/project/VibeCoding/docs",
              sourceWorkspaceRoot: "D:/project/VibeCoding",
              runtimeRoot: "C:/Users/yueyo/AppData/Local/APCC/runtime/sites/efab4b08e11c2c32",
              port: 4316,
              url: "http://127.0.0.1:4316/docs",
              startedAt: "2026-04-25T00:00:00.000Z",
              mode: "live"
            }
          ]
        }
      }),
      "stdout"
    );

    expect(rendered).toContain("# Site");
    expect(rendered).toContain("## Instances");
    expect(rendered).toContain("APCC | `live` | http://127.0.0.1:4316/docs");
    expect(rendered).toContain("`D:/project/VibeCoding`");
  });

  it("renders bulk site stop results without requiring --json", () => {
    const rendered = renderCapturedOutput(
      JSON.stringify({
        site: {
          count: 1,
          items: [
            {
              siteId: "efab4b08e11c2c32",
              projectName: "APCC",
              sourceDocsRoot: "D:/project/VibeCoding/docs",
              sourceWorkspaceRoot: "D:/project/VibeCoding",
              runtimeRoot: "C:/Users/yueyo/AppData/Local/APCC/runtime/sites/efab4b08e11c2c32",
              stopped: true,
              preservedRuntime: true,
              terminatedPid: 13200,
              terminatedWatcherPid: 3488
            }
          ]
        }
      }),
      "stdout"
    );

    expect(rendered).toContain("# Site");
    expect(rendered).toContain("- Count: `1`");
    expect(rendered).toContain("## Instances");
    expect(rendered).toContain("APCC | `D:/project/VibeCoding` | stopped | runtime preserved");
  });
});
