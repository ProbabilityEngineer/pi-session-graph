---
id: psg-7d9h
status: closed
deps: []
links: []
created: 2026-06-02T21:31:16Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [reports, graphviz, lineage, insight]
---
# Add meaningful lineage forest report

Generate a focused lineage graph that hides inventory noise and emphasizes meaningful chains. This report should omit isolated sessions, artificial start nodes, and zero-line dead ends unless they connect real sessions.

## Acceptance Criteria

- reports/ includes lineage-forest.dot and SVG when Graphviz succeeds.
- Hide isolated sessions by default.
- Hide artificial start nodes by default.
- Hide zero-line sessions unless they connect two meaningful sessions.
- Collapse boring linear chains where safe, or visually de-emphasize intermediate low-information nodes.
- Preserve enough labels/tooltips to trace original session paths.
- index.html explains filtering/collapse criteria and links to archive full graph for complete history.

