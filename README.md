# APCC

APCC is an agent-first project context framework for software repositories.

It gives a repository a structured project context control plane so human developers and development agents can share the same project overview, end goal, execution tree, governance records, and local docs-site view without collapsing authored documentation into mutable runtime state.

## What APCC Provides

- `docs/` for authored context
- `.apcc/` for structured project state
- a local docs site for human-readable inspection
- a CLI for initialization, validation, mutation, and runtime control
- an agent workflow guide for consistent development behavior

## Public Docs In This Repository

- [Quickstart](docs/public/quickstart.md) - install, initialize, and run the first APCC loop
- [CLI](docs/public/cli.md) - command groups, output contract, and CLI-vs-workspace editing
- [Workspace Model](docs/public/workspace-model.md) - `docs/` and `.apcc/` boundaries
- [Docs Package](docs/public/docs-package.md) - recommended authored docs structure
- [Docs Site](docs/public/docs-site.md) - live local site and deployable build behavior
- [Decisions And Versions](docs/public/decisions-and-versions.md) - governance records and maturity records

## Local Development

Install the released CLI:

```bash
npm install -g apcc
apcc --help
```

Install dependencies:

```bash
npm install
```

Run the CLI from source:

```bash
npm run dev -- --help
```

Build the distributable CLI:

```bash
npm run build
npm run verify:package-install
```

## Current Positioning

APCC is the product.

- Product form: project context framework
- Architectural role inside a repository: structured project context control plane

That distinction is intentional. APCC is not a hosted service and not just a generic management layer.
