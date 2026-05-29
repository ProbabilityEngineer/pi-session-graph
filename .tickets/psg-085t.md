---
id: psg-085t
status: closed
deps: []
links: []
created: 2026-05-29T23:27:05Z
type: task
priority: 2
assignee: ProbabilityEngineer
---
# Build temporal lineage report

Add a private/dev script that models relocation events as time-indexed source-session states and writes temporal-lineage sidecar artifacts.

## Acceptance Criteria

npm run temporal-lineage writes temporal-lineage.md/json/mmd under ~/.pi/agent/session-graph without transcript content; lint passes.

