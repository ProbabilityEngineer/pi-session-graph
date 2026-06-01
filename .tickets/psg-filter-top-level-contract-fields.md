---
id: psg-filter-top-level-contract-fields
status: open
type: task
priority: 2
created: 2026-06-01T00:00:00Z
---
# Prefer top-level contract fields in graph filters/details

As store exports promote contract fields out of metadata, the viewer should prefer top-level fields for filtering and details while retaining metadata fallback.

## Acceptance Criteria

- Filters/details prefer top-level `operationType`, `tool`, `mode`, `batchId`, `sourceRepo`, `targetRepo`, `repoIdentityId`, `sourceProvider`, and `targetProvider` when present.
- Detail panel still shows metadata for optional/debug fields.
- Generic graph compatibility remains intact.
- No raw manifest parsing is added to the viewer.
