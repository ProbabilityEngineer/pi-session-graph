---
id: psg-gwlb
status: closed
deps: []
links: []
created: 2026-06-03T03:40:05Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [pi-session-graph, graph-export, metrics, sqlite]
---
# Consume enriched graph export metrics in pi-session-graph

Update pi-session-graph to read enriched graph-export.json fields produced by agent-session-store's SQLite/event indexing work, including sessionRows, timestampedRows, arrivalRow, departureRow, visitRows, activeMinutes, workBlockCount, metric confidence/provenance, leaf metadata, and branch fanout counts. Keep compatibility with older exports where metrics are absent.

## Acceptance Criteria

pi-session-graph parses enriched metric fields without breaking older graph exports; report rendering handles missing metrics gracefully; no raw transcript content is required or displayed; metric names are clear and not confused with indexed file line counts.

