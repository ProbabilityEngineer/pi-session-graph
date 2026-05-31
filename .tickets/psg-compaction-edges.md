---
id: psg-compaction-edges
status: open
type: feature
priority: 2
created: 2026-05-31T20:05:00Z
---
# Render compaction lineage in session graphs

Once `agent-session-store` exports compaction/session-summary-continuation edges, the graph renderer should visualize them distinctly from relocation and inferred temporal continuity.

## Acceptance Criteria

- Recognize compaction edge types from canonical `graph-export.json`.
- Render compaction edges with distinct label/style in Mermaid/static outputs.
- Show compaction count in node details or edge/status lines when available.
- Add legend entry explaining compaction vs relocation vs inferred continuity.
- Add filters/toggles for showing or hiding compaction edges in graph outputs.
- Ensure temporal HTML views can display compaction events without cluttering repo/workstream grouping.

## Notes

Possible labels:

- `compaction`
- `summary_continuation`
- `compact x6`

Compaction should be represented as a continuity-preserving event, probably higher confidence than same-cwd temporal inference when Pi metadata explicitly records it.
