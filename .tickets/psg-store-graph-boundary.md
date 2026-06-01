---
id: psg-store-graph-boundary
status: open
deps: []
links:
  - ../agent-session-store/.tickets/ass-graph-export-contract.md
  - ../agent-session-store/.tickets/ass-temporal-axis-data.md
  - ../agent-session-store/.tickets/ass-agent-effort-metrics.md
created: 2026-06-01T14:35:00Z
type: task
priority: 1
assignee: ProbabilityEngineer
---
# Define store/graph rendering boundary

Clarify that `agent-session-store` owns canonical data/projections and `pi-session-graph` owns rendering/navigation.

## Boundary

`agent-session-store` / future `pi-session-store` owns:

- provider imports and metadata normalization
- canonical SQLite/JSON exports
- lineage/continuity/compaction/fork edge derivation
- repo identity and alias facts
- temporal work bursts and agent/provider effort metrics
- graph export contracts and evidence/provenance fields

`pi-session-graph` owns:

- Pi extension commands for current-session awareness
- CLI/static HTML generation
- Mermaid/static graph rendering
- temporal and interactive viewer rendering
- filters/search/grouping/evidence panels over prepared exports

## Acceptance Criteria

- README documents the boundary.
- Temporal tickets in this repo explicitly consume prepared temporal/activity exports rather than parsing raw sessions.
- HTML viewer work reads `graph-export.json`/future graph contracts and does not duplicate store inference.
- Follow-up data-contract tickets exist in `agent-session-store`.
