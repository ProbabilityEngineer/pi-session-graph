---
id: psg-eh6b
status: open
deps: []
links: []
created: 2026-05-30T02:04:22Z
type: task
priority: 1
assignee: ProbabilityEngineer
tags: [store, design, imports, lineage]
---
# Design canonical session lineage store

Design a resilient canonical store for reconstructed session lineage and evidence, with Pi session imports first and future support for oh-my-pi, Codex, Claude, OpenCode, Factory, and other agent transcript sources. Define source identity, session identity, event identity, labels, evidence, classifications, backup observations, and graph projections. Decide SQLite vs JSONL/JSON export shape and privacy constraints.

## Acceptance Criteria

A design document exists describing schema/tables or record types, trust model, import model, source adapters, export formats, and migration path from lineage-overlays/pre-manifest/prefix sidecars without mutating raw session files or relocations.jsonl.

