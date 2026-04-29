import { describe, expect, it } from "vitest";

import { renderCapturedOutput, stripGlobalJsonFlag } from "../src/cli/output-renderer.js";

describe("output renderer", () => {
  it("strips the global --json flag before passing argv to the CLI", () => {
    expect(stripGlobalJsonFlag(["status", "--json"])).toEqual({
      argv: ["status"],
      json: true
    });
  });

  it("renders the guide payload as markdown instead of a JSON envelope", () => {
    const rendered = renderCapturedOutput(
      JSON.stringify({
        guide: {
          markdown: "# APCC Workflow Guide\n\nRun `apcc site start` first.\n"
        }
      }),
      "stdout"
    );

    expect(rendered).toContain("# APCC Workflow Guide");
    expect(rendered).toContain("apcc site start");
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
          status: "pending",
          versionRef: null,
          effectiveVersionRef: null
        }
      }),
      "stdout"
    );

    expect(rendered).toContain("# Plan");
    expect(rendered).toContain("`release-hardening`");
    expect(rendered).toContain("Version: Unversioned");
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

  it("renders version-scoped plan and task filters in list views", () => {
    const planRendered = renderCapturedOutput(
      JSON.stringify({
        topLevelPlans: ["Release hardening [in_progress]"],
        lines: ["- Release hardening (release-hardening) [in_progress]"],
        versionFilter: {
          id: "release-0-2-0",
          version: "0.2.0",
          title: "Stable baseline"
        }
      }),
      "stdout"
    );
    const taskRendered = renderCapturedOutput(
      JSON.stringify({
        taskTree: [],
        lines: ["- Release check (release-check) [pending]"],
        versionFilter: {
          id: null,
          version: null,
          title: "unversioned"
        }
      }),
      "stdout"
    );

    expect(planRendered).toContain("## Filter");
    expect(planRendered).toContain("Version scope: 0.2.0 (release-0-2-0)");
    expect(taskRendered).toContain("Version scope: unversioned");
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

  it("renders site status payloads with lifecycle details", () => {
    const rendered = renderCapturedOutput(
      JSON.stringify({
        site: {
          state: "staged",
          runtimeMode: "staged",
          sourcePath: "D:/project/VibeCoding/docs",
          runtimeRoot: "C:/Users/yueyo/AppData/Local/APCC/runtime/sites/efab4b08e11c2c32",
          runtimeDataRoot: "C:/Users/yueyo/AppData/Local/APCC/runtime/sites/efab4b08e11c2c32/runtime-data",
          preferredPort: 4316,
          docsLanguage: "zh-CN",
          healthy: false,
          runtimePresent: true
        }
      }),
      "stdout"
    );

    expect(rendered).toContain("# Site");
    expect(rendered).toContain("- State: `staged`");
    expect(rendered).toContain("- Docs language: `zh-CN`");
    expect(rendered).toContain("- Preferred port: `4316`");
    expect(rendered).toContain("- Healthy: no");
    expect(rendered).toContain("- Runtime present: yes");
  });

  it("renders doctor check payloads with guidance, checks, and validation details", () => {
    const rendered = renderCapturedOutput(
      JSON.stringify({
        doctor: {
          checks: [
            {
              id: "workspace-schema",
              status: "fail",
              severity: "high",
              category: "schema",
              summary: "2 workspace schema issue(s) detected.",
              hint: "The workspace metadata or config is stale or incomplete.",
              remediation: [
                {
                  summary: "Backfill workspace metadata and config.",
                  command: "apcc doctor fix",
                  automatable: true
                }
              ]
            }
          ],
          guidance_md: "Run `apcc doctor fix` to restore the workspace, then rerun `apcc doctor check`."
        }
      }),
      "stdout"
    );

    expect(rendered).toContain("# Doctor");
    expect(rendered).toContain("- Status: `fail`");
    expect(rendered).toContain("## Guidance");
    expect(rendered).toContain("## Checks");
    expect(rendered).toContain("`workspace-schema` | `fail` | `high` | `schema`");
    expect(rendered).toContain("`apcc doctor fix`");
    expect(rendered).not.toContain("## Validation");
    expect(rendered).not.toContain("Repair needed");
  });

  it("renders doctor fix payloads with repair details", () => {
    const rendered = renderCapturedOutput(
      JSON.stringify({
        doctor: {
          repaired: true,
          checks: [
            {
              id: "workspace-health",
              status: "pass",
              severity: "low",
              category: "workspace",
              summary: "Workspace passed all APCC doctor checks."
            }
          ],
          guidance_md: "Workspace repair completed successfully.",
          workspace: {
            mode: "init",
            root: "D:/project/VibeCoding",
            createdFiles: ["AGENTS.md"],
            updatedFiles: [".apcc/config/workspace.yaml"],
            skippedFiles: ["docs/shared/overview.md"]
          }
        }
      }),
      "stdout"
    );

    expect(rendered).toContain("# Doctor Fix");
    expect(rendered).toContain("- Status: `pass`");
    expect(rendered).toContain("- Repaired: yes");
    expect(rendered).toContain("## Created Files");
    expect(rendered).toContain("AGENTS.md");
    expect(rendered).not.toContain("## Validation");
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
