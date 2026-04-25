---
name: APCC Workflow Guide
description: Canonical Agent-first workflow guidance for operating an APCC workspace.
---

# APCC Workflow Guide

Use this guide as the single operating protocol for an APCC workspace.

You can read the same content through `apcc guide workflow` or the generated `.agents/skills/apcc-workflow/SKILL.md`.

APCC is a agent-first project context framework for development agents and the humans directing them.

It gives a repository a structured project context control plane without turning the framework itself into a hosted service.

If an Agent has read the APCC section in `AGENTS.md` and this guide, it has enough context to operate APCC correctly in a repository.

For deeper public reference, run `apcc guide`. The reserved `workflow` topic is this Agent guide; every other guide topic is loaded from the bundled `docs/public/*.md` file name.

The core rule is simple:

- prefer the cheapest safe action
- make the project identity and long-lived goal explicit before substantial implementation
- do not spend tokens re-reading state you still trust
- refresh the control plane when context is cold or possibly stale
- update `.apcc` before implementation whenever a new task or plan shift is confirmed

## Operating States

Every turn is not a new round. Decide which state you are in first.

### Cold Round

You are in a cold round when one of these is true:

- this is a new thread or new agent session
- your working memory is gone or unreliable
- you just switched workspace, branch, or task context after a pause
- you cannot confidently explain the current goal, phase, next actions, and blockers

### Warm Continuation

You are in a warm continuation when all of these are true:

- you are still in the same thread or continuous session
- you still understand the current goal and task
- no human change is suspected
- no control-plane write or handoff boundary is happening right now

Warm continuation is the default for active implementation. Do not restart the whole protocol just because a new assistant turn began.

### Desync Suspicion

Treat the workspace as potentially desynced when one of these is true:

- a human may have changed code, docs, or `.apcc`
- you are about to update `.apcc`
- the plan, next action, or blocker picture feels uncertain
- you are preparing a handoff, version, or decision boundary
- the local docs-site view may no longer match the control plane

## Goal-Driven Development

APCC expects development agents to treat project definition and long-lived intent as first-class prerequisites, not optional afterthoughts.

Before substantial implementation, you should be able to answer:

- what project this repository is actually trying to build
- what the long-lived end goal is
- whether the current request is the whole project, one feature, or one execution slice
- what "done" means at the project level, not just the current task level

If these answers are not already explicit in the workspace or authored docs:

- inspect the smallest credible source first
- if the project identity or long-lived goal is still unclear, ask the human directly
- do not silently substitute a one-line feature request for a project definition

Important distinctions:

- a user request is not automatically the project overview
- a current task is not automatically the end goal
- a local implementation slice is not automatically the product boundary

When the project definition is unclear, clarification is part of the work. Do not skip it just to start coding faster.

## Cold Round Start

Only cold rounds require the full round-start sequence.

Run, in order:

```bash
apcc site open
apcc status show
```

If this is the first open for a workspace and the human is likely to revisit the docs site, prefer a stable unique port:

```bash
apcc site open --port 4317
```

Then apply this rule:

- if `status show` already gives you the project identity, goal, phase, next actions, and blockers, start work
- inspect more files only if something is still unclear
- if the project identity or long-lived goal is still unclear, clarify them before implementation
- if a human may have changed files, inspect the touched workspace surface directly before continuing
- after `site open`, tell the human the returned docs-site URL explicitly
- keep the docs site running unless the human explicitly asks you to stop or clean it

## Warm Continuation

In a warm continuation:

- continue directly on the current task
- do not rerun `site open` or `status show` by default
- do not re-read `.apcc` or `docs` just to satisfy ritual
- only re-sync when a real trigger appears

This is the main token-saving rule. APCC should reduce uncertainty, not create mechanical repetition.

## Re-Sync Triggers

Use the smallest re-sync that closes the uncertainty.

Run `apcc status show` when:

- the current goal is unclear
- the current phase is unclear
- the next actions are unclear
- blockers may have changed
- you need to refresh your control-plane picture before editing `.apcc`

Run `apcc site open` when:

- you or the human need the docs-site or Console view
- you want to verify the projected docs/runtime state visually
- you want to give the human a stable local docs-site URL; on first open prefer `--port <unique-port>` or a workspace `docsSite.preferredPort`

Inspect touched files directly when:

- a human may have edited the repository
- you suspect local authored docs or code changed outside the control plane
- you need exact file-level change context

Do not promote these actions into mandatory every-turn overhead.

## Inspect Only If Needed

After `status show`, inspect the smallest surface that answers the remaining question.

Read `.apcc/project/overview.yaml` only if:

- the project identity or summary is still unclear

Read `.apcc/goals/end.yaml` only if:

- the long-lived end goal is unclear or may have changed

Read `.apcc/plans/current.yaml` and `.apcc/tasks/current.yaml` only if:

- the execution tree is unclear
- the next task boundary is unclear
- you need exact plan/task ids or parent relationships

Read the authored overview, goal, or internal docs only if:

- you need background
- you need constraints
- you need explanation
- you need handoff context

In repositories following the recommended docs package profile, this usually means:

- the overview doc referenced by `.apcc/project/overview.yaml`
- the goal doc referenced by `.apcc/goals/end.yaml`
- files under `docs/internal/`

Do not read both `.apcc` state and authored docs for the same question unless there is a mismatch you are actively resolving.

If neither source is enough to establish what the project is or what the project is trying to become, ask the human before implementation.

## Non-Negotiable Write Rules

Treat `docs/` and `.apcc/` as two separate surfaces with different purposes.

Write to `docs/` when changing:

- background
- constraints
- explanation
- handoff

Write to `.apcc/` when changing:

- project overview
- end goal
- plans
- tasks
- decisions
- version records
- docs-site workspace config

Use the Console only as a view and editing surface over `.apcc`. It is not a second truth source.

## Recommended Docs Package Profile

APCC recommends a minimal authored docs profile for general projects:

```text
docs/
  meta.json
  shared/
    overview.md
    goal.md
  public/
  internal/
```

The tree above is the default English scaffold. Repositories using another primary docs language may use localized anchor filenames instead.

Treat it as a best-practice reference, not a mandatory directory contract.

Use:

- `docs/meta.json` to define the intended top-level docs-site order when the default scaffold is enough
- `docs/shared/overview.md` for what the project is
- `docs/shared/goal.md` for where the project is trying to go
- `docs/public/` for external-facing authored docs
- `docs/internal/` for maintainer-facing authored docs

Important boundary:

- this profile is the official recommended docs package shape
- it is the current CLI scaffold default
- existing repositories do not need to be force-migrated just to satisfy the recommendation

## Refresh The Workspace First

When the plan changes, refresh the workspace before continuing implementation.

This means:

1. Update `.apcc` immediately.
2. Make the next plan/task state explicit.
3. Re-read the derived status view when you need confirmation.
4. Re-open the docs site only if a human needs the refreshed projection.

Do not let code move ahead of the control plane. Humans should always be able to open the site and see what happens next.

## Update The Workspace Before Action

Treat this as a hard execution rule, not a stylistic suggestion.

When a new task, changed plan, new decision boundary, or new version boundary becomes clear:

1. Update `.apcc` first.
2. Confirm the next explicit task or plan state.
3. Only then start code, docs, or runtime work.

This applies even in warm continuation. Warm context means you can skip redundant re-sync, not that you can skip recording the new task boundary.

Bad loop:

1. Start coding immediately.
2. Remember later that the plan changed.
3. Patch `.apcc` after the implementation already moved.

Correct loop:

1. Confirm the new task or plan boundary.
2. Write it into `.apcc` directly or through the CLI.
3. Re-read the derived view only if needed.
4. Start implementation with the control plane already aligned.

If an agent repeatedly skips this ordering, the workflow guidance is not strong enough and should be tightened.

## CLI Versus Direct Workspace Edits

Both are valid. Use each where it is strongest.

Use direct `.apcc/` edits as the best practice when:

- you need to update multiple structured fields quickly
- you are refining plans and tasks in bulk
- you already understand the workspace schema

Use CLI as the best practice when:

- initializing a workspace in a new or existing repository
- validating and repairing the workspace
- starting, building, or cleaning the docs site
- making small targeted control-plane mutations
- discovering command arguments and examples through help

CLI mutation commands should return concise deltas. They are not a replacement for direct structured edits when many plans or tasks need to move together. After direct `.apcc/` edits, run `apcc validate` and an explicit inspection command such as `apcc status show`, `apcc plan show`, or `apcc task list`.

Important rules:

- `.apcc` should persist explicit facts, not derived execution caches
- progress and plan execution status are derived at read time from the current plan and task trees
- CLI mutations do not require a manual sync step to make derived views correct
- direct edits to `.apcc/` are reflected automatically in `apcc status show`, `apcc plan show`, and the docs-site snapshot
- there is no manual sync ritual in the normal operating loop
- do not treat CLI as the only valid way to edit the control plane

## Command Discovery Protocol

When you do not fully understand a command, inspect help before acting.

Use:

```bash
apcc --help
apcc <group> --help
```

Examples:

```bash
apcc project --help
apcc plan --help
apcc task --help
apcc site --help
```

Treat help output as the authoritative quick reference for arguments, examples, and returned fields.

Default CLI output is Markdown for development agents. Add `--json` only when you explicitly need raw structured output for scripting or inspection.

## Bring A Workspace Under Control

Use `apcc init` for both cases:

- empty directory: create a new APCC workspace
- existing repository: attach the APCC control plane safely

Bootstrap defaults to the current directory when `--target-path` is omitted.

APCC persists one primary docs language in `.apcc/config/workspace.yaml`.

- `apcc init` defaults that language to `en`
- when a development agent is initializing a repository for a human, it should usually set `--docs-language` to match the current human conversation language unless the repository already has an established docs language
- APCC does not require multilingual mirrored docs packages

Project overview and end goal can be provisional during bootstrap. If the project shape is still unclear, initialize first, then refine the anchors later with `apcc project set` and `apcc goal set`.

When `init` targets an existing repository, it must stay non-invasive:

- it can create missing APCC-managed anchors
- it must not rewrite existing authored docs at the same path
- it must not reshape the existing project just to match the recommended docs package

Examples:

```bash
apcc init
apcc init --docs-language zh-CN --project-name 示例项目 --project-summary "面向开发代理的项目上下文框架。" --end-goal-name "完成首个稳定版本" --end-goal-summary "将示例项目推进到可持续迭代的稳定状态。"
apcc init --project-name Example --project-summary "agent-first project context framework for Example." --end-goal-name "Ship Example" --end-goal-summary "Turn Example into a stable product with a clear delivery loop."
apcc init --project-name Existing --project-summary "Existing repository brought under APCC management." --end-goal-name "Stabilize Existing Repo" --end-goal-summary "Bring the existing repository under a reliable APCC workflow."
```

Immediately after `init`, run:

```bash
apcc site open
apcc status show
```

Use `apcc validate --repair` only when:

- the workspace looks incomplete or damaged
- managed files are missing
- schema/config metadata is stale
- you need to rehydrate the current managed files and config surface

## Set The Core Anchors

The project overview answers:

- what this project is
- why it exists
- which overview document is the canonical authored entry

Use:

```bash
apcc project set --name "Example Project" --summary "One-sentence definition of what this repository is actually building." --doc-path shared/overview.md
apcc project show
```

The end goal is stable and project-wide. Do not use it for the current iteration title.

If bootstrap used a provisional goal anchor, replace it as soon as the long-lived outcome becomes clear.

Use:

```bash
apcc goal set --name "Ship Example" --description "Long-lived outcome that defines what success means for the whole project."
apcc goal show
```

If the goal changes materially, record a decision before or alongside the change.

If you cannot state the project overview and end goal without hedging, stop and clarify them before doing substantial implementation work.

## Build Plans And Tasks

Use plans for current execution streams. Use tasks for concrete work items.

Examples:

```bash
apcc plan add --name "Ship onboarding" --parent root --summary "Turn the first-hour onboarding path into a reliable default flow."
apcc task add --name "Add workflow guide command" --parent root --plan ship-onboarding-1 --summary "Expose the canonical workflow guide through the CLI."
```

Important command rules:

- `plan add` and `task add` return ids
- `--parent root` is the explicit top-level marker for CLI tree mutations
- every plan must have a summary
- every task must have a summary
- the current focus comes from the plan tree plus the scoped task drilldown attached to each plan
- do not reintroduce an `active goal` layer
- do not persist `plan.status`; it is derived from the current task state

Common follow-up mutations:

```bash
apcc task update --id add-workflow-guide-command-1 --status in_progress
apcc task update --id add-workflow-guide-command-1 --status done
apcc plan delete --id old-plan-1
apcc task delete --id obsolete-task-1
```

## Docs-Site Workspace Config

The docs site is a default collaboration surface, so keep its configuration in the workspace.

The persisted config lives in:

```text
.apcc/config/workspace.yaml
```

Relevant fields:

```yaml
docsSite:
  enabled: true
  sourcePath: docs
  preferredPort: 4310
```

Rules:

- `sourcePath` is workspace-relative
- `preferredPort` is the preferred local port for `apcc site open`
- `apcc site open --port <port>` overrides the current open without rewriting the workspace config
- when `site open` runs without `--path`, it uses this persisted configuration

## First-Hour Loop

The first-hour loop is a cold-start loop. It is not the right default for warm continuation.

1. Initialize the workspace.
2. Start the docs site with `apcc site open`.
3. Run `apcc validate`.
4. If validation exposes repairable issues, run `apcc validate --repair`.
5. Read the current anchors with:

```bash
apcc project show
apcc goal show
apcc plan show
apcc task list
apcc status show
```

6. Make the current work explicit in `.apcc` before touching code.
7. Complete one small loop, then re-check the derived view:

```bash
apcc status show
```

If you cannot explain the project overview, end goal, current plans, current tasks, and current docs-site URL, you are not ready to implement.

## Decision Triggers

Record a formal decision when one of these changes:

- end goal
- scope
- high-cost change direction
- architecture
- breaking-change policy
- versioning policy

Do not force a decision record for ordinary in-scope implementation, low-risk refactors, or routine fixes.

## Validation And Runtime

Use these guardrails regularly:

```bash
apcc site open
apcc site stop
apcc site build
apcc site clean
```

`site open` is the default live-refreshing local collaboration surface. It uses the APCC-packaged prebuilt viewer shell automatically. `site stop` stops the local runtime without purging it. `site build` creates a deployable read-only docs-site artifact and must not stop a healthy live runtime. `site clean` removes the staged runtime and is the heavy reset path.

Important operating rule for development agents:

- after `site open`, report the returned URL to the human
- keep the site alive across normal task completion
- use `site stop` or `site clean` only when the human explicitly asks for it or when you are intentionally resetting a runtime you own

`validate --repair` is a repair command, not a mandatory every-round command. Use it when the workspace or managed files need recovery.

## Success Criteria For A Correct Agent Loop

A correct Agent loop means all of the following are true:

1. The Agent can tell whether it is in a cold round, warm continuation, or desync suspicion state.
2. The Agent spends tokens only on the smallest synchronization action that closes the uncertainty.
3. The docs site is reachable when needed, not reopened by ritual.
4. The project overview is explicit.
5. The long-lived end goal is explicit.
6. The current plans and tasks are explicit when needed.
7. One small task can move without losing context.
8. The workspace can be validated and handed back without undocumented assumptions.
