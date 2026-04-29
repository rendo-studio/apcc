---
name: 0.3.3 Invalid YAML Recovery And Direct-edit Guidance Hardening
description: Internal version note for the patch release that makes malformed `.apcc` YAML failures file-aware and tightens direct-edit workflow guidance.
---

# 0.3.3 Invalid YAML Recovery And Direct-edit Guidance Hardening

## Summary

This patch release makes malformed `.apcc` YAML failures file-aware and actionable, pushes operators toward doctor-first recovery before retrying other APCC commands, and sharpens the workflow guidance around when to use CLI mutations versus direct control-plane edits.

## Highlights

- wraps YAML parser failures with file-path context so APCC points directly at the broken `.apcc` file
- surfaces malformed workspace YAML as a dedicated doctor failure instead of collapsing into generic schema noise
- makes docs-site runtime commands tell operators to fix the file and rerun `apcc doctor check` before retrying
- tightens the canonical workflow guide, agents template, and generated control-plane contract so targeted single-node task or plan moves prefer CLI commands
- adds regression coverage for duplicate-key task YAML and validates the new recovery messages end to end

## Breaking Changes

- none

## Migration

- if `apcc site start`, `apcc site build`, or `apcc site status` reports a YAML parse error, fix the named `.apcc` file first and rerun `apcc doctor check`
- for single-node moves, prefer `apcc task update --parent/--plan` and `apcc plan update --parent` over hand-editing YAML
- if you edit `.apcc` directly, replace fields structurally instead of appending duplicate keys under one YAML mapping

## Validation

- `npm run check`
- `npm run test`
- `npm run build`
- `npm run verify:package-install`
- `npm run verify:site-lifecycle`
- `npm run prepare:publish-package -- --out .tmp/apcc-publish-0.3.3`
- `npm run prepare:publish-package -- --out .tmp/apcc-scoped-publish-0.3.3 --name @rendo-studio/apcc`
- `npm pack --dry-run` for the unscoped staged package
- `npm pack --dry-run` for the scoped staged package
- `npm run dev -- doctor check`
- `npm run dev -- status`
- GitHub release `v0.3.3`
- npm publish `apcc@0.3.3`
- npm publish `@rendo-studio/apcc@0.3.3`
