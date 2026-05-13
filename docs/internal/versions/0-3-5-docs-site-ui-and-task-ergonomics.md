---
name: 0.3.5 Docs-site UI And Task Ergonomics
description: Internal version note for the patch release that refactors the docs-site UI, restores Fumadocs route fidelity, and adds task-add status ergonomics.
---

# 0.3.5 Docs-site UI And Task Ergonomics

## Summary

This patch release refactors the APCC prebuilt docs-site UI around a localized home overview, a sidebar-driven Console workspace, and richer docs-reading chrome while preserving the runtime-data and live-refresh contracts.

It also restores Fumadocs-standard route and markdown behavior for explicit `index` pages and package-manager code tabs, and lets `apcc task add` accept an optional initial status.

## Highlights

- adds the localized APCC home overview as the docs-site landing surface for the bare root and `/docs`
- rebuilds Console overview and subpages around a sidebar-driven control-plane workspace
- restores explicit `index` route handling and Fumadocs-style markdown rendering for package-manager code tabs
- adds `apcc task add --status` so agents can create tasks directly in `pending`, `in_progress`, `done`, or `blocked` states
- hardens source-repo docs-site work with Fumadocs preread guidance and shared shell build locking

## Breaking Changes

- none

## Migration

- existing docs-site users should expect the root URL and `/docs` to land on the APCC home overview instead of the Console
- use `/<docsLanguage>/docs/console` for the Console entrypoint
- agents may now pass `--status` to `apcc task add` when a new task should start outside `pending`

## Validation

- `npm run generate:control-plane-contract-doc`
- `npm run check`
- `npm run test`
- `npm run build`
- `npm run dev -- site build`
- `npm run verify:package-install`
- `npm run verify:site-lifecycle`
- `npm run dev -- doctor check`
- `npm run dev -- status`
- `npm run dev -- plan show --version 0.3.5`
- `npm run dev -- task list --version 0.3.5`
- `agent-browser` smoke check for `/docs`, `/en/docs/console`, and an explicit Fumadocs `/index` route
- `npm run prepare:publish-package -- --out .tmp/apcc-publish-0.3.5`
- `npm run prepare:publish-package -- --out .tmp/apcc-scoped-publish-0.3.5 --name @rendo-studio/apcc`
- `npm pack --dry-run` for the unscoped staged package
- `npm pack --dry-run` for the scoped staged package
- GitHub release `v0.3.5`
- `npm publish` for `apcc@0.3.5`
- `npm publish` for `@rendo-studio/apcc@0.3.5`
