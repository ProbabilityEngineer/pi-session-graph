---
id: psg-ggpn
status: open
deps: []
links: []
created: 2026-05-30T02:04:34Z
type: task
priority: 1
assignee: ProbabilityEngineer
tags: [store, reconstruction, backups]
---
# Build curated store from current sidecars

Implement a script that builds a canonical curated store from relocations.jsonl, lineage-overlays.jsonl, pre-manifest-lineage.json, prefix-lineage.json, live Pi session JSONLs, and extracted backup evidence. The store should preserve backup-derived session labels, classifications/context-jump notes, backup presence/absence windows, manual copy/edit evidence, and provenance so backup directories can eventually be removed.

## Acceptance Criteria

Running the script writes a single canonical store under ~/.pi/agent/session-graph/ with labels, edges, evidence, backup observations, classifications, aliases, and source provenance; graph generation can read it; current generated graphs remain reproducible without rescanning backup folders.

