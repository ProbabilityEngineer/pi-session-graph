---
id: psg-1o5t
status: open
deps: []
links: []
created: 2026-05-30T02:05:07Z
type: task
priority: 2
assignee: ProbabilityEngineer
tags: [architecture, refactor, extension-boundary]
---
# Split reconstruction/import logic from graph extension runtime

Refactor or spin out reconstruction, backup extraction, canonical store building, and multi-source imports from the lightweight pi-session-graph extension runtime. Keep the extension focused on commands/views over a prepared store, while heavier forensic/import scripts live in a separate package, tools directory, or companion project.

## Acceptance Criteria

A separation plan exists and initial structure is in place: lightweight extension commands do not need backup folders or heavy reconstruction dependencies; reconstruction/import scripts are clearly marked private/dev or moved to a companion module; README explains boundaries.

