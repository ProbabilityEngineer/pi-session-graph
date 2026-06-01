---
id: psg-7e5z
status: closed
deps: []
links: []
created: 2026-06-02T00:29:47Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [graphs, html, naming]
---
# Generate four clearly named session graph views

Replace poorly named temporal graph outputs with four clearly named graph views: lineage-full, lineage-focused, timeline-projects, and timeline-sessions.

## Design

Generate these HTML outputs on every /session-graphs or pigraph graphs run: <timestamp>-lineage-full.html, <timestamp>-lineage-focused.html, <timestamp>-timeline-projects.html, and <timestamp>-timeline-sessions.html. Preserve the verified meanings from the original generator: lineage-full corresponds to old temporal-lineage; lineage-focused corresponds to old temporal-lineage-focused; timeline-projects is timeline grouped by project/folder; timeline-sessions is timeline grouped by individual session file.

## Acceptance Criteria

- Generates <timestamp>-lineage-full.html.
- Generates <timestamp>-lineage-focused.html.
- Generates <timestamp>-timeline-projects.html.
- Generates <timestamp>-timeline-sessions.html.
- Page titles include timestamp and match the graph type names.
- npm run lint passes.

