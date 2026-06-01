---
id: psg-html-graph-viewer
status: open
deps: [psg-confidence-provider-filters]
links:
  - ../agent-session-store/.tickets/ass-graph-export-contract.md
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
- Can evolve toward generic memory/identity graph records described in `agent-memory-identity/docs/graph-viewer-requirements.md`.
- Selecting a node/edge can show details/evidence/provenance when present.
- Selected subgraphs can eventually be exported to JSON/Mermaid/Markdown.

## Boundary note

The viewer should consume the canonical graph export contract from `agent-session-store`; it should not duplicate provider import, repo identity inference, temporal burst derivation, or compaction/fork detection.
