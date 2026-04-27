---
name: Maintainer Workflow
description: Repository-specific workflow rules for maintaining APCC itself.
---

# Maintainer Workflow

## Scope

This page is for maintainers working on the APCC repository itself.

It is not part of the public usage model.

## Rules For This Repository

- use APCC in this repository
- keep `docs/public/` focused on external users of the framework
- keep repository-specific development details in `docs/internal/`
- update `.apcc/` before implementation drifts too far from the control plane
- keep generated local artifacts and private publishing credentials out of the release tree
- keep `README.md` developer-facing for GitHub and stage `assets/npm-readme.md` into published npm packages

## Change Workflow

When behavior changes:

1. update the relevant structured anchors in `.apcc/`
2. update public docs if external behavior changed
3. update internal docs if maintainer workflow or repository internals changed
4. run verification appropriate to the affected surface

## Minimum Verification

For normal control-plane or docs-site work, run:

```bash
npm run check
npm run test
npm run build
npm run dev -- site build
npm run verify:package-install
npm run verify:site-lifecycle
```

`npm run build` is the maintainer path that compiles the APCC CLI and packages the shared prebuilt docs viewer shell under `dist/site-runtime-prebuilt/`.

`npm run dev -- site build` verifies the public user-facing build command by producing a deployable read-only docs-site artifact. It must not be used as the internal shell prebuild step, and it must not stop a healthy live runtime.

Add targeted runtime smoke checks when the change affects the site runtime, docs rendering, or CLI command behavior.

## README Surfaces

APCC intentionally keeps two different package-introduction surfaces:

- `README.md`: repository-facing and maintainer-facing context for GitHub
- `assets/npm-readme.md`: consumer-facing package README for npmjs

Prepare a publishable package directory with:

```bash
npm run prepare:publish-package -- --out .tmp/apcc-publish
npm run prepare:publish-package -- --out .tmp/apcc-scoped-publish --name @rendo-studio/apcc
```

Publish from the staged directory instead of the repository root when the npm README needs to differ from the GitHub README.

## Prebuilt Docs Shell Build Chain

APCC now ships a shared prebuilt docs viewer shell instead of installing a docs runtime separately inside each project runtime root.

Current rule:

- build the shared shell from `site-runtime/`
- package the resulting artifact under `dist/site-runtime-prebuilt/`
- let `site start` reuse that shared shell while each project only contributes runtime data

`npm` remains the build-time package manager for the shell source for now.

Reason:

- the shell source already carries a `package-lock.json`
- `npm ci` gives deterministic shell builds
- switching the shell build chain to `pnpm` or `bun` would add extra bootstrap branches and cross-platform verification surface without improving the APCC user workflow
