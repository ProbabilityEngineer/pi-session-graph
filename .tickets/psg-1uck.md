---
id: psg-1uck
status: open
deps: []
links: []
created: 2026-06-02T02:37:48Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [graphviz, dot, svg, lineage, large-graphs]
---
# Add Graphviz DOT/SVG lineage renderer

Mermaid has good graph layout quality but fails on large session lineage graphs. Add a Graphviz-based renderer that writes DOT, SVG, and simple HTML wrappers for larger lineage data sets.

## Design

Generate Graphviz `.dot` files from the same lineage data used by the old Mermaid reports. Render DOT to SVG with Graphviz when available. Use `dot` for directed/focused lineage DAGs and optionally support `sfdp`/`neato` for huge whole-graph overviews. Wrap SVG in a simple white-background HTML page with legend and pan/zoom if useful. If Graphviz is missing, still write DOT and print an install hint such as `brew install graphviz`.

## Acceptance Criteria

- Command writes `.dot`, `.svg`, and `.html` for focused lineage.
- Command writes `.dot`, `.svg`, and `.html` for full/whole lineage.
- Focused/default layout uses Graphviz `dot` and resembles old Mermaid flowchart semantics.
- Huge/whole layout can use `sfdp` or `neato` when selected.
- No Mermaid dependency for Graphviz-rendered outputs.
- Missing Graphviz produces a clear warning and keeps DOT output.
- `npm run lint` passes.
- Smoke test generates readable SVG/HTML on current data.

