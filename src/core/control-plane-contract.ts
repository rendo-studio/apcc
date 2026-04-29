import {
  BOOTSTRAP_MODES,
  DECISION_CATEGORIES,
  DECISION_STATUSES,
  DOCS_LANGUAGES,
  DOCS_MODES,
  PACKAGE_MANAGERS,
  PROJECT_KINDS,
  SITE_FRAMEWORKS,
  TASK_STATUSES,
  VERSION_RECORD_STATUSES
} from "./types.js";
import { WORKSPACE_SCHEMA_VERSION, WORKSPACE_TEMPLATE_VERSION } from "./bootstrap.js";
import { getApccPackageVersion } from "./package-runtime.js";

function code(value: string): string {
  return `\`${value}\``;
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function codeBulletList(items: readonly string[]): string {
  return bulletList(items.map((item) => code(item)));
}

function fenced(language: string, body: string): string {
  return `\`\`\`${language}\n${body}\n\`\`\``;
}

function section(title: string, body: string): string {
  return `## ${title}\n\n${body}`;
}

function nestedFieldList(items: string[]): string {
  return items.map((item) => `  - ${code(item)}`).join("\n");
}

function renderAllowedValues(values: readonly string[]): string {
  return codeBulletList(values);
}

function renderTaskStatusSemantics(): string {
  const semantics = new Map<string, string>([
    ["pending", "not started"],
    ["in_progress", "started, or partially completed but not done"],
    ["done", "completed"],
    ["blocked", "cannot currently proceed because of a real blocker"]
  ]);

  return bulletList(
    TASK_STATUSES.map((status) => `${code(status)}: ${semantics.get(status) ?? "undocumented"}`)
  );
}

function renderCurrentWorkspaceConfigShape(): string {
  return [
    `siteFramework: ${SITE_FRAMEWORKS[0]}`,
    `packageManager: ${PACKAGE_MANAGERS[0]}`,
    `projectKind: ${PROJECT_KINDS[0]}`,
    `docsMode: ${DOCS_MODES[1]}`,
    `docsLanguage: ${DOCS_LANGUAGES[0]}`,
    "docsSite:",
    "  enabled: true",
    "  sourcePath: docs",
    "  preferredPort: null",
    `workspaceSchemaVersion: ${WORKSPACE_SCHEMA_VERSION}`
  ].join("\n");
}

function renderCurrentWorkspaceMetaShape(): string {
  return [
    `workspaceSchemaVersion: ${WORKSPACE_SCHEMA_VERSION}`,
    `apccVersion: ${getApccPackageVersion()}`,
    "workspaceName: apcc-project",
    "docsRoot: docs",
    "workspaceRoot: .apcc",
    `bootstrapMode: ${BOOTSTRAP_MODES[0]}`,
    `templateVersion: ${WORKSPACE_TEMPLATE_VERSION}`,
    `projectKind: ${PROJECT_KINDS[0]}`,
    `docsMode: ${DOCS_MODES[1]}`,
    `docsLanguage: ${DOCS_LANGUAGES[0]}`,
    "createdAt: 2026-04-29T00:00:00.000Z",
    "lastUpgradedAt: null"
  ].join("\n");
}

export function renderControlPlaneContractMarkdown(): string {
  const sections = [
    [
      "---",
      "name: Control Plane Contract",
      "description: Normative value-domain and field-semantics reference for directly editing the APCC `.apcc` workspace.",
      "---",
      "",
      "# Control Plane Contract",
      "",
      "This page is the normative contract for editing `.apcc/` directly.",
      "",
      "Use it when:",
      "",
      bulletList([
        "an Agent is editing `.apcc/` without going through a CLI mutation command",
        "a maintainer needs authoritative allowed values for persisted control-plane fields",
        "you need to distinguish stored fields from derived fields"
      ]),
      "",
      "If a field or value conflicts with this page, treat this page and the current CLI validation behavior as authoritative.",
      "",
      "After direct `.apcc/` edits, run:",
      "",
      fenced("bash", "apcc doctor check\napcc status")
    ].join("\n"),
    section(
      "Contract Scope",
      [
        "The APCC control plane is the persisted state under:",
        "",
        fenced(
          "text",
          [
            ".apcc/",
            "  meta/workspace.yaml",
            "  config/workspace.yaml",
            "  project/overview.yaml",
            "  goals/end.yaml",
            "  plans/current.yaml",
            "  tasks/current.yaml",
            "  decisions/records.yaml",
            "  versions/records.yaml"
          ].join("\n")
        ),
        "",
        "`docs/` is authored context, not control-plane state."
      ].join("\n")
    ),
    section(
      "Stored Versus Derived",
      [
        "Persist these explicitly:",
        "",
        bulletList([
          "ids",
          "names",
          "summaries",
          "parent relationships",
          "task status",
          "doc references",
          "decision records",
          "version records",
          "workspace config and metadata"
        ]),
        "",
        "Do not persist these as first-class control-plane fields:",
        "",
        bulletList([
          "plan status",
          "progress percentages",
          "current phase labels",
          "docs-site runtime state"
        ]),
        "",
        "Those are derived at read time."
      ].join("\n")
    ),
    section(
      "General Rules",
      bulletList([
        "ids must use lowercase letters, numbers, and hyphens",
        "ids must start and end with a letter or number",
        `${code("root")} is reserved and must not be stored as an id`,
        `top-level ${code("parentPlanId")} and ${code("parentTaskId")} are stored as ${code("null")}`,
        `CLI input ${code("--parent root")} maps to stored ${code("null")}`,
        `${code("docPath")} values are relative to the ${code("docs/")} root`,
        `persisted docs language values are normalized to ${code(DOCS_LANGUAGES[0])} or ${code(DOCS_LANGUAGES[1])}`
      ])
    ),
    section(
      "Plans",
      [
        "File:",
        "",
        fenced("text", ".apcc/plans/current.yaml"),
        "",
        "Shape:",
        "",
        fenced(
          "yaml",
          [
            "endGoalRef: end-goal-id",
            "items:",
            "  - id: example-plan",
            "    name: Example plan",
            "    summary: Example summary",
            "    parentPlanId: null"
          ].join("\n")
        ),
        "",
        "Rules:",
        "",
        [
          `- ${code("endGoalRef")}: string id pointing at ${code(".apcc/goals/end.yaml.goalId")}`,
          `- ${code("items")}: array`,
          "- each plan must define:",
          nestedFieldList(["id", "name", "summary", "parentPlanId"]),
          `- ${code("parentPlanId")} is either another plan id or ${code("null")}`,
          `- ${code("plan.status")} is not stored`
        ].join("\n"),
        "",
        "Derived plan status values are:",
        "",
        renderAllowedValues(TASK_STATUSES),
        "",
        "They are computed from the task tree, not persisted into `plans/current.yaml`."
      ].join("\n")
    ),
    section(
      "Tasks",
      [
        "File:",
        "",
        fenced("text", ".apcc/tasks/current.yaml"),
        "",
        "Shape:",
        "",
        fenced(
          "yaml",
          [
            "items:",
            "  - id: example-task",
            "    name: Example task",
            "    summary: Example summary",
            `    status: ${TASK_STATUSES[0]}`,
            "    planRef: example-plan",
            "    parentTaskId: null",
            "    countedForProgress: true"
          ].join("\n")
        ),
        "",
        `Allowed ${code("status")} values:`,
        "",
        renderTaskStatusSemantics(),
        "",
        "Rules:",
        "",
        [
          `- ${code("items")}: array`,
          "- each task must define:",
          nestedFieldList(["id", "name", "summary", "status", "planRef", "parentTaskId", "countedForProgress"]),
          `- ${code("planRef")} must reference an existing plan id`,
          `- ${code("parentTaskId")} is either another task id or ${code("null")}`,
          `- ${code("countedForProgress")} must be ${code("true")} or ${code("false")}`
        ].join("\n"),
        "",
        "Progress rule:",
        "",
        bulletList([
          `only tasks with ${code("countedForProgress: true")} are counted for percent progress`,
          `percent is derived as ${code("round(done / counted * 100)")}`
        ]),
        "",
        "Plan-derivation rule:",
        "",
        bulletList([
          `if all relevant tasks are ${code("done")}, the plan is ${code("done")}`,
          `else if any relevant task is ${code("blocked")}, the plan is ${code("blocked")}`,
          `else if any relevant task is ${code("in_progress")}, the plan is ${code("in_progress")}`,
          `else if any relevant task is ${code("done")} but not all are done, the plan is ${code("in_progress")}`,
          `else the plan is ${code("pending")}`
        ])
      ].join("\n")
    ),
    section(
      "Decisions",
      [
        "File:",
        "",
        fenced("text", ".apcc/decisions/records.yaml"),
        "",
        `Allowed ${code("category")} values:`,
        "",
        renderAllowedValues(DECISION_CATEGORIES),
        "",
        `Allowed ${code("status")} values:`,
        "",
        renderAllowedValues(DECISION_STATUSES),
        "",
        "Rules:",
        "",
        bulletList([
          `${code("items")}: array`,
          `each record must use one allowed ${code("category")}`,
          `each record must use one allowed ${code("status")}`,
          `${code("docPath")} is optional and stored as a docs-relative path or ${code("null")}`
        ])
      ].join("\n")
    ),
    section(
      "Versions",
      [
        "File:",
        "",
        fenced("text", ".apcc/versions/records.yaml"),
        "",
        `Allowed ${code("status")} values:`,
        "",
        renderAllowedValues(VERSION_RECORD_STATUSES),
        "",
        "Rules:",
        "",
        bulletList([
          `${code("items")}: array`,
          `each record must use one allowed ${code("status")}`,
          `${code("docPath")} is optional and stored as a docs-relative path or ${code("null")}`
        ])
      ].join("\n")
    ),
    section(
      "Workspace Metadata",
      [
        "File:",
        "",
        fenced("text", ".apcc/meta/workspace.yaml"),
        "",
        "Allowed values:",
        "",
        bulletList([
          `${code("workspaceSchemaVersion")}: integer APCC-managed schema version`,
          `${code("apccVersion")}: APCC CLI version that last initialized or repaired the workspace`,
          `${code("bootstrapMode")}: ${BOOTSTRAP_MODES.map(code).join(", ")}`,
          `${code("projectKind")}: ${PROJECT_KINDS.map(code).join(", ")}`,
          `${code("docsMode")}: ${DOCS_MODES.map(code).join(", ")}`,
          `${code("docsLanguage")}: ${DOCS_LANGUAGES.map(code).join(", ")}`
        ]),
        "",
        "Current default shape:",
        "",
        fenced("yaml", renderCurrentWorkspaceMetaShape()),
        "",
        "Rules:",
        "",
        bulletList([
          "this file stores managed workspace metadata",
          `${code("templateVersion")} is APCC-managed and should match the current scaffold template`,
          `${code("workspaceSchemaVersion")} is APCC-managed and should match the current workspace schema`,
          `${code("apccVersion")} records which APCC CLI version last initialized or repaired the workspace`
        ])
      ].join("\n")
    ),
    section(
      "Workspace Config",
      [
        "File:",
        "",
        fenced("text", ".apcc/config/workspace.yaml"),
        "",
        "Allowed values:",
        "",
        bulletList([
          `${code("siteFramework")}: ${SITE_FRAMEWORKS.map(code).join(", ")}`,
          `${code("packageManager")}: ${PACKAGE_MANAGERS.map(code).join(", ")}`,
          `${code("projectKind")}: ${PROJECT_KINDS.map(code).join(", ")}`,
          `${code("docsMode")}: ${DOCS_MODES.map(code).join(", ")}`,
          `${code("docsLanguage")}: ${DOCS_LANGUAGES.map(code).join(", ")}`
        ]),
        "",
        `${code("docsSite")} rules:`,
        "",
        bulletList([
          `${code("enabled")}: boolean`,
          `${code("sourcePath")}: non-empty string`,
          `${code("preferredPort")}: positive integer or ${code("null")}`
        ]),
        "",
        "Current default shape:",
        "",
        fenced("yaml", renderCurrentWorkspaceConfigShape())
      ].join("\n")
    ),
    section(
      "CLI-To-Storage Mappings",
      [
        "The CLI accepts a few human-facing tokens that are not stored verbatim:",
        "",
        bulletList([
          `${code("--parent root")} -> stored ${code("null")}`,
          `${code("--docs-language zh")} -> stored ${code("zh-CN")}`,
          `${code("--docs-language en-US")} -> stored ${code("en")}`
        ]),
        "",
        "Prefer the normalized persisted values when editing YAML directly."
      ].join("\n")
    ),
    section(
      "Safe Direct-Edit Loop",
      [
        "When editing `.apcc/` directly:",
        "",
        [
          "1. change the smallest number of files necessary",
          "2. keep ids stable unless you are intentionally restructuring references",
          "3. use only the allowed values on this page",
          "4. run `apcc doctor check`",
          "5. inspect the derived view with `apcc status`, `apcc plan show`, or `apcc task list`"
        ].join("\n"),
        "",
        `If you are unsure whether a field is stored or derived, do not invent a new persisted field.`
      ].join("\n")
    )
  ];

  return `${sections.join("\n\n")}\n`;
}
