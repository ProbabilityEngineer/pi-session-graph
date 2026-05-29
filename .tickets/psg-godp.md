---
id: psg-godp
status: open
deps: []
links: []
created: 2026-05-29T20:00:26Z
type: task
priority: 2
assignee: ProbabilityEngineer
tags: [segments, forensics, lineage]
---
# Refine segment index evidence filtering

Improve segment index output to clearly separate forensic transcript evidence from authoritative/usable lineage signals, avoid overclaiming usable edges, and cross-reference prefix-lineage results once available.

## Acceptance Criteria

segments.md/json labels transcript-derived edges as forensic unless backed by manifest/prefix evidence; self/truncated/missing destination candidates are suppressed; README/HOWTO explains limitations.

