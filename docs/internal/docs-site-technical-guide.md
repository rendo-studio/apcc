---
name: Docs Site Technical Guide
description: Maintainer-facing guide to the APCC docs site architecture, runtime model, packaging flow, and development loop.
---

# Docs Site Technical Guide

## What The APCC Docs Site Is

The APCC docs site is the runtime projection layer for a workspace's authored docs package and structured control plane.

It is not only a Markdown reader.

It combines:

- authored docs under the configured docs root
- structured workspace state under `.apcc/`
- APCC-generated runtime data
- a shared prebuilt viewer shell built from `site-runtime/`

The result is one surface where maintainers and Agents can read project docs, inspect current plans and tasks, review decisions and versions, and follow recent doc changes without switching tools.

## Why It Exists

The docs site exists to solve four problems at once:

1. keep authored docs and structured project state visible in one place
2. give humans and Agents the same read model for the current workspace
3. avoid making each repository install and build its own Next or Fumadocs app
4. make the same source material usable for both a local live site and a deployable read-only site build

The important product boundary is that APCC owns the projection and runtime contract, while the repository still owns its authored docs and control-plane content.

## What New Experience It Adds

Compared with a plain docs folder or a repository-local docs app, the APCC docs site adds:

- a default landing experience on the runtime Console instead of a raw file tree
- runtime-injected Console pages that summarize overview, plans, tasks, blockers, decisions, versions, and recent doc changes
- live refresh for authored doc and control-plane edits through staged runtime-data updates
- per-page revision history, preview, and diff views backed by `docs-revisions.json`
- runtime-data-driven navigation, TOC generation, and local search
- one reusable viewer shell for all APCC workspaces on the same machine
- a deployable artifact path that reuses the same viewer model instead of a separate site implementation

## Logical Design

At a high level, the site is a staged projection pipeline:

```text
workspace docs + .apcc
  -> stage content/docs
  -> inject runtime console docs
  -> generate runtime-data/*.json
  -> start or reuse shared prebuilt viewer shell
  -> render browser UI
```

The main layers are:

1. Source layer
   `docs/` holds authored documentation and `.apcc/` holds structured project state.
2. Staging layer
   `src/core/site.ts` copies the docs package into a per-site runtime root under `content/docs` and injects synthetic `console/` pages plus root navigation changes.
3. Projection layer
   APCC generates runtime JSON files that the viewer shell reads directly.
4. Viewer shell
   `site-runtime/` is a shared Next/Fumadocs application that renders the runtime data instead of loading project-specific source hooks.
5. Live update layer
   A watcher polls the source docs roots and restages runtime data so browser clients can refresh against a new runtime version.

## Core Runtime Contract

The viewer shell is driven by `runtime-data/`, not by direct filesystem reads from the source workspace at request time.

Current key files are:

- `runtime-data/control-plane.json`
  Workspace snapshot derived from `.apcc/`, including project, goal, status, plans, tasks, decisions, versions, and doc manifests.
- `runtime-data/docs-viewer.json`
  Navigation tree, rendered page payloads, extracted headings, and page metadata for the docs UI and search index.
- `runtime-data/docs-revisions.json`
  Per-document revision history used for change previews and compare views.
- `runtime-data/version.json`
  Monotonic update signal used by the live-refresh client.
- `runtime-data/runtime.json`
  Runtime metadata such as site id, source roots, mode, port, and URL.
- `runtime-data/registry.json`
  Local runtime lifecycle registry for the specific site instance.

This separation is the key design decision: authored content and control-plane state are inputs, while the docs site consumes only the staged projection.

## Core Design Points

- Runtime behavior must follow the configured docs root and explicit control-plane references. It must not depend on the default `shared/`, `public/`, or `internal/` scaffold existing.
- The Console is runtime-owned synthetic content. It is injected into the staged docs tree instead of being authored as repository docs.
- Site modes are explicit:
  `staged` means runtime data exists but no healthy live shell is attached, `live` means a local shell is running, and `build` means a deployable read-only artifact was produced.
- The runtime root lives under the per-user APCC runtime base, not under the repository workspace.
- Live docs sync is about restaging runtime data, not about hot-reloading the viewer shell source itself.
- `site build` produces a deployable artifact for consumers. It is not the maintainer shell-build step.

## Runtime Model

For a live site, `apcc site start` does the following:

1. resolve the source docs root from the workspace config or explicit path
2. compute a stable site id from the source workspace or docs root
3. create or reuse a runtime root under the APCC runtime base
4. stage docs into `content/docs`
5. inject localized Console docs and patch root navigation
6. generate runtime-data snapshots
7. ensure a runnable copy of the shared prebuilt shell exists
8. start or reuse the server process
9. start the watcher that restages runtime data after source changes

Important runtime directories and files:

```text
<runtime-root>/
  content/docs/
  runtime-data/
    control-plane.json
    docs-revisions.json
    docs-viewer.json
    version.json
    runtime.json
    registry.json
    site.log
    site-watch.log
```

Health is not based on PID existence alone.

APCC also verifies runtime identity by checking the running shell's API response against the expected site id, runtime root, and docs root.

## Viewer Shell Responsibilities

The shared viewer shell lives in `site-runtime/`.

Its responsibilities are:

- load runtime JSON from `APCC_RUNTIME_DATA_ROOT`
- render docs pages from `docs-viewer.json`
- render Console views from `control-plane.json`
- expose a runtime version API for browser refresh polling
- build localized navigation and URLs
- build local search indexes from runtime page payloads
- show revision previews and diffs from `docs-revisions.json`

Important implementation entry points:

- `site-runtime/lib/runtime-data.ts`
  runtime-data loaders and shared runtime types
- `site-runtime/lib/docs-viewer.ts`
  maps `docs-viewer.json` into Fumadocs page-tree and page objects
- `site-runtime/app/[lang]/docs/[[...slug]]/page.tsx`
  main docs and Console route renderer
- `site-runtime/app/api/apcc/version/route.ts`
  runtime version endpoint used by live refresh
- `site-runtime/app/api/search/route.ts`
  runtime-data-backed search indexing
- `site-runtime/components/site/docs-live-provider.tsx`
  browser polling, unread update markers, and reload behavior

## Packaging And Build Flow

There are two separate build concerns.

### 1. Maintainer shell build

`npm run build` is the maintainer path.

It builds:

- the APCC CLI artifact
- the shared prebuilt docs viewer shell

The shell source is built from `site-runtime/` and packaged under:

`dist/site-runtime-prebuilt/`

`src/core/site.ts` builds a shell artifact from `site-runtime/.next/standalone` plus static assets and stores it as a reusable prebuilt shell.

### 2. User-facing site build

`npm run dev -- site build` is the public site build command.

It:

- copies the packaged shell artifact
- stages docs and runtime data into the output directory
- writes deploy support files such as `start.mjs`
- produces a read-only deployable site artifact

The deployable artifact must contain:

- `server.js`
- `start.mjs`
- `runtime-data/docs-viewer.json`

It must not stop or downgrade a healthy live runtime.

## Development Workflow

Use different loops depending on what changed.

### Authored docs or `.apcc` changes

Use this when changing docs content, navigation metadata, or control-plane state:

1. keep a healthy site running with `npm run dev -- site start --port 4311`
2. edit `docs/` or `.apcc/`
3. let the watcher restage runtime data
4. confirm the browser refreshes and shows the new content

This is the fastest loop for docs-package work.

### Viewer shell or staging logic changes

Use this when changing `site-runtime/` or `src/core/site*.ts`:

1. edit the shell or staging code
2. run `npm run build` to rebuild the shared shell artifact
3. restart the live site if the shell process must pick up a new artifact
4. run `npm run dev -- site status` and re-check the rendered behavior

Authored-doc live refresh does not replace shell rebuilds.

The watcher only restages runtime data; it does not hot-reload arbitrary shell source changes.

### Deployable artifact verification

Use this when changing packaging, runtime-data structure, or deployment behavior:

1. run `npm run dev -- site build`
2. run `npm run verify:site-lifecycle`
3. run the broader maintainer verification suite when the change is non-trivial

Production-style verification belongs under `.tmp/production-smoke/`, not against the repository workspace root, unless you are explicitly testing self-migration behavior.

## Maintainer Rules To Preserve

- Leave a healthy docs site running unless a human explicitly asks to stop or clean it.
- Do not treat `site stop` as a routine end-of-task cleanup step.
- Keep internal technical truth in `docs/internal/`, not in shipped consumer workflow assets.
- Keep the docs site coupled to explicit runtime data contracts, not to incidental repository layout assumptions.
- Preserve the separation between source docs, staged docs, runtime data, and the shared shell.

## File Map

When debugging or extending the docs site, start here:

- `src/cli/groups/site.ts`
  public site command surface
- `src/core/site.ts`
  staging, runtime lifecycle, shell reuse, build output, and watcher orchestration
- `src/core/site-data.ts`
  control-plane snapshot generation
- `src/core/site-viewer-data.ts`
  docs navigation and page payload generation
- `src/core/site-watch-worker.ts`
  source polling and restaging loop
- `site-runtime/`
  prebuilt viewer shell source
- `docs/internal/prebuilt-docs-runtime.md`
  narrower runtime-model note that complements this guide

Use this page as the maintainer overview, and treat the code files above as the next drill-down layer.
