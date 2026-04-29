---
name: CLI
description: The public command surface and the intended role of each command group.
---

# CLI

## Design Principle

The CLI is the public command surface for APCC. It is not the only valid way to edit an APCC workspace.

Use the CLI where safety, discovery, workspace diagnostics, and runtime control matter. Use direct `.apcc/` edits when bulk structured changes are clearer and cheaper.

## Install

APCC is intended to be used as an installed binary:

```bash
npm install -g apcc
apcc --help
```

During APCC's own repository development, maintainers can run the source command with:

```bash
npm run dev -- --help
```

End users should not need the source tree or a per-project docs runtime build to use APCC.

## Command Groups

Current public command groups:

- `guide`
- `init`
- `doctor`
- `project`
- `goal`
- `plan`
- `task`
- `status`
- `decision`
- `version`
- `site`

## Guide

`guide` exposes bundled documentation through the CLI:

```bash
apcc guide
apcc guide workflow
apcc guide cli
apcc guide control-plane-contract
```

`workflow` is reserved for the Agent workflow guide.

All other guide topics are discovered dynamically from bundled `docs/public/*.md` files. The file name becomes the topic name, so adding `docs/public/example.md` exposes `apcc guide example` after the package is built. Command code should not hardcode public topic names such as `quickstart` or `docs-site`.

## Workspace Bootstrap

`init` brings a repository under APCC control:

```bash
apcc init
apcc init --docs-language zh-CN
```

It creates or repairs the framework-owned surfaces:

- `.apcc/` structured control plane
- recommended docs anchors under the configured docs root
- `AGENTS.md` APCC instructions inside an `<!-- APCC:BEGIN --> ... <!-- APCC:END -->` managed block
- `.agents/skills/apcc-workflow/SKILL.md`

If `AGENTS.md` already contains unrelated repository-specific instructions, APCC should preserve them and only manage its own marked block.

`doctor` checks and repairs the workspace:

```bash
apcc doctor check
apcc doctor fix
```

`doctor check` is the no-mutation workspace diagnostic pass. `doctor fix` restores missing managed files and stale workspace metadata when repair is safe and intentional. It is a repair command, not a required every-round ritual.

Default CLI output renders a concise Markdown doctor summary for agents. Add `--json` when you need the raw ACLIP doctor payload. `doctor fix --json` adds the APCC workspace delta describing which managed files were created, updated, or skipped.

## Project And Goal

`project` manages the structured project overview anchor:

```bash
apcc project show
apcc project set --name "Example" --summary "What this repository is." --doc-path shared/overview.md
```

`goal` manages the long-lived end goal:

```bash
apcc goal show
apcc goal set --name "Ship Example" --description "Stable project outcome." --doc-path shared/goal.md
```

Do not treat a current task title as the end goal. If the project identity or end goal is unclear, clarify it before substantial implementation.

## Plans And Tasks

`plan` manages current execution streams:

```bash
apcc plan add --name "Ship onboarding" --parent root --summary "Make first-hour usage reliable."
apcc plan add --name "Cut 0.3.4 scope" --parent root --version 0.3.4
apcc plan show
apcc plan show --version 0.3.4
apcc plan show --unversioned
apcc plan update --id <plan-id> --summary "Updated summary."
apcc plan update --id <plan-id> --version 0.3.4
```

`task` manages concrete work items attached to plans:

```bash
apcc task add --name "Document first-hour loop" --parent root --plan <plan-id> --summary "Write the public first-hour loop."
apcc task update --id <task-id> --status in_progress
apcc task list
apcc task list --version 0.3.4
apcc task list --unversioned
```

Important behavior:

- `plan add` and `task add` accept optional explicit `--id` values
- plans may carry an optional `--version` anchor that resolves from either a version record id or a version label
- single-node mutations return concise deltas, not the full tree
- full context is available through `plan show`, `task list`, and `status`
- plan status and progress are derived from tasks at read time
- tasks do not persist their own version anchor; they inherit version scope from their referenced plan
- child tasks must stay on the same `planRef` as their parent task
- `plan show` and `task list` accept `--version <record-id-or-version-label>` and `--unversioned` filters
- the id `root` is reserved as the CLI parent marker

For bulk plan or task restructuring, edit `.apcc/plans/current.yaml` and `.apcc/tasks/current.yaml` directly, then run:

```bash
apcc doctor check
apcc status
```

When editing `.apcc/` directly, use `apcc guide control-plane-contract` as the authoritative value-domain reference for persisted fields such as task status, decision category, version status, docs language, and workspace config enums.

APCC intentionally does not duplicate direct workspace editing with batch CLI import flags.

## Status, Decisions, And Versions

`status` renders the derived project status snapshot:

```bash
apcc status
```

Use `decision` for high-value direction changes such as architecture, scope, goal, or breaking-change policy.

Use `version` for low-frequency project-level maturity records. A version record can mark an internal framework baseline; it does not have to correspond to a public product launch.

## Site

`site` controls the docs-site lifecycle:

```bash
apcc site start
apcc site start --port 4317
apcc site status
apcc site list
apcc site stop
apcc site clean
apcc site build
```

`site start` starts or reuses the local live docs site. It uses the APCC-packaged prebuilt viewer shell automatically, keeps runtime data refreshed from the configured docs root plus `.apcc`, and lands the root docs URL on the localized Console Overview page.

`site status` is the low-cost probe for agents and humans. It tells you whether the targeted runtime is `absent`, `staged`, or `live`, and only reports a URL when a healthy live instance exists.

Use `--port` when you want a stable local address for the current start without editing workspace config. Use `.apcc/config/workspace.yaml` `docsSite.preferredPort` when the workspace should keep a stable default port.

`site build` creates a deployable read-only docs-site artifact. It does not prepare `site start`, does not replace the live watcher, and must not stop a healthy live runtime.

`site stop` is an explicit runtime control command. It should not be treated as a routine end-of-task step by development agents.

## Output Contract

Default CLI output is Markdown because development agents consume it efficiently.

Use `--json` only when raw structured output is useful for scripting or exact inspection.

If a command's behavior or arguments are unclear, inspect help first:

```bash
apcc --help
apcc <group> --help
```

Treat help output as the shortest authoritative reference for arguments and examples.
