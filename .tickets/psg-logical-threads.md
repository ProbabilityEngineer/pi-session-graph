---
id: psg-logical-threads
status: open
deps: []
links:
  - git:github.com/ProbabilityEngineer/agent-session-store
created: 2026-05-30T03:40:00Z
type: feature
priority: 3
assignee: ProbabilityEngineer
---
# Render logical threads from canonical store

Once agent-session-store supports logical threads, add graph/report views that render derived logical threads without merging raw sessions.

## Acceptance Criteria

- Graph can show logical thread members and forks from store export.
- Raw session-file graph remains available.
- README documents thread view vs raw session view.
- TypeScript check passes.
