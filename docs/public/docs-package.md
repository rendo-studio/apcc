---
name: Docs Package
description: The recommended authored docs profile and the boundary between recommendation and runtime dependency.
---

# Docs Package

## Recommended Minimum

APCC recommends this minimal authored docs package:

```text
docs/
  meta.json
  shared/
    meta.json
    overview.md
    goal.md
  public/
    meta.json
  internal/
    meta.json
```

This is a recommendation and the default scaffold profile, not a runtime requirement.

If the repository's primary docs language is not English, the shared anchor filenames may be localized while preserving the same structural roles.
Directory display labels can also be localized through `meta.json.title` without renaming the structural directories themselves.

## Section Roles

`shared/`

- stable project anchors
- what the project is
- where the project is going
- content referenced by `.apcc/project/overview.yaml` and `.apcc/goals/end.yaml`
- `shared/meta.json` can make the shared-anchor reading order explicit, usually `overview` before `goal`
- `shared/meta.json.title` can localize the visible section label in the docs-site navigation

`public/`

- external-facing usage docs
- material another developer needs to adopt and operate the project or framework
- source material for public `apcc guide` topics when bundled with APCC itself
- `public/meta.json` can start as a minimal directory metadata file and later grow into the navigation-order file for public docs
- `public/meta.json.title` controls the visible docs-site label for the public section

`internal/`

- maintainer-facing docs
- repository-specific verification rules
- implementation notes
- release and packaging details
- `internal/meta.json` can start as a minimal directory metadata file and later grow into the navigation-order file for internal docs
- `internal/meta.json.title` controls the visible docs-site label for the internal section

`docs/meta.json`

- top-level docs-site navigation order
- a reading-experience hint, not a business-meaning contract

`docs/shared/meta.json`

- shared-section navigation order
- a reading-experience hint, not a business-meaning contract

`docs/public/meta.json` and `docs/internal/meta.json`

- directory-presence placeholders that are also future navigation-order files
- preferred over `.gitkeep` in the scaffold because they already match the docs-site metadata model

## `docs/public` And `apcc guide`

In the APCC package itself, `docs/public/*.md` is bundled into the CLI.

Guide topic names are derived from file names:

```text
docs/public/quickstart.md -> apcc guide quickstart
docs/public/docs-site.md  -> apcc guide docs-site
```

Only `workflow` is special. It is reserved for the Agent workflow guide stored in the canonical skill package at `assets/skills/apcc-workflow/SKILL.md` and generated into `.agents/skills/apcc-workflow/SKILL.md`.

This keeps public docs extensible: adding, removing, or renaming a public Markdown file changes the guide topic list without requiring command-code changes.

## Authorship Boundary

Use `docs/` for explanation. Use `.apcc/` for current structured state.

Good authored docs answer questions such as:

- why the project exists
- how the workflow should be used
- what constraints matter
- how to verify a release

They should not duplicate volatile task status, derived progress, or runtime registry state.

## Existing Repositories

Existing repositories do not need to force-migrate into this exact tree.

APCC relies on explicit references such as `docPath`, plus `.apcc/config/workspace.yaml` for the configured docs root. A repository can use a different docs shape if the important authored anchors are referenced explicitly.

## What To Avoid

Do not assume:

- `docs/` must always be the docs root
- a specific subdirectory name implies framework meaning
- the docs site should infer versions or decisions from hardcoded path conventions
- public docs can rely on internal maintainer pages to explain core behavior
