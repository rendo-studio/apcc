---
name: Architecture
description: High-level repository structure for APCC maintainers.
---

# Architecture

## Main Areas

`src/`

- CLI entrypoint
- control-plane model
- runtime staging logic

`site-runtime/`

- local docs-site application
- console views
- runtime adapters

`assets/`

- packaged guide and other framework-owned assets

`test/`

- control-plane, bootstrap, runtime, and projection regression tests

## Structural Principle

The repository should keep these responsibilities separate:

- framework logic
- public usage documentation
- maintainer-only documentation
- generated local artifacts and private release notes

If a change blurs those boundaries, it should be treated as a design problem, not a cosmetic one.

Generated artifacts, screenshots, test output, and private publishing credentials should stay out of the active release tree.
