---
id: psg-srk2
status: open
deps: []
links: []
created: 2026-06-02T05:59:37Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [timeline, charts, echarts, graph-rendering]
---
# Add chart-library timeline renderer

Replace or supplement hand-rolled timeline SVG renderers for timeline-projects and timeline-sessions with a chart library, likely Apache ECharts first. Graphviz remains for lineage/node-link graphs, not timelines.

Rationale:
- Timelines need a real time axis with proportional spacing, lanes/rows, bars/spans, event dots, zoom/pan, tooltips, and legends.
- Graphviz is not a good fit for timelines because it optimizes graph layout rather than chronological chart layout.
- ECharts is likely the best first choice for polished generated HTML quickly; D3 remains the max-control option; Observable Plot is simpler but less flexible for custom interactions; Vega/Vega-Lite is reproducible/declarative but awkward for custom move curves.

Acceptance:
- Generate self-contained HTML timeline-projects and timeline-sessions views using a chart library.
- Preserve semantic graph names and timestamped filenames/titles.
- Support lanes grouped by project/cwd and by session.
- Show session/activity spans as bars and events/work bursts/compactions as visible markers.
- Include tooltips/details for spans/events.
- Include zoom/pan over time.
- Avoid reviving the removed custom simplified SVG prototype.
- Keep Graphviz work scoped to lineage-full/lineage-focused node-link graphs.

