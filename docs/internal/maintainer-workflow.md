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
- do not hardcode default docs-package scaffold sections such as `shared/`, `public/`, or `internal/` into runtime or `doctor` behavior unless the control plane explicitly references them

## Source-Repo Bootstrap

The APCC source repository does not use the same bootstrap guidance that APCC ships into consumer workspaces.

Rules:

- use `npm run dev -- <command>` for APCC commands against current source
- do not default to a globally installed `apcc` when developing APCC itself
- use `npm run dev -- guide workflow` only when you are validating the shipped consumer guidance under `assets/`
- treat `docs/internal/maintainer-workflow.md` and `docs/internal/verification.md` as the maintainer-first entrypoints
- keep `assets/agents-template.md` and `assets/skills/apcc-workflow/SKILL.md` product-facing
- keep the source-repo-local `AGENTS.md` and `.agents/skills/apcc-workflow/SKILL.md` maintainer-facing

The repo-local guidance overrides live under `.maintainer-guidance/` so self-`init` or repair does not overwrite the source repository back to consumer-facing bootstrap text.

APCC-managed `AGENTS.md` instructions must stay inside:

```text
<!-- APCC:BEGIN -->
...
<!-- APCC:END -->
```

Do not expand the merge logic back to heading-based heuristics. If the markers are absent, sync may append a managed block, but it must not assume unrelated `AGENTS.md` text is safe to replace.

Workspace runtime coordination files such as mutation locks are local runtime artifacts. Keep them under the per-user APCC runtime base beside docs-site runtimes, not under `.apcc/state/`.

## Production Smoke Root

Production-style verification must run under the fixed scratch root:

```text
.tmp/production-smoke/
```

Use that root for:

- staged publish-package directories
- installed-tarball smoke workspaces
- manual checks that intentionally exercise the packaged or published CLI instead of current source

Do not point installed-package or global-CLI checks at the APCC repository root just to simulate production behavior. The only exception is explicit self-migration testing, such as validating `init`, repair, or schema upgrades against this repository's own workspace.

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

`npm run build` is the maintainer path that builds the APCC CLI artifact through ACLIP's standard build helper and packages the shared prebuilt docs viewer shell under `dist/site-runtime-prebuilt/`.

When APCC is running from current source during maintainer workflows, live docs-site runtimes should execute from a per-user shared shell cache under the local runtime base instead of holding open `dist/site-runtime-prebuilt/` directly. That keeps `npm run build` free to replace `dist/` without forcing a live-runtime shutdown.

Shared-cache rules:

- this cache exists only for current-source maintainer flows
- installed-package user flows should not depend on it
- keep the current shell plus any shell roots still referenced by live runtime registries
- prune unreferenced older `shared-shells/shell-*` directories so the local runtime base stays bounded
- if an older current-source live runtime still points at packaged `dist/site-runtime-prebuilt/`, the next `site start` may recycle it onto the shared cache automatically

`npm run dev -- site build` verifies the public user-facing build command by producing a deployable read-only docs-site artifact. It must not be used as the internal shell prebuild step, and it must not stop a healthy live runtime.

Add targeted runtime smoke checks when the change affects the site runtime, docs rendering, or CLI command behavior.

When the control-plane contract or persisted value domains change, regenerate the published contract guide with:

```bash
npm run generate:control-plane-contract-doc
```

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

Source-repo maintainer exception:

- current-source `npm run dev -- site start` may first mirror the packaged shell into the local runtime base shared cache before launching it
- installed-package user flows should continue to run directly from the packaged `dist/site-runtime-prebuilt/` artifact
- current-source shared-cache cleanup should only remove unreferenced old shell copies; it must not change the packaged artifact consumed by installed users

`npm` remains the build-time package manager for the shell source for now.

Reason:

- the shell source already carries a `package-lock.json`
- `npm ci` gives deterministic shell builds
- switching the shell build chain to `pnpm` or `bun` would add extra bootstrap branches and cross-platform verification surface without improving the APCC user workflow
