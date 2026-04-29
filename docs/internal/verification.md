---
name: Verification
description: Verification expectations for changes made inside the APCC repository.
---

# Verification

## Baseline

Every non-trivial change should verify at least:

- type safety
- tests
- production build

Commands:

```bash
npm run check
npm run test
npm run build
npm run verify:package-install
npm run verify:site-lifecycle
```

Source-repo rule:

- keep production-style verification under `.tmp/production-smoke/`
- do not use a globally installed or packaged `apcc` directly against the APCC repository root unless you are intentionally testing self-migration behavior

## Site Changes

If the change affects the docs site, also verify:

```bash
npm run dev -- site build
npm run verify:site-lifecycle
```

`site build` is the public deployable docs-site build. It should produce a runnable artifact, not rebuild the internal shared shell in place.

Add `site start` smoke checks when the runtime lifecycle, docs rendering, or console views changed.

For lifecycle changes, verify the commands serially:

1. `npm run dev -- site stop`
2. `npm run dev -- site start`
3. `npm run dev -- site start`
4. `npm run dev -- site clean`

Expected result:

- the first start creates a runtime
- the second start reuses the same runtime
- stop preserves the runtime directory
- clean removes the runtime directory
- the runtime root does not install its own `node_modules`
- the runtime root does not carry its own standalone server artifact
- `site build` does not stop or downgrade a healthy live runtime
- the deployable build artifact contains `server.js`, `start.mjs`, and `runtime-data/docs-viewer.json`
- editing an authored doc updates the rendered page without restarting the shell
- repeated authored doc edits continue to advance runtime version data instead of only reacting to the first change
- stale runtime registry metadata does not force a manual clean; the next `site start` still starts a fresh healthy runtime
- current-source live runtimes do not block `npm run build` from replacing `dist/site-runtime-prebuilt/`
- current-source live runtimes may use a local shared shell cache, but installed-package runtimes still launch from packaged `dist/site-runtime-prebuilt/`

CI should also run the same verification on Windows, Linux, and macOS.

The cross-platform CI smoke check can collapse the docs-site build and lifecycle validation into one run, as long as it still proves both:

- the deployable docs-site artifact builds successfully
- the lifecycle sequence remains correct

## Package Install Changes

If the change affects `package.json`, the CLI bin entrypoint, build output, or package contents, also verify:

```bash
npm run build
npm run verify:package-install
```

The package install smoke check must:

- pack the current repository
- install the tarball into a scratch project under `.tmp/production-smoke/`
- execute the package-manager generated `apcc` binary
- initialize a scratch workspace under `.tmp/production-smoke/`
- run `apcc doctor check` and `apcc doctor fix` on that workspace
- build a deployable docs-site artifact from the installed package

This is the maintainer path for validating production-style behavior without mutating the APCC repository workspace itself.

## Control-Plane Changes

If the change affects workspace schema, bootstrap, or validation:

- inspect the generated `.apcc/` files
- inspect the generated docs package
- verify the relevant command output directly

## Public Docs Changes

If the change affects framework usage or command behavior:

- update `docs/public/`
- keep `docs/shared/` aligned with the new public truth
- do not bury public behavior changes only in internal docs
