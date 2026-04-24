---
name: 0.1.0 APCC Public Baseline
description: Internal version note for the first APCC-named public baseline.
---

# 0.1.0 APCC Public Baseline

## Summary

This version establishes the first public APCC baseline as a clean project context framework release.

## Highlights

- establishes APCC as a agent-first project context framework with a clean `.apcc` workspace root and public docs package
- clarifies that APCC is the framework, while the structured project context control plane is the role it gives a repository
- persists one primary docs language per workspace and scaffolds the shared docs anchors in that language
- ships the local docs site as a shared prebuilt viewer shell backed by runtime data instead of a per-project source runtime
- verifies the npm package install path so the package-manager generated `apcc` binary can initialize and validate a workspace
- makes `apcc guide` a dynamic index over bundled `docs/public` topics while reserving `apcc guide workflow` for the Agent workflow guide
- reduces plan and task mutation output to concise deltas and allows explicit plan/task ids for stable follow-up references
- makes `apcc site build` produce a deployable read-only docs-site artifact instead of acting as an internal shell build step
- makes the Console execution view plan-first, with derived plan status/progress and scoped task drilldown

## Validation

- `npm run check`
- `npm run test`
- `npm run build`
- `npm run verify:package-install`
- `npm run dev -- guide`
- `npm run dev -- guide workflow`
- `npm run dev -- validate`
- `npm run dev -- site build`
- `npm run verify:site-lifecycle`
