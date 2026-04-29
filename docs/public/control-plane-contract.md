---
name: Control Plane Contract
description: Normative value-domain and field-semantics reference for directly editing the APCC `.apcc` workspace.
---

# Control Plane Contract

This page is the normative contract for editing `.apcc/` directly.

Use it when:

- an Agent is editing `.apcc/` without going through a CLI mutation command
- a maintainer needs authoritative allowed values for persisted control-plane fields
- you need to distinguish stored fields from derived fields

If a field or value conflicts with this page, treat this page and the current CLI validation behavior as authoritative.

After direct `.apcc/` edits, run:

```bash
apcc doctor check
apcc status
```

## Contract Scope

The APCC control plane is the persisted state under:

```text
.apcc/
  meta/workspace.yaml
  config/workspace.yaml
  project/overview.yaml
  goals/end.yaml
  plans/current.yaml
  tasks/current.yaml
  decisions/records.yaml
  versions/records.yaml
```

`docs/` is authored context, not control-plane state.

## Stored Versus Derived

Persist these explicitly:

- ids
- names
- summaries
- parent relationships
- plan version anchors
- task status
- doc references
- decision records
- version records
- workspace config and metadata

Do not persist these as first-class control-plane fields:

- plan status
- progress percentages
- current phase labels
- docs-site runtime state

Those are derived at read time.

## General Rules

- ids must use lowercase letters, numbers, and hyphens
- ids must start and end with a letter or number
- `root` is reserved and must not be stored as an id
- top-level `parentPlanId` and `parentTaskId` are stored as `null`
- CLI input `--parent root` maps to stored `null`
- `docPath` values are relative to the `docs/` root
- persisted docs language values are normalized to `en` or `zh-CN`
- targeted single-node task and plan mutations should prefer CLI commands over hand-editing YAML

## Plans

File:

```text
.apcc/plans/current.yaml
```

Shape:

```yaml
endGoalRef: end-goal-id
items:
  - id: example-plan
    name: Example plan
    summary: Example summary
    parentPlanId: null
    versionRef: null
```

Rules:

- `endGoalRef`: string id pointing at `.apcc/goals/end.yaml.goalId`
- `items`: array
- each plan must define:
  - `id`
  - `name`
  - `summary`
  - `parentPlanId`
  - `versionRef`
- `parentPlanId` is either another plan id or `null`
- `versionRef` is either a version record id from `.apcc/versions/records.yaml` or `null`
- `plan.status` is not stored
- `effectiveVersionRef` is derived at read time by inheriting the nearest non-null `versionRef` from the plan tree
- a child plan must not override an inherited non-null `versionRef` with a different version record id

Derived plan status values are:

- `pending`
- `in_progress`
- `done`
- `blocked`

They are computed from the task tree, not persisted into `plans/current.yaml`.

## Tasks

File:

```text
.apcc/tasks/current.yaml
```

Shape:

```yaml
items:
  - id: example-task
    name: Example task
    summary: Example summary
    status: pending
    planRef: example-plan
    parentTaskId: null
    countedForProgress: true
```

Allowed `status` values:

- `pending`: not started
- `in_progress`: started, or partially completed but not done
- `done`: completed
- `blocked`: cannot currently proceed because of a real blocker

Rules:

- `items`: array
- each task must define:
  - `id`
  - `name`
  - `summary`
  - `status`
  - `planRef`
  - `parentTaskId`
  - `countedForProgress`
- `planRef` must reference an existing plan id
- `parentTaskId` is either another task id or `null`
- `countedForProgress` must be `true` or `false`
- a child task must use the same `planRef` as its parent task
- tasks do not persist a separate `versionRef`; version scope is derived from the referenced plan

Progress rule:

- only tasks with `countedForProgress: true` are counted for percent progress
- percent is derived as `round(done / counted * 100)`

Plan-derivation rule:

- if all relevant tasks are `done`, the plan is `done`
- else if any relevant task is `blocked`, the plan is `blocked`
- else if any relevant task is `in_progress`, the plan is `in_progress`
- else if any relevant task is `done` but not all are done, the plan is `in_progress`
- else the plan is `pending`

## Decisions

File:

```text
.apcc/decisions/records.yaml
```

Allowed `category` values:

- `goal`
- `scope`
- `change`
- `architecture`
- `version`
- `policy`
- `other`

Allowed `status` values:

- `pending`
- `approved`
- `rejected`

Rules:

- `items`: array
- each record must use one allowed `category`
- each record must use one allowed `status`
- `docPath` is optional and stored as a docs-relative path or `null`

## Versions

File:

```text
.apcc/versions/records.yaml
```

Allowed `status` values:

- `draft`
- `recorded`

Rules:

- `items`: array
- each record must use one allowed `status`
- `docPath` is optional and stored as a docs-relative path or `null`

## Workspace Metadata

File:

```text
.apcc/meta/workspace.yaml
```

Allowed values:

- `workspaceSchemaVersion`: integer APCC-managed schema version
- `apccVersion`: APCC CLI version that last initialized or repaired the workspace
- `bootstrapMode`: `init`
- `projectKind`: `general`, `frontend`, `library`, `service`
- `docsMode`: `minimal`, `standard`
- `docsLanguage`: `en`, `zh-CN`

Current default shape:

```yaml
workspaceSchemaVersion: 10
apccVersion: 0.3.4
workspaceName: apcc-project
docsRoot: docs
workspaceRoot: .apcc
bootstrapMode: init
templateVersion: 2026-04-30.runtime-state-and-version-scoping-1
projectKind: general
docsMode: standard
docsLanguage: en
createdAt: 2026-04-29T00:00:00.000Z
lastUpgradedAt: null
```

Rules:

- this file stores managed workspace metadata
- `templateVersion` is APCC-managed and should match the current scaffold template
- `workspaceSchemaVersion` is APCC-managed and should match the current workspace schema
- `apccVersion` records which APCC CLI version last initialized or repaired the workspace

## Workspace Config

File:

```text
.apcc/config/workspace.yaml
```

Allowed values:

- `siteFramework`: `fumadocs`
- `packageManager`: `npm`
- `projectKind`: `general`, `frontend`, `library`, `service`
- `docsMode`: `minimal`, `standard`
- `docsLanguage`: `en`, `zh-CN`

`docsSite` rules:

- `enabled`: boolean
- `sourcePath`: non-empty string
- `preferredPort`: positive integer or `null`

Current default shape:

```yaml
siteFramework: fumadocs
packageManager: npm
projectKind: general
docsMode: standard
docsLanguage: en
docsSite:
  enabled: true
  sourcePath: docs
  preferredPort: null
workspaceSchemaVersion: 10
```

## CLI-To-Storage Mappings

The CLI accepts a few human-facing tokens that are not stored verbatim:

- `--parent root` -> stored `null`
- `--docs-language zh` -> stored `zh-CN`
- `--docs-language en-US` -> stored `en`
- `plan add/update --version <record-id-or-version-label>` -> stored `plan.versionRef` as the matching version record id

Prefer the normalized persisted values when editing YAML directly.

Prefer CLI mutations such as `apcc task update --parent/--plan` or `apcc plan update --parent` when only one task or plan needs to move.

## Safe Direct-Edit Loop

When editing `.apcc/` directly:

1. change the smallest number of files necessary
2. keep ids stable unless you are intentionally restructuring references
3. replace existing fields structurally instead of appending duplicate keys under one YAML mapping
4. use only the allowed values on this page
5. run `apcc doctor check`
6. inspect the derived view with `apcc status`, `apcc plan show`, or `apcc task list`

If you are unsure whether a field is stored or derived, do not invent a new persisted field.
