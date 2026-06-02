---
id: psg-srk2
status: closed
deps: []
links: []
created: 2026-06-02T05:59:37Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [timeline, charts, echarts, graph-rendering]
---
# Add chart-library timeline renderer

Add a chart-library timeline renderer as part of the operational report pack. Timeline views should be insight-oriented rather than just inventory: global timelines are useful, but the main value is project-focused timelines linked from the report index/hotspots.

## Acceptance Criteria

- Generate self-contained HTML timeline-projects and timeline-sessions views using a chart library.
- Preserve semantic graph names and timestamped filenames/titles inside the report pack layout.
- Support lanes grouped by project/cwd and by session.
- Show session/activity spans as bars and events/work bursts/compactions as visible markers.
- Include tooltips/details for spans/events.
- Include zoom/pan over time.
- Support project-focused timelines for one repo/project at a time, linked from index/hotspots when practical.
- Avoid reviving the removed custom simplified SVG prototype.
- Keep Graphviz work scoped to lineage/repo jump node-link graphs.
