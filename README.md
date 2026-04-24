# APCC

APCC is an agent-first project context framework for software repositories.

It gives a repository a structured project context control plane so human developers and development agents can share the same project overview, end goal, execution tree, governance records, and local docs-site view without collapsing authored documentation into mutable runtime state.

## Install

Install the public CLI globally:

```bash
npm install -g apcc
apcc --help
```

The same CLI is also published as:

```bash
npm install -g @rendo-studio/apcc
apcc --help
```

For local project use without a global install:

```bash
npm install apcc
npx apcc --help
```

## Quickstart

Use the same flow for a new directory or an existing repository:

```bash
apcc guide
apcc init
apcc site open
apcc status show
```

If the repository's primary authored docs language should not be English:

```bash
apcc init --docs-language zh-CN
```

The default local docs site uses the prebuilt viewer shell packaged with APCC. Use `site build` only when you want a deployable read-only docs-site artifact:

```bash
apcc site build
```

## What APCC Provides

- `docs/` for authored context
- `.apcc/` for structured project state
- a CLI for initialization, validation, mutation, and runtime control
- a local docs site for human-readable inspection
- an agent workflow guide for consistent development behavior

## Public Guides

- [Quickstart](https://github.com/rendo-studio/apcc/blob/main/docs/public/quickstart.md)
- [CLI](https://github.com/rendo-studio/apcc/blob/main/docs/public/cli.md)
- [Workspace Model](https://github.com/rendo-studio/apcc/blob/main/docs/public/workspace-model.md)
- [Docs Package](https://github.com/rendo-studio/apcc/blob/main/docs/public/docs-package.md)
- [Docs Site](https://github.com/rendo-studio/apcc/blob/main/docs/public/docs-site.md)
- [Decisions And Versions](https://github.com/rendo-studio/apcc/blob/main/docs/public/decisions-and-versions.md)

From the installed CLI:

```bash
apcc guide
apcc guide workflow
apcc guide quickstart
```
