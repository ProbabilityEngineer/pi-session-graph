---
id: psg-9z27
status: closed
deps: []
links: []
created: 2026-06-02T03:01:02Z
type: task
priority: 1
assignee: ProbabilityEngineer
tags: [cleanup, svg, graphs]
---
# Remove experimental temporal lineage SVG generator

Remove `scripts/build-temporal-lineage-svg.ts` and the `temporal-lineage-svg` npm/CLI command because it does not match the desired Mermaid-like graph layout and has been superseded by the planned Graphviz DOT/SVG renderer.

