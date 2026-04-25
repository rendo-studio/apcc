---
name: Quickstart
description: The shortest correct path to initialize and operate an APCC workspace.
---

# Quickstart

## Who This Is For

This page is for developers and development agents adopting APCC in a repository for the first time.

APCC's final user-facing form is the installed CLI. The local workspace remains editable, but the CLI is the supported entrypoint for initialization, validation, command discovery, and docs-site lifecycle commands.

## Install And Discover

Install the CLI:

```bash
npm install -g apcc
apcc --help
apcc guide
```

`apcc guide` lists the bundled public guide topics. `apcc guide workflow` is reserved for the Agent workflow guide that is also generated into `.agents/skills/apcc-workflow/SKILL.md` during initialization.

## Initialize A Repository

Use the same command for a new directory or an existing repository:

```bash
apcc init
```

If the repository's primary authored docs language should not be English, set it during initialization:

```bash
apcc init --docs-language zh-CN
```

For an existing repository, `init` is intentionally non-invasive. It creates missing APCC-managed anchors and guidance files, but it should not rewrite existing authored docs at the same path or reshape the whole repository just to match APCC's recommended docs package.

## Confirm The Core Anchors

Every APCC workspace should make two project-level anchors explicit:

- project overview: what this repository is
- end goal: the long-lived project outcome

Inspect them:

```bash
apcc project show
apcc goal show
```

Update provisional values when needed:

```bash
apcc project set --name "My Project" --summary "One-line project definition." --doc-path shared/overview.md
apcc goal set --name "Ship My Project" --description "Long-lived project outcome." --doc-path shared/goal.md
```

The default English scaffold uses `shared/overview.md` and `shared/goal.md`. A localized scaffold may use localized anchor filenames while preserving the same roles.

## Make Execution Explicit

Plans are execution streams. Tasks are concrete work items attached to plans.

Create a first plan and task:

```bash
apcc plan add --name "First stream" --parent root --summary "Main execution stream."
apcc task add --name "First task" --parent root --plan <returned-plan-id> --summary "First concrete unit of work."
```

The CLI accepts explicit ids when a caller needs stable references immediately:

```bash
apcc plan add --id first-stream --name "First stream" --parent root --summary "Main execution stream."
apcc task add --id first-task --name "First task" --parent root --plan first-stream --summary "First concrete unit of work."
```

Plan status and progress are derived from the task tree at read time. Do not store a separate `plan.status` field by hand.

## Open The Local Collaboration Surface

Start the local docs site:

```bash
apcc site open
apcc status show
```

`site open` uses the prebuilt viewer shell packaged with APCC. It does not require a user-run build step and keeps authored docs plus `.apcc` state live-refreshing for local collaboration.

For a stable local address on the first open, use:

```bash
apcc site open --port 4317
```

The root docs URL lands on the localized Console plan view. If you are opening the site on behalf of a human, tell them the returned URL and leave it running until they explicitly ask to stop it.

Use `site build` only when you want a deployable read-only docs-site artifact:

```bash
apcc site build
```

The build output is a snapshot. It does not run the live watcher and does not replace `site open`.

## Agent Operating Loop

For development agents, the safe loop is:

1. Decide whether the context is cold, warm, or possibly desynced.
2. On cold or desynced rounds, run `apcc site open`, then `apcc status show`.
3. If context is warm and trusted, keep working without rerunning the full start sequence.
4. Before a new task, plan change, decision boundary, or version boundary, update `.apcc` first.
5. Implement the smallest clear slice.
6. Run the relevant verification.
7. Mark task progress in `.apcc` or through the CLI.

This is the core reason APCC exists: the repository should always show what the project is, where it is going, and what is being worked on now.

## CLI Or Direct Workspace Edits

Use CLI commands for:

- initialization
- help discovery
- validation and repair
- docs-site runtime actions
- small targeted control-plane mutations

Use direct `.apcc/` edits for bulk plan or task restructuring once you understand the schema, then run:

```bash
apcc validate
apcc status show
```

APCC intentionally does not add batch import flags that duplicate direct workspace editing.

## What Not To Do

Do not:

- treat `docs/` as the structured truth source
- persist computed execution state by hand
- assume the recommended docs package is a runtime requirement
- expect `site open` to require `site build`
- use `site build` as the local live collaboration command
- continue implementation after a confirmed plan change without updating `.apcc` first
