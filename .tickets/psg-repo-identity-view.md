---
id: psg-repo-identity-view
status: closed
deps: []
links:
  - git:github.com/ProbabilityEngineer/agent-session-store#ass-repo-identity-model
created: 2026-05-31T05:30:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Display repo identity and relationship data from canonical store

Once `agent-session-store` exports repo identity/relationship records, show them in graph/status outputs without making `pi-session-graph` responsible for heavy reconstruction.

## Acceptance Criteria

- Read repo identity/event data from `curated-store.json` when present.
- Display stable repo/project labels separately from cwd/path labels.
- Show repo events such as rename/move/swap/fork/archive in graph-ready summaries.
- Keep extension lightweight; no raw transcript mutation or heavy forensic inference.
