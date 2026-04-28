---
name: 0.3.1 Agent Bootstrap Guidance Polish
description: Internal version note for the patch release that cleans up APCC bootstrap guidance and CLI availability handling.
---

# 0.3.1 Agent Bootstrap Guidance Polish

## Summary

This patch release removes redundant workflow-guide reread instructions from APCC's agent bootstrap assets, makes APCC CLI availability an explicit prerequisite, and keeps the canonical plus materialized guidance surfaces aligned.

## Highlights

- makes `apcc` availability an explicit first-step prerequisite in `AGENTS.md` and the canonical agents template
- treats `apcc guide workflow` as the preferred explicit workflow-reading path instead of requiring both the CLI guide and the materialized skill copy
- removes the misleading "CLI unavailable but keep going from the local skill copy" branch from the bootstrap contract
- keeps `assets/skills/apcc-workflow/SKILL.md`, `.agents/skills/apcc-workflow/SKILL.md`, `assets/agents-template.md`, and `AGENTS.md` synchronized on the same rule set
- re-verifies the packaged install path so the staged npm tarball ships the updated workflow guidance

## Breaking Changes

- none

## Migration

- development agents should ensure `apcc` is installed before invoking workflow, doctor, status, or other control-plane commands
- prefer `apcc guide workflow` as the explicit bootstrap read path in environment-agnostic instructions
- if your IDE or runtime has already injected the APCC workflow skill into context, do not reread the same workflow guide for ritual

## Validation

- `npm run check`
- `npx vitest run test/guidance.test.ts test/workflow-guide.test.ts test/bootstrap.test.ts`
- `npm run build`
- `npm run dev -- site build`
- `npm run verify:package-install`
- `npm run verify:site-lifecycle`
- `npm run dev -- doctor check`
- `npm run dev -- status`
- `npm run prepare:publish-package -- --out .tmp/apcc-publish`
- `npm run prepare:publish-package -- --out .tmp/apcc-scoped-publish --name @rendo-studio/apcc`
- `npm pack --dry-run`
- GitHub release `v0.3.1`
- npm publish `apcc@0.3.1`
- npm publish `@rendo-studio/apcc@0.3.1`
