---
name: 0.1.2 Docs-Site Ergonomics Patch
description: Internal version note for the docs-site ergonomics patch release.
---

# 0.1.2 Docs-Site Ergonomics Patch

## Summary

This patch hardens the local docs-site experience so localized workspaces open reliably, the Console is the default landing view, and development agents handle the site lifecycle in a way that is safer for human developers.

## Highlights

- fixes localized docs-site startup when the primary docs language uses non-ASCII file names such as `概览.md`
- makes the root docs route land on the localized Console plan view instead of a shared overview document
- adds `apcc site open --port <port>` so a stable docs-site address can be reserved without editing workspace config first
- tightens workflow guidance so development agents report the docs-site URL to humans and do not stop the site unless explicitly asked

## Validation

- `npm run check`
- `npm run test`
- `npm run build`
- `npm run verify:site-lifecycle`
- `npm run verify:package-install`
- `node dist/bin/apcc.js site open --help`
