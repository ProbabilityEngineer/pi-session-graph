---
id: psg-ymfr
status: closed
deps: []
links: []
created: 2026-06-02T21:30:51Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [archive, graphviz, lineage]
---
# Add full archive graph artifacts

Keep complete session graph artifacts for preservation/archaeology while making them clearly non-primary UX. Archive graphs should answer what actually happened and whether complete history can be reconstructed, even if they are too large for daily reading.

## Acceptance Criteria

- Report pack archive/ includes full-session-graph.dot and SVG when Graphviz succeeds.
- archive/ includes full-session-graph-with-starts.dot and SVG when Graphviz succeeds.
- archive/ includes raw-graph-data.json or equivalent metadata-only graph export snapshot.
- Default full-session-graph omits artificial start nodes and encodes start time in session labels.
- with-starts variant preserves forensic start/state structure for archaeology.
- index.html/README.md clearly label archive artifacts as preservation, not primary insight views.

