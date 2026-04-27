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

## Structured Control Plane

Put these in `.apcc/`:

- project overview
- end goal
- plans
- tasks
- decisions
- project-level versions
- docs-site workspace config

The control plane should store explicit facts that tools can read predictably.

Recommended active files include:

```text
.apcc/
  config/workspace.yaml
  project/overview.yaml
  goals/end.yaml
  plans/current.yaml
  tasks/current.yaml
  decisions/records.yaml
  versions/records.yaml
```

## Plans And Tasks

Plans are execution streams. Tasks are concrete work items.

The Console and status views are plan-first:

- plans form the top-level execution tree
- each plan can show the task tree attached to that plan
- task status drives derived plan status and progress

Do not persist a separate `plan.status` field. A stored plan says what stream exists; current status is computed from the task tree.

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
- task status
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

## Runtime Artifacts

Runtime artifacts do not belong in authored docs or structured control-plane files.

`apcc site start` stages runtime data for the live local docs site. `apcc site build` creates a deployable read-only artifact. Both are generated outputs, not source-of-truth project context.
