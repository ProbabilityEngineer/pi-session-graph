---
id: psg-evidence-detail-panel
status: closed
deps: [psg-html-graph-viewer]
links:
  - ../../research/agent-memory-identity/docs/graph-viewer-requirements.md
created: 2026-06-01T13:45:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Add evidence/detail panel for selected graph records

Selecting a node or edge in the HTML viewer should show evidence and provenance details.

## Acceptance Criteria

- Detail panel shows node/edge ID, type, label, status, confidence, provenance, timestamps, and metadata.
- Shows evidence IDs/source paths/source spans/quotes where present.
- Distinguishes authoritative, manual, extractor-derived, runtime-derived, and inferred records.
- Works for session edges and future memory/identity graph records.


## Closure

Enhanced HTML graph details with structured fields for node/edge id, type, label, confidence, provenance, timestamp, provider, paths, source/destination, and metadata/evidence JSON. Edge export now includes provenance and metadata from prepared graph records.
