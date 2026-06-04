---
id: psg-btu4
status: closed
deps: []
links: []
created: 2026-06-03T03:40:19Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [pi-session-graph, providers, confidence, interactive]
---
# Expose provider and confidence filters for enriched graph data

Extend pi-session-graph interactive reports to filter and explain multi-provider enriched data from agent-session-store, including provider, metric confidence, timestamp coverage, repo identity confidence, and duplicate/equivalence status. Make it clear which metrics are Pi-only vs cross-provider.

## Acceptance Criteria

Interactive reports can filter by provider and confidence fields; low-confidence metrics and ambiguous repo/session identities are visible; multi-provider data does not silently merge without provenance; older exports still render.

