---
name: CLI
description: The public command surface and the intended role of each command group.
---

# CLI

## Design Principle

The CLI is the public command surface for APCC. It is not the only valid way to edit an APCC workspace.

Use the CLI where safety, discovery, validation, and runtime control matter. Use direct `.apcc/` edits when bulk structured changes are clearer and cheaper.

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
- `validate`
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
- `AGENTS.md` APCC instructions
- `.agents/skills/apcc-workflow/SKILL.md`

`validate` checks the workspace:

```bash
apcc validate
apcc validate --repair
```

Use `--repair` when managed APCC files are missing or stale. It is a repair command, not a required every-round ritual.

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
apcc plan show
apcc plan update --id <plan-id> --summary "Updated summary."
```

`task` manages concrete work items attached to plans:

```bash
apcc task add --name "Document first-hour loop" --parent root --plan <plan-id> --summary "Write the public first-hour loop."
apcc task update --id <task-id> --status in_progress
apcc task list
```

Important behavior:

- `plan add` and `task add` accept optional explicit `--id` values
- single-node mutations return concise deltas, not the full tree
- full context is available through `plan show`, `task list`, and `status show`
- plan status and progress are derived from tasks at read time
- the id `root` is reserved as the CLI parent marker

For bulk plan or task restructuring, edit `.apcc/plans/current.yaml` and `.apcc/tasks/current.yaml` directly, then run:

```bash
apcc validate
apcc status show
```

APCC intentionally does not duplicate direct workspace editing with batch CLI import flags.

## Status, Decisions, And Versions

`status` renders the derived project status snapshot:

```bash
apcc status show
```

Use `decision` for high-value direction changes such as architecture, scope, goal, or breaking-change policy.

Use `version` for low-frequency project-level maturity records. A version record can mark an internal framework baseline; it does not have to correspond to a public product launch.

## Site

`site` controls the docs-site lifecycle:

```bash
apcc site open
apcc site open --port 4317
apcc site list
apcc site stop
apcc site clean
apcc site build
```

`site open` starts or reuses the local live docs site. It uses the APCC-packaged prebuilt viewer shell automatically, keeps runtime data refreshed from the configured docs root plus `.apcc`, and lands the root docs URL on the localized Console plan view.

Use `--port` when you want a stable local address for the current open without editing workspace config. Use `.apcc/config/workspace.yaml` `docsSite.preferredPort` when the workspace should keep a stable default port.

`site build` creates a deployable read-only docs-site artifact. It does not prepare `site open`, does not replace the live watcher, and must not stop a healthy live runtime.

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
