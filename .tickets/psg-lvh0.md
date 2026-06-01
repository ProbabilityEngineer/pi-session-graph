---
id: psg-lvh0
status: closed
deps: []
links: []
created: 2026-06-02T00:29:54Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [renderer, mermaid, html, svg, canvas]
---
# Replace Mermaid lineage rendering for large graphs

Mermaid is no longer viable for main lineage graphs because full graphs hit the Mermaid maximum text size limit. Use generated HTML with SVG/canvas instead for lineage-full and lineage-focused.

## Design

Avoid Mermaid as the primary renderer for lineage-full and lineage-focused. Implement or adapt a self-contained HTML/SVG/canvas renderer that renders useful visible content by default without requiring initial button clicks. It should scale better for large graphs and include basic pan/zoom or readable layout. Mermaid exports can be removed or treated as non-primary only if needed later.

## Acceptance Criteria

- lineage-full does not depend on Mermaid to render the main graph.
- lineage-focused does not depend on Mermaid to render the main graph.
- Generated pages show useful content immediately on open.
- Large graph rendering avoids Mermaid maximum text size failures.
- npm run lint passes.

