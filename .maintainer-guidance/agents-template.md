## APCC Source Repository

This repository is the APCC source repo.

The public workflow guidance shipped to consumer workspaces lives under `assets/`. Do not use that shipped guidance as the maintainer bootstrap for this repository.

Mandatory:

1. Read `docs/internal/maintainer-workflow.md` and `docs/internal/verification.md`.
2. For APCC commands against current source, use `npm run dev -- <command>`. Do not default to a globally installed `apcc`.
3. Use `npm run dev -- guide workflow` only when you are validating the shipped consumer guidance in `assets/`.
4. If the repository context is cold or possibly desynced, run `npm run dev -- site start --port 4311`, then `npm run dev -- status`.
5. Update `.apcc/` before implementation when task, plan, decision, or release boundaries change.
6. Treat `docs/internal/` as maintainer truth. Treat `assets/agents-template.md` and `assets/skills/apcc-workflow/SKILL.md` as shipped consumer guidance that must stay product-facing.
7. Run production-style verification inside `.tmp/production-smoke/`. Only point install or init style checks at this repository itself when you are explicitly testing APCC self-migration, self-init, or repair behavior.
8. Leave a healthy docs site running unless the human explicitly asks to stop or clean it.
