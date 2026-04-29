---
name: 0.3.4 Docs-site Runtime And Control-plane Hardening
description: Internal version note for the patch release that hardens docs-site runtime behavior, control-plane version scoping, and maintainer guidance boundaries.
---

# 0.3.4 Docs-site Runtime And Control-plane Hardening

## Summary

This patch release hardens the APCC docs-site runtime and control-plane edges, keeps source-repo maintainer workflows separate from shipped workspace guidance, and records version-scoped historical planning so the workspace history is easier for humans and Agents to follow.

## Highlights

- hardens docs-site runtime identity checks and decouples runtime behavior from default docs-package scaffold assumptions
- improves prebuilt docs-site markdown fidelity so authored tables and code blocks render with the expected structure
- separates maintainer bootstrap guidance from shipped workspace guidance and bounds APCC-managed `AGENTS.md` content to explicit markers
- adds workspace mutation locking, atomic control-plane writes, and plan-level version anchors with version-scoped `plan show` and `task list` filtering
- documents the docs-site internals and functional requirements while keeping current-source live runtimes from blocking `npm run build`

## Breaking Changes

- none

## Migration

- maintainers should continue using `npm run dev -- <command>` in the APCC source repository; current-source live docs-site runtimes may use a per-user shared shell cache, while installed-package user flows still run from the packaged shell artifact
- use `apcc plan show --version <version>` and `apcc task list --version <version>` when you need to inspect release-scoped historical work instead of scanning the entire queue
- APCC-managed `AGENTS.md` content must remain bounded by `<!-- APCC:BEGIN -->` and `<!-- APCC:END -->`

## Validation

- `npm run check`
- `npm run test`
- `npm run build`
- `npm run dev -- site build`
- `npm run verify:package-install`
- `npm run verify:site-lifecycle`
- `npm run prepare:publish-package -- --out .tmp/apcc-publish-0.3.4`
- `npm run prepare:publish-package -- --out .tmp/apcc-scoped-publish-0.3.4 --name @rendo-studio/apcc`
- `npm pack --dry-run` for the unscoped staged package
- `npm pack --dry-run` for the scoped staged package
- `npm run dev -- doctor check`
- `npm run dev -- status`
- GitHub release `v0.3.4`
- `npm publish` for `apcc@0.3.4`
- `npm publish` for `@rendo-studio/apcc@0.3.4`
