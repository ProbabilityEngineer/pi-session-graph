---
id: psg-qqdc
status: open
deps: []
links: []
created: 2026-06-05T01:15:36Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [charts, metrics, confidence, active-hours]
---
# Show metric coverage and uncertainty in project charts

Update project Gantt, weekly area, treemap, and active-hours reports to surface active-time coverage/confidence from agent-session-store. Charts should visually distinguish complete, partial, undercount-risk, and overcount-risk project totals instead of presenting all active-hour totals as equally reliable.

## Acceptance Criteria

Project visualizations display coverage/confidence indicators; tooltips/details include undercount/overcount warnings from graph export; suspicious/incomplete projects are visually marked; reports explain that totals are timestamp-backed estimates, not lifetime effort; works with enriched store fields after active-time metric fixes.

