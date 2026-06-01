---
id: psg-session-move-path-docs
status: closed
deps: []
links: []
created: 2026-06-01T00:00:00Z
type: task
priority: 3
assignee: ProbabilityEngineer
tags: [docs, paths, graph-boundary]
---
# Document graph inputs after session-move path tidy

`pi-session-graph` should document that it consumes `agent-session-store` graph exports after the store merges legacy and namespaced session-move manifests.

## Design

Update README/data source notes after store path migration. Graph should continue to read:

```text
~/.pi/agent/session-store/graph-export.json
```

and avoid direct raw manifest parsing when graph export exists.

## Acceptance Criteria

- README says graph reads prepared store export, not raw session-move manifests.
- Notes mention store supports legacy `relocations.jsonl` and new `session-move/manifests` inputs.
- `npm run lint` passes.
