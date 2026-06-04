---
id: psg-z95p
status: closed
deps: []
links: []
created: 2026-06-03T03:39:59Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [pi-session-graph, active-hours, reports, metrics]
---
# Render active-hours project reports in pi-session-graph

After agent-session-store exports active-time metrics, update pi-session-graph reports to show top projects by active hours, active hours by agent/lineage, active-hours timelines, and project drilldowns. Replace misleading standalone span/compaction heuristics with active-time metrics and clear confidence/coverage notes.

## Acceptance Criteria

Report pack includes active-hours overview and project/agent drilldowns; labels distinguish active hours from calendar span; confidence/coverage warnings are visible; reports degrade gracefully when metrics are absent; no raw transcript content is shown.

