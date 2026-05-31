---
id: psg-html-graph-viewer
status: open
deps: [psg-confidence-provider-filters]
links: []
created: 2026-05-31T16:45:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Add interactive HTML graph viewer for large session graphs

Mermaid is useful for small/component graphs, but full session/provider/repo graphs are too large. Build an HTML viewer that reads the canonical graph export and supports interactive filtering.

## Acceptance Criteria

- Generate a self-contained or local-file HTML viewer from `graph-export.json`/`curated-store.json`.
- Supports filtering by confidence, provider, edge type, repo identity, and current component.
- Supports search by title/cwd/session id/provider session id.
- Supports grouping/collapse by provider, repo identity, logical thread, and work burst where data exists.
- Shows a visible legend and edge confidence/provenance details.
- Keeps Markdown/Mermaid generation for small static exports.
- Does not require adding custom HTML generation to every graph command; prefer one viewer over graph-export.json with selectable modes.
