## APCC

Use APCC in this repository.

This section is the bootstrap rule set. The full operating protocol lives in the APCC Workflow Guide.

Mandatory:

1. Verify `apcc` is available. If it is not, install it first with `npm install -g apcc`, then confirm with `apcc --help`.
2. Read the APCC Workflow Guide through `apcc guide workflow`. This is the preferred path because it does not depend on IDE skill discovery behavior. If the same workflow guide is already in context through your IDE skill system, do not reread the duplicate copy.
3. If this is a cold round or the workspace may be desynced, run `apcc site start`, then `apcc status`.
4. If context is still warm and no external change is suspected, continue without rerunning the full round-start sequence.
5. When plans change, refresh the workspace before resuming code work.
6. If the project identity or long-lived end goal is unclear, clarify them before substantial implementation.
7. Treat `docs/` as authored context and `.apcc/` as the structured control plane.
8. When initializing or reinitializing APCC, prefer setting the primary docs language to match the current human conversation unless the repository already has an established docs language.
9. When a new task, plan change, or execution boundary is confirmed, update `.apcc` first and only then start implementation work.
10. For targeted task or plan mutations, prefer CLI commands such as `apcc task update --parent/--plan` or `apcc plan update --parent` instead of hand-editing a single node in YAML.
11. For bulk plan or task restructuring, edit `.apcc/` directly against `apcc guide control-plane-contract`, replace fields structurally instead of appending duplicate keys, then run `apcc doctor check` and an explicit inspection command.
12. Use `apcc guide` to discover public APCC docs topics when command behavior or workspace semantics are unclear.
13. After `apcc site start`, tell the human the returned docs-site URL. Prefer a stable unique port on first start with `apcc site start --port <port>` or `.apcc/config/workspace.yaml`.
14. Do not run `apcc site stop` as an end-of-task ritual. Leave the docs site running unless the human explicitly asks to stop or clean it.