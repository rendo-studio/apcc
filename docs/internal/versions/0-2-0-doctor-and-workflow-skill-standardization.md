---
name: 0.2.0 Doctor And Workflow Skill Standardization
description: Internal version note for the first post-0.1.2 minor release.
---

# 0.2.0 Doctor And Workflow Skill Standardization

## Summary

This minor release standardizes APCC's workspace diagnostics on ACLIP doctor surfaces, turns the workflow guide into a canonical skill package source, and rolls up the current docs-site and scaffold ergonomics work into the next publishable package boundary.

## Highlights

- replaces `apcc validate` with `apcc doctor check` and `apcc doctor fix`
- simplifies doctor default Markdown output and removes the legacy validation mirror from doctor JSON payloads
- canonicalizes the workflow skill source at `assets/skills/apcc-workflow/SKILL.md`
- registers the workflow skill through ACLIP CLI skill hooks while keeping `apcc guide workflow` and `apcc init` aligned to the same source
- uses `meta.json` instead of `.gitkeep` for scaffolded docs package placeholders and reading-order metadata
- keeps the localized docs-site root, `site start`, and live runtime behavior aligned with the current public command surface

## Breaking Changes

- `apcc validate` no longer exists; use `apcc doctor check` and `apcc doctor fix`
- `apcc site open` no longer exists; use `apcc site start`

## Migration

- update any automation or docs that still call `apcc validate`
- update any automation or docs that still call `apcc site open`
- if you reference the workflow guide source directly, switch to `assets/skills/apcc-workflow/SKILL.md`

## Validation

- `npm run check`
- `npm run test`
- `npm run build`
- `npm run verify:package-install`
- `npm run verify:site-lifecycle`
- `npm run prepare:publish-package -- --out .tmp/publish-stage`
- `npm pack --dry-run`
