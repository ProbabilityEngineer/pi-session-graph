---
id: psg-r216
status: closed
deps: []
links: []
created: 2026-06-05T00:42:27Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [reports, visualization, gantt, treemap, activity]
---
# Add project activity visualizations

Add canonical project-centric visualizations to the report pack: a project gantt/activity timeline, a weekly stacked-area style summary, and an overall project allocation treemap. Use canonical repo identity names when available, aggregate aliases/contributing paths, and derive effort from activeTime metrics with sensible fallbacks from session metadata when needed.

## Acceptance Criteria

Report pack includes 13-project-gantt.html, 14-weekly-project-area.html, and 15-project-treemap.html (or equivalent numbered outputs). Visuals prefer canonical repo identity labels, expose active hours and contributing paths, and remain useful when top-level activeTimeMetrics are absent. Build/lint and graph generation validate.

