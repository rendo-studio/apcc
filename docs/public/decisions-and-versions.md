---
name: Decisions And Versions
description: When to use decision records and when to use project-level version records.
---

# Decisions And Versions

## Decisions

Use a decision record for a high-value choice that needs to remain visible later.

Typical examples:

- a goal change
- a scope change
- an architecture shift
- a breaking-change policy change
- a versioning policy change

Do not use decisions for ordinary task progress or routine implementation notes.

Inspect command details with:

```bash
apcc decision --help
```

## Versions

Use a version record for a low-frequency, project-level milestone.

A version record is appropriate when the project has reached a new overall state that is worth preserving. That does not require an external product release. It does require a meaningful maturity boundary.

Inspect command details with:

```bash
apcc version --help
```

## Relationship

Decisions and versions solve different problems.

- decisions explain why an important direction was chosen
- versions record when the project reached a stable boundary

A version may reference supporting decisions, but it should not depend on the decision system to make sense.

## Practical Rule

When you are unsure:

- if the question is "why did we choose this direction?", record a decision
- if the question is "what state did the project reach?", record a version
- if the question is "what should I do next?", update plans and tasks instead
