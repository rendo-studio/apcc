# APCC

APCC is an agent-first project context framework for software repositories.

It gives a repository a structured project context control plane so human developers and development agents can share the same project overview, end goal, execution tree, governance records, and local docs-site view without collapsing authored documentation into mutable runtime state.

## Repository Role

This repository is the source of truth for:

- the installed `apcc` CLI
- the shared prebuilt docs viewer shell
- the public docs package
- the regression suite used to validate packaging, docs-site lifecycle, and workspace behavior

The npm package is consumer-facing. The GitHub repository is maintainer-facing.

## Public Package

Install the published CLI:

```bash
npm install -g apcc
apcc --help
```

Or install it locally in another project:

```bash
npm install apcc
npx apcc --help
```

The consumer-facing npm README is staged from `assets/npm-readme.md` during publish preparation so npmjs can stay focused on package usage.

## Local Development

Install dependencies:

```bash
npm install
```

Run the CLI from source:

```bash
npm run dev -- --help
```

Run the main verification loop:

```bash
npm run check
npm run test
npm run build
npm run verify:package-install
npm run verify:site-lifecycle
```

## Repository Layout

- `src/`: CLI and control-plane implementation
- `site-runtime/`: shared prebuilt docs viewer shell source
- `docs/public/`: external usage docs
- `docs/internal/`: maintainer-only documentation
- `assets/`: packaged workflow guidance and npm publish assets
- `.apcc/`: this repository's own APCC control plane

## Release Surface

GitHub and npm deliberately serve different audiences:

- `README.md`: repository and maintainer context for GitHub
- `assets/npm-readme.md`: consumer-facing package README for npmjs

Prepare a publishable package directory with the npm README:

```bash
npm run prepare:publish-package -- --out .tmp/apcc-publish
npm run prepare:publish-package -- --out .tmp/apcc-scoped-publish --name @rendo-studio/apcc
```

## Public Guides

- [Quickstart](docs/public/quickstart.md)
- [CLI](docs/public/cli.md)
- [Workspace Model](docs/public/workspace-model.md)
- [Docs Package](docs/public/docs-package.md)
- [Docs Site](docs/public/docs-site.md)
- [Decisions And Versions](docs/public/decisions-and-versions.md)
