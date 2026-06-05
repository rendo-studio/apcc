---
name: 0.4.0 Context Recovery And Site Cleanup Semantics
description: Internal version note for the minor release that standardizes inspection commands, improves task detail visibility, and adds all-workspace docs-site cache cleanup.
---

# 0.4.0 Context Recovery And Site Cleanup Semantics

## Summary

This minor release tightens APCC's agent-facing context recovery loop and standardizes the CLI inspection surface so humans and development agents use one command vocabulary when reading project state.

It also adds an explicit `apcc site clean --all` reset path for APCC-managed docs-site runtime cache across workspaces, including old runtime roots for projects that no longer exist.

## Highlights

- standardizes plan inspection on `apcc plan list` and removes the old `apcc plan show` compatibility surface
- adds `apcc task show <id>` for focused single-task detail reads
- adds `apcc task list --plan <plan-id>` and `apcc task list --details` so agents can inspect plan-scoped work without reading `.apcc` directly
- makes normal task list output include `planRef` so task-to-plan context stays visible in compact CLI reads
- hardens shipped AGENTS and workflow guidance so agents read the smallest relevant authored `docs/` context when `apcc status` is insufficient after context loss
- adds `apcc site clean --all` to clear APCC-managed docs-site runtime cache and shared shell cache without deleting project `.apcc/`, authored `docs/`, or deployable `site build` output

## Breaking Changes

- `apcc plan show` is removed. Use `apcc plan list` for the canonical plan tree listing command.

## Migration

- Update scripts, prompts, or agent playbooks that call `apcc plan show` to call `apcc plan list`.
- Use `apcc task show <id>` for focused task detail and `apcc task list --details` only when a broader detailed tree is useful.
- Treat `apcc site clean --all` as an explicit local cache reset only; do not use it as routine end-of-task cleanup.

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
- `npm run dev -- plan list --version 0.4.0`
- `npm run dev -- task list --version 0.4.0`
- `npm run dev -- task show publish-apcc-0-4-0`
- `npm run prepare:publish-package -- --out .tmp/apcc-publish-0.4.0`
- `npm run prepare:publish-package -- --out .tmp/apcc-scoped-publish-0.4.0 --name @rendo-studio/apcc`
- `npm pack --dry-run` for the unscoped staged package
- `npm pack --dry-run` for the scoped staged package
- GitHub release `v0.4.0`
- `npm publish` for `apcc@0.4.0`
- `npm publish` for `@rendo-studio/apcc@0.4.0`
