## APCC

Use APCC in this repository.

This section is the bootstrap rule set. The full operating protocol lives in the APCC Workflow Guide.

Mandatory:

1. Run `apcc guide workflow` for the APCC Workflow Guide.
2. Read `.agents/skills/apcc-workflow/SKILL.md`. It is identical to `apcc guide workflow`.
3. If this is a cold round or the workspace may be desynced, run `apcc site open`, then `apcc status show`.
4. If context is still warm and no external change is suspected, continue without rerunning the full round-start sequence.
5. When plans change, refresh the workspace before resuming code work.
6. If the project identity or long-lived end goal is unclear, clarify them before substantial implementation.
7. Treat `docs/` as authored context and `.apcc/` as the structured control plane.
8. When initializing or reinitializing APCC, prefer setting the primary docs language to match the current human conversation unless the repository already has an established docs language.
9. When a new task, plan change, or execution boundary is confirmed, update `.apcc` first and only then start implementation work.
10. For bulk plan or task restructuring, edit `.apcc/` directly, then run `apcc validate` and an explicit inspection command.
11. Use `apcc guide` to discover public APCC docs topics when command behavior or workspace semantics are unclear.
12. After `apcc site open`, tell the human the returned docs-site URL. Prefer a stable unique port on first open with `apcc site open --port <port>` or `.apcc/config/workspace.yaml`.
13. Do not run `apcc site stop` as an end-of-task ritual. Leave the docs site running unless the human explicitly asks to stop or clean it.
