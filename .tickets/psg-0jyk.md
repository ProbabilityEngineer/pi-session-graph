---
id: psg-0jyk
status: closed
deps: []
links: []
created: 2026-06-02T21:30:59Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [reports, graphviz, repo-jumps, insight]
---
# Add weighted repo jump map report

Generate an operational graph where nodes are repos/projects and weighted edges show agent jumps/relocations between repos. This should reveal wandering patterns and loops more clearly than session-level lineage.

## Acceptance Criteria

- reports/ includes repo-jump-map.dot and SVG when Graphviz succeeds.
- Nodes are repo/project labels, not individual sessions.
- Directed edge weight equals number of jumps from source repo/project to target repo/project.
- Default output hides edges with weight 1; provide a documented threshold option or include an all-edges archive variant.
- Edge labels show jump counts; repeated jumps use thicker edges.
- index.html summarizes top jump pairs and links to the SVG/DOT.

