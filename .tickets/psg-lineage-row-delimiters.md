---
id: psg-lineage-row-delimiters
status: closed
deps: []
links: []
created: 2026-06-01T14:00:00Z
type: task
priority: 2
assignee: ProbabilityEngineer
---
# Add row delimiters to lineage graph outputs

Lineage graph outputs appear to have rows/lanes but lack visible top and bottom row lines. Add row delimiters similar to the temporal timeline rows.

## Acceptance Criteria

- Lineage HTML/SVG outputs draw top and bottom delimiters for each row/lane.
- Delimiters improve readability without obscuring nodes/edges.
- Row labels align visually with delimiters.
- Style is consistent with temporal timeline row delimiters.
- Works in focused and full lineage outputs where rows/lanes are present.


## Closure

Implemented Mermaid lane/row delimiters by grouping session nodes into cwd/repo-label subgraphs. The legend now documents lane boxes, and labels are escaped before rendering. Validated with `npm run lint`.
