---
name: 0.3.0 ACLIP Build Stage And Control-Plane Contract
description: Internal version note for the ACLIP build-stage adoption and control-plane contract release.
---

# 0.3.0 ACLIP Build Stage And Control-Plane Contract

## Summary

This minor release moves APCC's CLI artifact build onto ACLIP's standard build helper, makes the CLI runtime surface bundler-safe, and turns the direct-edit control-plane contract into a published, generated, and validated public surface.

## Highlights

- builds the shipped CLI artifact through ACLIP's standard `build(...)` helper while preserving APCC's existing Markdown-first runtime behavior and `--json` passthrough
- introduces bundler-safe package-root and version resolution for workflow guidance, packaged assets, docs-site runtime helpers, and the built CLI entrypoint
- publishes `apcc guide control-plane-contract` as the normative direct-edit contract for `.apcc/`
- generates `docs/public/control-plane-contract.md` from runtime-backed constants and keeps it pinned by test coverage
- makes `apcc doctor check` reject unsupported persisted enum and boolean values in direct-edited workspaces instead of silently depending on CLI help or normalization side effects
- verifies installed-package behavior, staged publish packages, and docs-site lifecycle behavior against the new build-stage and contract surfaces

## Breaking Changes

- none

## Migration

- if you edit `.apcc/` directly, use `apcc guide control-plane-contract` as the authoritative value-domain reference instead of guessing persisted values
- normalize any unsupported direct-edit task statuses such as `todo` to one of `pending`, `in_progress`, `done`, or `blocked`
- if you maintain APCC itself and change persisted value domains, rerun `npm run generate:control-plane-contract-doc`

## Validation

- `npm run check`
- `npm run test`
- `npm run build`
- `npm run verify:package-install`
- `npm run verify:site-lifecycle`
- `npm run dev -- guide`
- `npm run dev -- guide control-plane-contract`
- `npm run prepare:publish-package -- --out .tmp/apcc-publish`
- `npm run prepare:publish-package -- --out .tmp/apcc-scoped-publish --name @rendo-studio/apcc`
- `npm pack --dry-run`
