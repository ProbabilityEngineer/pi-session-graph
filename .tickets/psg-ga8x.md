---
id: psg-ga8x
status: closed
deps: []
links: []
created: 2026-06-02T00:30:01Z
type: task
priority: 2
assignee: ProbabilityEngineer
tags: [docs, page-titles, graphs]
---
# Document graph types and page titles

Document the session graph output types clearly, including what each file shows and when to use it. Page titles should match the graph type names and include the generation timestamp.

## Design

Update README with a graph outputs table for lineage-full, lineage-focused, timeline-projects, and timeline-sessions. Explain the difference between timeline-projects and timeline-sessions. Update generated HTML page titles and visible headings to include the timestamp and graph type name, e.g. '<timestamp> — Lineage Full'.

## Acceptance Criteria

- README includes a graph output table.
- README explains lineage-full and lineage-focused.
- README explains timeline-projects vs timeline-sessions.
- Generated HTML titles/headings include timestamp and graph type.
- npm run lint passes.

