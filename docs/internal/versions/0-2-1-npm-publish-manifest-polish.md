---
name: 0.2.1 npm Publish Manifest Polish
description: Internal version note for the npm publish warning cleanup patch.
---

# 0.2.1 npm Publish Manifest Polish

## Summary

This patch removes the remaining npm publish warning by normalizing the packaged `bin` entry without changing the public APCC CLI behavior.

## Highlights

- normalizes the packaged `bin` path from `./dist/bin/apcc.js` to `dist/bin/apcc.js`
- keeps the installed `apcc` command name and runtime behavior unchanged
- re-verifies package install, docs-site lifecycle, and staged publish flows against the warning-free manifest

## Breaking Changes

- none

## Migration

- none

## Validation

- `npm run check`
- `npm run test`
- `npm run build`
- `npm run verify:package-install`
- `npm run verify:site-lifecycle`
- `npm run prepare:publish-package -- --out .tmp/apcc-publish`
- `npm run prepare:publish-package -- --out .tmp/apcc-scoped-publish --name @rendo-studio/apcc`
- `npm publish --dry-run`
- `npm publish --dry-run --access public`
