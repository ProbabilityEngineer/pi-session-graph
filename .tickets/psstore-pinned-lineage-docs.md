---
id: psstore-pinned-lineage-docs
status: closed
deps: []
links: []
created: 2026-06-01T00:00:00Z
type: task
priority: 3
assignee: ProbabilityEngineer
tags: [docs, lineage-name, session-store]
---
# Document pinned lineage-name store behavior

Document how `pi-session-store` rebuild/export surfaces pinned session-move lineage names once `agent-session-store` imports them.

## Acceptance Criteria

- README/help mention pinned lineage names as canonical metadata imported by `/session-store rebuild`.
- Docs distinguish pinned lineage names from current Pi session display names.
- Wrapper remains a delegate and does not parse sidecars itself.
- `npm run lint` passes if applicable.
