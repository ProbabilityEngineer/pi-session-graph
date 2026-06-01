---
id: psg-neighborhood-subgraph-explorer
status: closed
deps: [psg-html-graph-viewer]
links:
  - ../../research/agent-memory-identity/docs/graph-viewer-requirements.md
created: 2026-06-01T13:45:00Z
type: feature
priority: 3
assignee: ProbabilityEngineer
---
# Add neighborhood/subgraph explorer

Support focused N-hop graph exploration around a selected node.

## Acceptance Criteria

- User can select a node and view 1-hop/2-hop neighborhood.
- Neighborhood view preserves active filters.
- Supports source/session/claim/decision/commitment/episode-style nodes generically.
- Can export selected subgraph as JSON and Mermaid.


## Closure

Added HTML viewer 1-hop and 2-hop focus controls around selected nodes, preserving active filters, plus reset and export of the selected subgraph as JSON or Mermaid.
