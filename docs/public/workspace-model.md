---
name: Workspace Model
description: The public model for how APCC separates authored docs from structured control-plane state.
---

# Workspace Model

## Two Surfaces

APCC is built around a strict separation between:

- `docs/` for authored context
- `.apcc/` for structured control-plane state

This separation prevents prose, execution state, and runtime artifacts from drifting into one another.

## Authored Context

Put these in `docs/`:

- explanations
- guides
- constraints
- background
- public usage documentation
- maintainer notes

Authored docs should help a human or Agent understand the project. They should not become the authoritative storage for current execution state.

## Agent Bootstrap Files

`AGENTS.md` and `.agents/skills/apcc-workflow/SKILL.md` are APCC-managed bootstrap artifacts, but they are not part of `.apcc/`.

Important rule:

- APCC may only treat the `<!-- APCC:BEGIN --> ... <!-- APCC:END -->` block in `AGENTS.md` as its managed surface
- other repository-specific `AGENTS.md` content must be preserved

## Structured Control Plane

Put these in `.apcc/`:

- workspace metadata
- project overview
- end goal
- plans
- tasks
- owner registry
- decisions
- project-level versions
- docs-site workspace config

The control plane should store explicit facts that tools can read predictably.

For the normative persisted field contract, allowed values, and direct-edit rules, see `apcc guide control-plane-contract`.

Recommended active files include:

```text
.apcc/
  meta/workspace.yaml
  config/workspace.yaml
  project/overview.yaml
  goals/end.yaml
  plans/current.yaml
  tasks/current.yaml
  owners/registry.yaml
  decisions/records.yaml
  versions/records.yaml
```

## Plans And Tasks

Plans are execution streams. Tasks are concrete work items.

The Console and status views are plan-first:

- plans form the top-level execution tree
- each plan can show the task tree attached to that plan
- task status drives derived plan status and progress
- child tasks stay on the same `planRef` as their parent task

Do not persist a separate `plan.status` field. A stored plan says what stream exists; current status is computed from the task tree.

Plan and task owner fields reference `.apcc/owners/registry.yaml`. Owner ids identify the human, agent, service, or other operator currently responsible for that work. The owner can change during handoff.

Pinned plans and tasks are explicit context-retention markers. A pinned item is always shown in progressive list output so important context is not hidden by pagination or large historical trees. Pinned does not mean priority, blocker, current focus, or ownership.

## Derived State Rule

APCC should persist explicit facts, not computed caches.

Derived at read time:

- progress percentages
- plan status
- current status summaries
- docs-site runtime snapshots

Persisted explicitly:

- plan and task ids
- names and summaries
- parent relationships
- optional plan version anchors
- task status
- owner registry and owner refs
- pinned context markers and pinned reasons
- creation and update timestamps for plan/task lifecycle reminders
- doc references
- decision and version records

This keeps direct workspace edits safe. After editing `.apcc/`, run `apcc doctor check` and inspect the derived view with `apcc status`.

## `docPath` Rule

Whenever structured state needs to point at authored documentation, it should do so explicitly with `docPath`.

Examples:

- project overview -> overview doc
- end goal -> goal doc
- decision record -> optional decision doc
- version record -> optional version doc

This keeps APCC neutral. The runtime should not infer business meaning from fixed docs subdirectories.

## Version Scoping

Plans may carry an optional `versionRef` that points at a record in `.apcc/versions/records.yaml`.

Rules:

- `plan.versionRef` is persisted explicitly
- a child plan inherits the nearest non-null ancestor version anchor as its effective version scope
- tasks do not store `versionRef`; they inherit version scope through `task.planRef`
- `apcc plan list --version ...` and `apcc task list --version ...` filter by the effective plan scope, not by duplicated task metadata

## Progressive Disclosure

Large workspaces may contain thousands of plans or tasks. APCC list commands are allowed to show a progressive view instead of the entire tree.

Rules:

- pinned items remain visible outside the normal page limit
- paged output reports shown count, hidden count, and next cursor
- filters such as owner, status, plan, and version must be shown in output
- use `--all` only when the full matching tree is actually needed

`apcc status` stays a project-level summary. It should surface important reminders without trying to render every plan or task.

## Lifecycle Reminders

APCC records plan and task timestamps so `status` and `doctor check` can remind humans and agents about stale work.

Reminders are not cleanup. APCC should warn about long-unupdated work, long-blocked tasks, inactive owners assigned to open work, unowned in-progress tasks, or completed items that remain pinned, but it should not delete or unpin anything automatically.

## Runtime Artifacts

Runtime artifacts do not belong in authored docs or structured control-plane files.

`apcc site start` stages runtime data for the live local docs site. `apcc site build` creates a deployable read-only artifact. Both are generated outputs, not source-of-truth project context.

Workspace mutation locks also belong to local runtime state, not to `.apcc/`. APCC stores those lock directories under the per-user APCC runtime base so repository workspaces do not accumulate Git-tracked coordination files.

## Metadata And Provenance

APCC keeps workspace compatibility and tool provenance separate:

- `.apcc/meta/workspace.yaml.workspaceSchemaVersion` tracks the persisted workspace schema
- `.apcc/meta/workspace.yaml.apccVersion` records which APCC CLI version last initialized or repaired the workspace

Do not treat the APCC package version as a replacement for the workspace schema version. One APCC release may keep the same persisted workspace schema, and one schema may remain compatible across multiple APCC releases.
