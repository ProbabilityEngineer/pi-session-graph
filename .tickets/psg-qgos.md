---
id: psg-qgos
status: closed
deps: []
links: []
created: 2026-06-03T03:40:15Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [pi-session-graph, active-hours, reports]
---
# Add active-hours reports to session graph report pack

Add pi-session-graph report pages that visualize activeMinutes/activeHours exported by agent-session-store: top projects by active hours, active hours by agent/lineage, active hours over time, and project drilldowns. Replace span/compaction-based standalone heuristics with active-time metrics and confidence notes.

## Acceptance Criteria

Report pack includes active-hours overview and drilldowns when metrics exist; reports distinguish active time from calendar span; confidence/timestamp coverage is visible; reports degrade gracefully when active-time metrics are absent.

