---
name: Progressive Disclosure And Ownership Metadata
description: APCC 0.5.0 release notes for scalable list disclosure, ownership metadata, pinned context, and lifecycle reminders.
---

# Progressive Disclosure And Ownership Metadata

APCC 0.5.0 makes large workspace inspection safer and cheaper for agents by adding owner metadata, pinned context markers, paginated list views, and stale-work reminders.

## Highlights

- Adds the owner registry at `.apcc/owners/registry.yaml` with `apcc owner list`, `owner add`, and `owner update`.
- Adds plan and task owner refs, pinned markers, pinned reasons, and lifecycle timestamps.
- Adds `--owner`, `--status`, `--limit`, `--cursor`, and `--all` filters for progressive `plan list` and `task list` disclosure.
- Keeps pinned items visible outside normal page limits so important context is not hidden by large historical trees.
- Adds `status` and `doctor check` reminders for stale work, long-blocked tasks, inactive owners assigned to open work, unowned active tasks, and completed pinned items.

## Notes

`pinned` is a context-retention marker. It is not priority, blocker state, owner state, or current focus.

Owner ids are explicit control-plane references. Use `apcc owner list` before assigning work to avoid duplicate or near-duplicate operator ids.

## Verification

The release is verified with type checks, tests, production build, package-install smoke checks, site build, and site lifecycle verification before publish.
