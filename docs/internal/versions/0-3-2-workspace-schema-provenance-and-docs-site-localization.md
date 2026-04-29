---
name: 0.3.2 Workspace Schema Provenance And Docs-site Localization
description: Internal version note for the patch release that unifies workspace schema provenance and completes docs-site localization behavior.
---

# 0.3.2 Workspace Schema Provenance And Docs-site Localization

## Summary

This patch release unifies APCC workspace schema naming around `workspaceSchemaVersion`, records the managing APCC CLI version explicitly through `apccVersion`, and finishes the remaining docs-site localization gaps without coupling runtime behavior to hardcoded docs-package section labels.

## Highlights

- replaces the legacy metadata `schemaVersion` name with canonical `workspaceSchemaVersion` while keeping repair-time compatibility for older workspaces
- records `apccVersion` in `.apcc/meta/workspace.yaml` so migrated or reinitialized workspaces preserve the last APCC CLI provenance explicitly
- localizes docs-package section labels through directory `meta.json.title` instead of special runtime handling for `shared`, `public`, and `internal`
- makes the injected docs-site runtime Console labels honor `docsLanguage`, including `Console`, `Overview`, and `Plans`
- regenerates the public control-plane contract and updates public docs so direct `.apcc` editors see the same schema/provenance rules that doctor validates

## Breaking Changes

- none

## Migration

- existing workspaces with `.apcc/meta/workspace.yaml.schemaVersion` should run `apcc doctor fix` to migrate to `workspaceSchemaVersion` and backfill `apccVersion`
- localize docs-site section labels through directory `meta.json.title`; do not rename `shared`, `public`, or `internal` just to change the visible navigation labels
- if a live docs-site runtime was already staged before upgrade, rerun `apcc site start` so the localized runtime Console pages are refreshed

## Validation

- `npm run check`
- `npm run test`
- `npm run build`
- `npm run verify:package-install`
- `npm run verify:site-lifecycle`
- `npm run prepare:publish-package -- --out .tmp/apcc-publish-0.3.2`
- `npm run prepare:publish-package -- --out .tmp/apcc-scoped-publish-0.3.2 --name @rendo-studio/apcc`
- `npm pack --dry-run` for the unscoped staged package
- `npm pack --dry-run` for the scoped staged package
- `npm run dev -- doctor check`
- `npm run dev -- status`
- `npm run generate:control-plane-contract-doc`
