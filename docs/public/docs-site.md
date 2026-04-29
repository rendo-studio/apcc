---
name: Docs Site
description: How the local docs site works and what it is expected to show.
---

# Docs Site

## Purpose

The docs site is the default local collaboration surface for APCC.

It exists so a human can inspect:

- the authored docs package
- the current control-plane state
- the live console views derived from `.apcc/`

The Console is plan-first: it shows the current plan tree with derived plan status and progress, and each plan expands into the task tree attached to that plan.

The canonical Console execution view is `/console/plans`. Older `/console/tasks` links redirect there for compatibility.

The bare site root and `/docs` should both land on the localized Console Overview page, not a shared overview doc.

## Runtime Commands

Start the local site:

```bash
apcc site start
```

Inspect the current runtime state for one workspace:

```bash
apcc site status
```

Start the local site on an explicit stable port:

```bash
apcc site start --port 4317
```

Start a different project's docs runtime without changing directories:

```bash
apcc site start --path D:/project/example
```

List the currently running docs runtimes:

```bash
apcc site list
```

Stop the runtime without deleting it:

```bash
apcc site stop
```

Stop a different project's runtime explicitly:

```bash
apcc site stop --path D:/project/example
```

Stop every active runtime in one shot:

```bash
apcc site stop --all
```

Build a deployable docs-site artifact:

```bash
apcc site build
```

Build to a custom output directory:

```bash
apcc site build --out ./public-docs-site
```

Remove the staged runtime:

```bash
apcc site clean
```

Clean a different project's runtime explicitly:

```bash
apcc site clean --path D:/project/example
```

## Lifecycle Expectations

APCC treats the local docs site runtime as a managed local service backed by a shared prebuilt viewer shell.

Expected behavior:

- `apcc site start` starts the live runtime if it is not running yet
- a second `apcc site start` reuses the healthy runtime instead of restarting it
- `apcc site status` reports whether the targeted runtime is `absent`, `staged`, or `live`
- the bare site root and `/docs` should land on `/<docsLanguage>/docs/console`
- `apcc site start --port <port>` should honor that port or fail clearly if another healthy runtime is already using a different port for the same workspace
- `apcc site list` shows the healthy runtimes APCC currently sees as active
- `apcc site build` creates a deployable read-only site artifact and does not stop a healthy live runtime
- `apcc site stop` stops the local runtime but preserves the staged runtime for a faster next start
- `apcc site stop --all` stops every active runtime without deleting their staged runtime roots
- `apcc site clean` stops the runtime and removes the staged runtime so the next start is cold
- if a previous runtime died uncleanly or the machine shut down, the next `apcc site start` should recover by starting a fresh healthy runtime instead of requiring a manual cleanup first

The lifecycle commands should not mutate a healthy running runtime just to decide whether it can be reused.

When a development agent opens the site for a human, it should explicitly tell the human the returned URL and leave the runtime running unless the human asks to stop it.

APCC does not currently expose `site clean --all`.

That is intentional. Bulk stop is a safe operational shortcut; bulk clean is destructive enough that it should remain explicit per target.

The user-facing local runtime states are:

- `absent`: no staged runtime currently exists for the targeted workspace
- `live`: a running local docs site with automatic refresh enabled
- `staged`: runtime data is present but no live site process is running

`apcc site build` is separate. It creates a read-only deployable site artifact rather than a local runtime state.

## Runtime Model

`apcc site start` does not require a user-run build step and does not build a per-project docs app.

Instead, APCC:

- stages the current docs package and control-plane view into runtime data
- starts a shared prebuilt viewer shell that ships with APCC
- points that shell at the current project's runtime data
- refreshes the browser when runtime data changes

This keeps local docs changes live without requiring each project to install and build its own docs runtime dependencies.

When authored docs or `.apcc` state change, the local site should refresh itself automatically. A human should not need to manually reload the browser just to see the updated page.

`apcc site build` is separate from the live runtime. It copies the packaged viewer shell and embeds a snapshot of the current docs package plus derived `.apcc` console data into an output directory. The default workspace output is:

```text
dist/apcc-site
```

The generated artifact can be run with:

```bash
cd dist/apcc-site
node start.mjs
```

Expected top-level build output includes:

- `server.js`
- `start.mjs`
- `runtime-data/`
- `content/docs/`
- `README.md`

The build artifact is read-only. It does not run the live watcher and does not require access to the source workspace after it has been built.

Use the build artifact for deployment or sharing a snapshot. Use `site start` for local live collaboration.

## Source Path

The docs site reads from the configured docs package root in:

`.apcc/config/workspace.yaml`

Relevant fields:

- `docsLanguage`
- `docsSite.sourcePath`
- `docsSite.preferredPort`

`docsSite.preferredPort` is the stable workspace default. `apcc site start --port <port>` is a per-start override.

Within the docs package itself, `meta.json` files can be used to make navigation order explicit. The default scaffold includes `docs/meta.json` for top-level ordering, `docs/shared/meta.json` for the shared anchor page order, and minimal `docs/public/meta.json` plus `docs/internal/meta.json` directory metadata that can later grow into directory-order files.

Directory labels in the docs-site navigation come from the docs package metadata itself. If a directory-level `meta.json` provides `title`, the docs site uses that visible label instead of deriving one from the directory name. This is the preferred way to localize section labels such as `shared`, `public`, and `internal` without changing the structural directory names.

The docs site uses the workspace `docsLanguage` value as its default locale when opening `/docs` without an explicit language prefix.

## What The Site Should Not Depend On

The docs site should not depend on:

- a fixed `docs/` root if the workspace config points somewhere else
- hardcoded `project/changes` style conventions
- implicit version or decision directories

It should render authored docs from the configured package root and structured runtime state from `.apcc`.
