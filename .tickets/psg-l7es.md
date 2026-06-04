---
id: psg-l7es
status: closed
deps: []
links: []
created: 2026-06-03T03:40:10Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [pi-session-graph, visit-rows, lineage, metrics]
---
# Render visit row and movement metrics on lineage graphs

Use enriched movement/visit metrics from graph-export.json to label or tooltip movement edges and session boxes with arrivalRow, departureRow, visitRows, timestamp coverage, and confidence. Avoid using snapshot lineCount/current lines as a progress metric.

## Acceptance Criteria

Meaningful lineage graph can show visitRows where confidence is sufficient; low-confidence or missing row metrics are hidden or flagged; labels distinguish visit rows from total session rows; existing movement/branch labeling remains intact.

