---
id: psg-f56z
status: closed
deps: []
links: []
created: 2026-06-05T04:40:19Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [charts, ux, tooltip]
---
# Detect hovered stacked area for tooltip foregrounding

Weekly Project Area tooltip foregrounding does not work because axis tooltip events do not reliably expose the hovered series. Determine the active project from mouse coordinates within the stacked area and use that to highlight the matching tooltip row.

