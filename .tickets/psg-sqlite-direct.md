---
id: psg-sqlite-direct
status: closed
deps: []
links:
  - git:github.com/ProbabilityEngineer/agent-session-store
created: 2026-05-30T03:40:00Z
type: task
priority: 3
assignee: ProbabilityEngineer
---
# Optionally read canonical SQLite store directly

Evaluate reading `~/.pi/agent/session-store/session-store.sqlite` directly instead of only `curated-store.json`.

## Acceptance Criteria

- Decision documented: direct SQLite, generated graph-ready JSON, or both.
- If implemented, JSON export fallback remains available.
- TypeScript check passes.
