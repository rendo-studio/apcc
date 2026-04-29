---
name: apcc-workflow
description: Repository-specific maintainer workflow for developing APCC itself.
---

# APCC Maintainer Workflow

This skill applies only to the APCC source repository.

Use it instead of the shipped consumer workflow guidance when maintaining APCC itself.

1. Read `docs/internal/maintainer-workflow.md` and `docs/internal/verification.md`.
2. Use `npm run dev -- <command>` for APCC commands against current source. Do not default to a globally installed `apcc`.
3. Use `npm run dev -- guide workflow` only when you are validating the shipped consumer guidance in `assets/`.
4. If context is cold or possibly desynced, run:

```bash
npm run dev -- site start --port 4311
npm run dev -- status
```

5. Update `.apcc/` before implementation when task, plan, decision, or release boundaries change.
6. Treat `docs/internal/` as maintainer truth. Keep `assets/agents-template.md` and `assets/skills/apcc-workflow/SKILL.md` product-facing for external workspaces.
7. Run production-style verification inside `.tmp/production-smoke/`. Do not point installed-package or global-CLI checks at this repository unless you are intentionally testing self-migration, self-init, or repair behavior.
8. Leave a healthy docs site running unless the human explicitly asks to stop or clean it.
