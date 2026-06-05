---
id: psg-17kp
status: closed
deps: []
links: []
created: 2026-06-05T03:16:01Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [charts, metrics, ux]
---
# Fix chart bar sizing and active-hour data source drift

Gantt/timeline bars are too short relative to row height and do not scale with zoom/row spacing. Weekly area and treemap are again showing unrealistic totals (e.g. pi-move, pi-diet-ledger) suggesting chart aggregation drifted away from activeTimeMetrics safeguards. Make bars occupy roughly 2/3 row height and ensure project charts use the deduped safeguarded activeTimeMetrics totals rather than overstating from spans.

