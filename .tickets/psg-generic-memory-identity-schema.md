---
id: psg-generic-memory-identity-schema
status: closed
deps: [psg-html-graph-viewer]
links:
  - ../../research/agent-memory-identity/docs/graph-architecture.md
  - ../../research/agent-memory-identity/docs/graph-viewer-requirements.md
created: 2026-06-01T13:45:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Support generic memory/identity graph schema

Extend the viewer/data model so it can render graph records beyond session nodes and lineage edges, based on the Agent Memory Identity graph architecture.

## Acceptance Criteria

- Viewer can load nodes/edges with generic `type`, `status`, `confidence`, `provenance`, `scope`, and metadata fields.
- Session graph fields remain supported and backward compatible.
- Node and edge type filters work for generic records.
- Unknown node/edge types render with safe default labels/styles.
- Link to evidence records or evidence references when present.


## Closure

Added generic node/edge input support for graph exports with `nodes` and generic `edges`, preserving session graph compatibility. Generic records support type/kind, status, confidence, provenance, scope, timestamps, metadata, and evidence references. HTML viewer now filters by node type, edge type, provenance, status, and evidence presence, with safe defaults for unknown node/edge types.
