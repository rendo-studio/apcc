import type { DoctorCheckStatus } from "@rendo-studio/aclip";

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tryParseJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function humanizeKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function inlineCode(value: string): string {
  return `\`${value}\``;
}

function renderList(items: string[], emptyLabel = "None"): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : `- ${emptyLabel}`;
}

function renderSection(title: string, body: string): string {
  return `## ${title}\n\n${body}`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item : null))
    .filter((item): item is string => Boolean(item));
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Record<string, unknown> => isRecord(item));
}

function formatTaskStatus(status: unknown): string {
  if (typeof status !== "string") {
    return "unknown";
  }

  return status.replace(/_/g, " ");
}

function renderSiteInstances(items: Array<Record<string, unknown>>, emptyLabel: string): string {
  if (items.length === 0) {
    return `- ${emptyLabel}`;
  }

  return items
    .map((item) => {
      const parts: string[] = [];
      if (typeof item.projectName === "string" && item.projectName.trim().length > 0) {
        parts.push(item.projectName);
      }
      if (typeof item.mode === "string" && item.mode.trim().length > 0) {
        parts.push(inlineCode(item.mode));
      }
      if (typeof item.url === "string" && item.url.trim().length > 0) {
        parts.push(item.url);
      }
      if (typeof item.sourceWorkspaceRoot === "string" && item.sourceWorkspaceRoot.trim().length > 0) {
        parts.push(inlineCode(item.sourceWorkspaceRoot));
      } else if (typeof item.sourceDocsRoot === "string" && item.sourceDocsRoot.trim().length > 0) {
        parts.push(inlineCode(item.sourceDocsRoot));
      }
      if (typeof item.stopped === "boolean") {
        parts.push(item.stopped ? "stopped" : "not stopped");
      }
      if (typeof item.preservedRuntime === "boolean") {
        parts.push(item.preservedRuntime ? "runtime preserved" : "runtime removed");
      }

      return `- ${parts.join(" | ")}`;
    })
    .join("\n");
}

function renderGuide(payload: Record<string, unknown>): string {
  const markdown = typeof payload.markdown === "string" ? payload.markdown : "";
  return ensureTrailingNewline(markdown || "# Guide\n");
}

function renderProject(payload: Record<string, unknown>): string {
  const lines = [
    "# Project",
    "",
    `- Name: ${typeof payload.name === "string" ? payload.name : "Unknown"}`,
    `- Overview doc: ${typeof payload.docPath === "string" ? inlineCode(payload.docPath) : "Unknown"}`
  ];

  if (typeof payload.summary === "string" && payload.summary.trim().length > 0) {
    lines.push("", renderSection("Summary", payload.summary));
  }

  return ensureTrailingNewline(lines.join("\n"));
}

function renderGoal(payload: Record<string, unknown>, nextAction?: string): string {
  const lines = [
    "# End Goal",
    "",
    `- ID: ${typeof payload.goalId === "string" ? inlineCode(payload.goalId) : "Unknown"}`,
    `- Name: ${typeof payload.name === "string" ? payload.name : "Unknown"}`,
    `- Goal doc: ${typeof payload.docPath === "string" ? inlineCode(payload.docPath) : "Unknown"}`
  ];

  if (typeof payload.summary === "string" && payload.summary.trim().length > 0) {
    lines.push("", renderSection("Summary", payload.summary));
  }

  lines.push(
    "",
    renderSection("Success Criteria", renderList(asStringArray(payload.successCriteria))),
    "",
    renderSection("Non-goals", renderList(asStringArray(payload.nonGoals)))
  );

  if (nextAction) {
    lines.push("", renderSection("Next", renderList([nextAction])));
  }

  return ensureTrailingNewline(lines.join("\n"));
}

function renderStatus(payload: Record<string, unknown>, synced = false): string {
  const endGoal = isRecord(payload.endGoal) ? payload.endGoal : {};
  const progress = isRecord(payload.progress) ? payload.progress : {};
  const percent = typeof progress.percent === "number" ? `${progress.percent}%` : "Unknown";
  const doneTasks = typeof progress.doneTasks === "number" ? progress.doneTasks : "?";
  const countedTasks = typeof progress.countedTasks === "number" ? progress.countedTasks : "?";

  const lines = [
    "# Status",
    "",
    `- End goal: ${typeof endGoal.name === "string" ? endGoal.name : "Unknown"}`,
    `- Phase: ${typeof payload.phase === "string" ? inlineCode(payload.phase) : "Unknown"}`,
    `- Progress: ${inlineCode(percent)} (${doneTasks}/${countedTasks})`
  ];

  if (synced) {
    lines.push("- Derived state: synced");
  }

  if (typeof endGoal.summary === "string" && endGoal.summary.trim().length > 0) {
    lines.push("", renderSection("End Goal Summary", endGoal.summary));
  }

  lines.push(
    "",
    renderSection("Success Criteria", renderList(asStringArray(endGoal.successCriteria))),
    "",
    renderSection("Non-goals", renderList(asStringArray(endGoal.nonGoals))),
    "",
    renderSection("Top-level Plans", renderList(asStringArray(payload.topLevelPlans))),
    "",
    renderSection("Next", renderList(asStringArray(payload.nextActions))),
    "",
    renderSection("Blockers", renderList(asStringArray(payload.blockers)))
  );

  return ensureTrailingNewline(lines.join("\n"));
}

function renderSite(payload: Record<string, unknown>): string {
  const lines = ["# Site", ""];
  const items = asRecordArray(payload.items);

  if (typeof payload.url === "string" && payload.url) {
    lines.push(`- URL: ${payload.url}`);
  }

  if (typeof payload.state === "string") {
    lines.push(`- State: ${inlineCode(payload.state)}`);
  }

  if (typeof payload.port === "number") {
    lines.push(`- Port: ${inlineCode(String(payload.port))}`);
  }

  if (typeof payload.sourcePath === "string") {
    lines.push(`- Source path: ${inlineCode(payload.sourcePath)}`);
  }

  if (typeof payload.runtimeMode === "string") {
    lines.push(`- Runtime mode: ${inlineCode(payload.runtimeMode)}`);
  }

  if (typeof payload.docsLanguage === "string") {
    lines.push(`- Docs language: ${inlineCode(payload.docsLanguage)}`);
  }

  if (typeof payload.preferredPort === "number") {
    lines.push(`- Preferred port: ${inlineCode(String(payload.preferredPort))}`);
  }

  if (typeof payload.runtimeRoot === "string") {
    lines.push(`- Runtime root: ${inlineCode(payload.runtimeRoot)}`);
  }

  if (typeof payload.buildOutput === "string") {
    lines.push(`- Build output: ${inlineCode(payload.buildOutput)}`);
  }

  if (typeof payload.startCommand === "string") {
    lines.push(`- Start command: ${inlineCode(payload.startCommand)}`);
  }

  if (typeof payload.serverFile === "string") {
    lines.push(`- Server file: ${inlineCode(payload.serverFile)}`);
  }

  if (typeof payload.runtimeDataRoot === "string") {
    lines.push(`- Runtime data: ${inlineCode(payload.runtimeDataRoot)}`);
  }

  if (typeof payload.pageCount === "number") {
    lines.push(`- Page count: ${inlineCode(String(payload.pageCount))}`);
  }

  if (typeof payload.cleaned === "boolean") {
    lines.push(`- Cleaned: ${payload.cleaned ? "yes" : "no"}`);
  }

  if (typeof payload.stopped === "boolean") {
    lines.push(`- Stopped: ${payload.stopped ? "yes" : "no"}`);
  }

  if (typeof payload.preservedRuntime === "boolean") {
    lines.push(`- Preserved runtime: ${payload.preservedRuntime ? "yes" : "no"}`);
  }

  if (typeof payload.alreadyRunning === "boolean") {
    lines.push(`- Reused existing runtime: ${payload.alreadyRunning ? "yes" : "no"}`);
  }

  if (typeof payload.healthy === "boolean") {
    lines.push(`- Healthy: ${payload.healthy ? "yes" : "no"}`);
  }

  if (typeof payload.runtimePresent === "boolean") {
    lines.push(`- Runtime present: ${payload.runtimePresent ? "yes" : "no"}`);
  }

  if (typeof payload.pid === "number") {
    lines.push(`- PID: ${inlineCode(String(payload.pid))}`);
  }

  if (typeof payload.watcherPid === "number") {
    lines.push(`- Watcher PID: ${inlineCode(String(payload.watcherPid))}`);
  }

  if (typeof payload.startedAt === "string" && payload.startedAt.length > 0) {
    lines.push(`- Started at: ${payload.startedAt}`);
  }

  if (typeof payload.logFile === "string") {
    lines.push(`- Log file: ${inlineCode(payload.logFile)}`);
  }

  if (typeof payload.count === "number") {
    lines.push(`- Count: ${inlineCode(String(payload.count))}`);
  }

  if (items.length > 0 || "items" in payload) {
    lines.push(
      "",
      renderSection(
        "Instances",
        renderSiteInstances(
          items,
          typeof payload.count === "number" && payload.count === 0
            ? "No active runtimes."
            : "No site instances."
        )
      )
    );
  }

  return ensureTrailingNewline(lines.join("\n"));
}

function renderPlanRecord(payload: Record<string, unknown>): string {
  const lines = [
    "# Plan",
    "",
    `- ID: ${typeof payload.id === "string" ? inlineCode(payload.id) : "Unknown"}`,
    `- Name: ${typeof payload.name === "string" ? payload.name : "Unknown"}`,
    `- Status: ${inlineCode(formatTaskStatus(payload.status))}`,
    `- Parent: ${typeof payload.parentPlanId === "string" ? inlineCode(payload.parentPlanId) : inlineCode("root")}`
  ];

  if (typeof payload.summary === "string" && payload.summary.trim().length > 0) {
    lines.push("", renderSection("Summary", payload.summary));
  }

  return ensureTrailingNewline(lines.join("\n"));
}

function renderPlanPayload(payload: Record<string, unknown>): string {
  if (isRecord(payload.plan)) {
    const lines = [renderPlanRecord(payload.plan).trimEnd()];
    if (Array.isArray(payload.topLevelPlans)) {
      lines.push("", renderSection("Top-level Plans", renderList(asStringArray(payload.topLevelPlans))));
    }
    return ensureTrailingNewline(lines.join("\n"));
  }

  const lines = ["# Plans", ""];
  if (Array.isArray(payload.topLevelPlans)) {
    lines.push(renderSection("Top-level Plans", renderList(asStringArray(payload.topLevelPlans))));
  }
  if (Array.isArray(payload.lines)) {
    if (lines.length > 2) {
      lines.push("");
    }
    lines.push(renderSection("Plan Tree", renderList(asStringArray(payload.lines))));
  }
  if (Array.isArray(payload.deletedPlanIds)) {
    if (lines.length > 2) {
      lines.push("");
    }
    lines.push(renderSection("Deleted Plans", renderList(asStringArray(payload.deletedPlanIds))));
  }
  if (Array.isArray(payload.deletedTaskIds)) {
    lines.push("", renderSection("Deleted Tasks", renderList(asStringArray(payload.deletedTaskIds))));
  }

  return ensureTrailingNewline(lines.join("\n"));
}

function renderTaskRecord(payload: Record<string, unknown>, progressPercent?: unknown): string {
  const lines = [
    "# Task",
    "",
    `- ID: ${typeof payload.id === "string" ? inlineCode(payload.id) : "Unknown"}`,
    `- Name: ${typeof payload.name === "string" ? payload.name : "Unknown"}`,
    `- Status: ${inlineCode(formatTaskStatus(payload.status))}`,
    `- Plan: ${typeof payload.planRef === "string" ? inlineCode(payload.planRef) : "Unknown"}`,
    `- Parent: ${typeof payload.parentTaskId === "string" ? inlineCode(payload.parentTaskId) : inlineCode("root")}`,
    `- Counted for progress: ${payload.countedForProgress === false ? "no" : "yes"}`
  ];

  if (typeof progressPercent === "number") {
    lines.push(`- Progress: ${inlineCode(`${progressPercent}%`)}`);
  }

  if (typeof payload.summary === "string" && payload.summary.trim().length > 0) {
    lines.push("", renderSection("Summary", payload.summary));
  }

  return ensureTrailingNewline(lines.join("\n"));
}

function renderTaskPayload(payload: Record<string, unknown>): string {
  if (isRecord(payload.task)) {
    return renderTaskRecord(payload.task, payload.progressPercent);
  }

  const lines = ["# Tasks", ""];
  if (Array.isArray(payload.lines)) {
    lines.push(renderSection("Task Tree", renderList(asStringArray(payload.lines))));
  }
  if (Array.isArray(payload.deletedTaskIds)) {
    lines.push("", renderSection("Deleted Tasks", renderList(asStringArray(payload.deletedTaskIds))));
  }
  if (typeof payload.progressPercent === "number") {
    lines.push("", renderSection("Progress", `- Current percent: ${inlineCode(`${payload.progressPercent}%`)}`));
  }

  return ensureTrailingNewline(lines.join("\n"));
}

function renderDecisionRecord(payload: Record<string, unknown>): string {
  const lines = [
    "# Decision",
    "",
    `- ID: ${typeof payload.id === "string" ? inlineCode(payload.id) : "Unknown"}`,
    `- Name: ${typeof payload.name === "string" ? payload.name : "Unknown"}`,
    `- Category: ${typeof payload.category === "string" ? inlineCode(payload.category) : "Unknown"}`,
    `- Status: ${typeof payload.status === "string" ? inlineCode(payload.status) : "Unknown"}`
  ];

  if (typeof payload.docPath === "string" && payload.docPath.trim().length > 0) {
    lines.push(`- Decision doc: ${inlineCode(payload.docPath)}`);
  }

  if (typeof payload.description === "string") {
    lines.push("", renderSection("Description", payload.description));
  }

  if (typeof payload.context === "string") {
    lines.push("", renderSection("Context", payload.context));
  }

  if (typeof payload.impactOfNoAction === "string") {
    lines.push("", renderSection("Impact Of No Action", payload.impactOfNoAction));
  }

  if (typeof payload.expectedOutcome === "string") {
    lines.push("", renderSection("Expected Outcome", payload.expectedOutcome));
  }

  if (typeof payload.boundary === "string") {
    lines.push("", renderSection("Boundary", payload.boundary));
  }

  if (typeof payload.decisionSummary === "string" && payload.decisionSummary.trim().length > 0) {
    lines.push("", renderSection("Decision Summary", payload.decisionSummary));
  }

  return ensureTrailingNewline(lines.join("\n"));
}

function renderDecisionPayload(payload: Record<string, unknown>): string {
  if (Array.isArray(payload.decision)) {
    const decisions = asRecordArray(payload.decision);
    return ensureTrailingNewline(
      [
        "# Decisions",
        "",
        renderSection(
          "Records",
          renderList(
            decisions.map((record) => {
              const id = typeof record.id === "string" ? record.id : "unknown";
              const name = typeof record.name === "string" ? record.name : "Unknown";
              const status = typeof record.status === "string" ? record.status : "unknown";
              return `${inlineCode(id)} | ${status} | ${name}`;
            }),
            "No decision records."
          )
        )
      ].join("\n")
    );
  }

  return renderDecisionRecord(isRecord(payload.decision) ? payload.decision : payload);
}

function renderVersionRecord(payload: Record<string, unknown>): string {
  const lines = [
    "# Version",
    "",
    `- ID: ${typeof payload.id === "string" ? inlineCode(payload.id) : "Unknown"}`,
    `- Version: ${typeof payload.version === "string" ? payload.version : "Unknown"}`,
    `- Title: ${typeof payload.title === "string" ? payload.title : "Unknown"}`,
    `- Status: ${typeof payload.status === "string" ? inlineCode(payload.status) : "Unknown"}`
  ];

  if (typeof payload.docPath === "string" && payload.docPath.trim().length > 0) {
    lines.push(`- Version doc: ${inlineCode(payload.docPath)}`);
  }

  if (typeof payload.summary === "string") {
    lines.push("", renderSection("Summary", payload.summary));
  }

  lines.push(
    "",
    renderSection("Decision Refs", renderList(asStringArray(payload.decisionRefs))),
    "",
    renderSection("Highlights", renderList(asStringArray(payload.highlights))),
    "",
    renderSection("Breaking Changes", renderList(asStringArray(payload.breakingChanges))),
    "",
    renderSection("Migration Notes", renderList(asStringArray(payload.migrationNotes)))
  );

  if (typeof payload.validationSummary === "string" && payload.validationSummary.trim().length > 0) {
    lines.push("", renderSection("Validation Summary", payload.validationSummary));
  }

  return ensureTrailingNewline(lines.join("\n"));
}

function renderVersionPayload(payload: Record<string, unknown>): string {
  if (Array.isArray(payload.version)) {
    const versions = asRecordArray(payload.version);
    return ensureTrailingNewline(
      [
        "# Versions",
        "",
        renderSection(
          "Records",
          renderList(
            versions.map((record) => {
              const id = typeof record.id === "string" ? record.id : "unknown";
              const version = typeof record.version === "string" ? record.version : "unknown";
              const title = typeof record.title === "string" ? record.title : "Unknown";
              const status = typeof record.status === "string" ? record.status : "unknown";
              return `${inlineCode(id)} | ${status} | ${version} ${title}`;
            }),
            "No version records."
          )
        )
      ].join("\n")
    );
  }

  return renderVersionRecord(isRecord(payload.version) ? payload.version : payload);
}

function getDoctorStatus(checks: Array<Record<string, unknown>>): string | null {
  const PASS_STATUS: DoctorCheckStatus = "pass";
  const WARN_STATUS: DoctorCheckStatus = "warn";
  const FAIL_STATUS: DoctorCheckStatus = "fail";
  let highestRank = -1;
  let selectedStatus: string | null = null;

  for (const check of checks) {
    if (typeof check.status !== "string") {
      continue;
    }

    const rank =
      check.status === FAIL_STATUS ? 2 :
      check.status === WARN_STATUS ? 1 :
      check.status === PASS_STATUS ? 0 :
      -1;

    if (rank > highestRank) {
      highestRank = rank;
      selectedStatus = check.status;
    }
  }

  return selectedStatus;
}

function renderDoctorChecks(checks: Array<Record<string, unknown>>): string {
  if (checks.length === 0) {
    return "- No checks reported.";
  }

  return checks
    .map((check) => {
      const tags = [
        typeof check.status === "string" ? inlineCode(check.status) : null,
        typeof check.severity === "string" ? inlineCode(check.severity) : null,
        typeof check.category === "string" ? inlineCode(check.category) : null
      ].filter((item): item is string => Boolean(item));
      const header = `- ${typeof check.id === "string" ? inlineCode(check.id) : inlineCode("check")} | ${tags.join(" | ")}: ${typeof check.summary === "string" ? check.summary : "Unknown check summary"}`;
      const detailLines: string[] = [];

      if (typeof check.hint === "string" && check.hint.trim().length > 0) {
        detailLines.push(`  Hint: ${check.hint}`);
      }

      for (const remediation of asRecordArray(check.remediation)) {
        const parts = [typeof remediation.summary === "string" ? remediation.summary : "Unnamed remediation"];
        if (typeof remediation.command === "string" && remediation.command.trim().length > 0) {
          parts.push(inlineCode(remediation.command));
        }
        if (remediation.automatable === true) {
          parts.push("automatable");
        }
        detailLines.push(`  Remediation: ${parts.join(" | ")}`);
      }

      return [header, ...detailLines].join("\n");
    })
    .join("\n");
}

function renderDoctorPayload(payload: Record<string, unknown>): string {
  const doctor = isRecord(payload.doctor) ? payload.doctor : payload;
  const workspace = isRecord(doctor.workspace) ? doctor.workspace : {};
  const checks = asRecordArray(doctor.checks);
  const lines = [doctor.repaired === true ? "# Doctor Fix" : "# Doctor", ""];
  const status = getDoctorStatus(checks);

  if (status) {
    lines.push(`- Status: ${inlineCode(status)}`);
  }
  if (doctor.repaired === true) {
    lines.push(`- Repaired: yes`);
  }

  if (typeof doctor.guidance_md === "string" && doctor.guidance_md.trim().length > 0) {
    lines.push("", renderSection("Guidance", doctor.guidance_md));
  }

  lines.push("", renderSection("Checks", renderDoctorChecks(checks)));

  if (doctor.repaired === true) {
    lines.push(
      "",
      `- Mode: ${typeof workspace.mode === "string" ? inlineCode(workspace.mode) : "Unknown"}`,
      `- Root: ${typeof workspace.root === "string" ? inlineCode(workspace.root) : "Unknown"}`,
      `- Active change: ${typeof workspace.activeChangeId === "string" ? inlineCode(workspace.activeChangeId) : "Unknown"}`,
      "",
      renderSection("Created Files", renderList(asStringArray(workspace.createdFiles))),
      "",
      renderSection("Updated Files", renderList(asStringArray(workspace.updatedFiles))),
      "",
      renderSection("Skipped Files", renderList(asStringArray(workspace.skippedFiles)))
    );
  }

  return ensureTrailingNewline(lines.join("\n"));
}

function renderBootstrapPayload(kind: "init", payload: Record<string, unknown>): string {
  const record = isRecord(payload[kind]) ? (payload[kind] as Record<string, unknown>) : payload;
  return ensureTrailingNewline(
    [
      "# Workspace Initialized",
      "",
      `- Mode: ${typeof record.mode === "string" ? inlineCode(record.mode) : inlineCode(kind)}`,
      `- Root: ${typeof record.root === "string" ? inlineCode(record.root) : "Unknown"}`,
      `- Docs root: ${typeof record.docsRoot === "string" ? inlineCode(record.docsRoot) : "Unknown"}`,
      `- Workspace root: ${typeof record.workspaceRoot === "string" ? inlineCode(record.workspaceRoot) : "Unknown"}`,
      `- Active change: ${typeof record.activeChangeId === "string" ? inlineCode(record.activeChangeId) : "Unknown"}`,
      "",
      renderSection("Created Files", renderList(asStringArray(record.createdFiles))),
      "",
      renderSection("Updated Files", renderList(asStringArray(record.updatedFiles))),
      "",
      renderSection("Skipped Files", renderList(asStringArray(record.skippedFiles)))
    ].join("\n")
  );
}

function renderGenericRecord(title: string, payload: Record<string, unknown>): string {
  const scalarLines = Object.entries(payload)
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .map(([key, value]) => `- ${humanizeKey(key)}: ${typeof value === "string" ? value : String(value)}`);
  const complexSections = Object.entries(payload)
    .filter(([, value]) => typeof value === "object" && value !== null)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        const items = value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
        return renderSection(humanizeKey(key), renderList(items));
      }

      return renderSection(
        humanizeKey(key),
        `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``
      );
    });

  return ensureTrailingNewline([`# ${title}`, "", ...scalarLines, ...complexSections.flatMap((section) => ["", section])].join("\n"));
}

function renderSuccessPayload(payload: unknown): string {
  if (!isRecord(payload)) {
    return ensureTrailingNewline(String(payload));
  }

  if (isRecord(payload.guide)) {
    return renderGuide(payload.guide);
  }

  if (isRecord(payload.status)) {
    return renderStatus(payload.status, payload.synced === true);
  }

  if (isRecord(payload.site)) {
    return renderSite(payload.site);
  }

  if (isRecord(payload.project)) {
    return renderProject(payload.project);
  }

  if (isRecord(payload.goal)) {
    return renderGoal(payload.goal, typeof payload.nextAction === "string" ? payload.nextAction : undefined);
  }

  if ("plan" in payload || "planTree" in payload || "topLevelPlans" in payload || "deletedPlanIds" in payload) {
    return renderPlanPayload(payload);
  }

  if ("task" in payload || "taskTree" in payload || "deletedTaskIds" in payload || "progressPercent" in payload) {
    return renderTaskPayload(payload);
  }

  if ("decision" in payload) {
    return renderDecisionPayload(payload);
  }

  if ("version" in payload) {
    return renderVersionPayload(payload);
  }

  if ("doctor" in payload || "checks" in payload) {
    return renderDoctorPayload(payload);
  }

  if ("init" in payload) {
    return renderBootstrapPayload("init", payload);
  }

  return renderGenericRecord("Result", payload);
}

function renderErrorPayload(payload: Record<string, unknown>): string {
  const error = isRecord(payload.error) ? payload.error : payload;
  const lines = [
    "# Error",
    "",
    `- Message: ${typeof error.message === "string" ? error.message : "Unknown error"}`
  ];

  if (typeof error.code === "string") {
    lines.push(`- Code: ${inlineCode(error.code)}`);
  }

  if (typeof error.category === "string") {
    lines.push(`- Category: ${inlineCode(error.category)}`);
  }

  if (typeof error.retryable === "boolean") {
    lines.push(`- Retryable: ${error.retryable ? "yes" : "no"}`);
  }

  if (typeof error.hint === "string" && error.hint.trim().length > 0) {
    lines.push("", renderSection("Hint", error.hint));
  }

  return ensureTrailingNewline(lines.join("\n"));
}

export function stripGlobalJsonFlag(argv: string[]): { argv: string[]; json: boolean } {
  const nextArgv: string[] = [];
  let json = false;

  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    nextArgv.push(arg);
  }

  return { argv: nextArgv, json };
}

export function renderCapturedOutput(text: string, stream: "stdout" | "stderr"): string {
  if (!text.trim()) {
    return "";
  }

  const parsed = tryParseJson(text);
  if (!parsed || !isRecord(parsed)) {
    return ensureTrailingNewline(text);
  }

  if (stream === "stderr" || "error" in parsed) {
    return renderErrorPayload(parsed);
  }

  return renderSuccessPayload(parsed);
}
