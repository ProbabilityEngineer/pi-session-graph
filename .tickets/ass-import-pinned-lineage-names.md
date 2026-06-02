---
id: ass-import-pinned-lineage-names
status: closed
deps: []
links: []
created: 2026-06-01T00:00:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [lineage-name, session-name, graph-export]
---
# Import pinned session-move lineage names

`agent-session-store` should import pinned lineage names from `pi-session-move` sidecars and expose them in canonical exports for status/viewer tools.

## Design

Read both legacy and namespaced lineage sidecars:

```text
~/.pi/agent/relocation-lineages.jsonl
~/.pi/agent/session-move/manifests/relocation-lineages.jsonl
```

Attach names to the matching lineage/thread/session family as metadata/labels without rewriting raw sidecars. Export enough data for `pi-session-graph` to show pinned lineage names.

## Acceptance Criteria

- build-store imports legacy and namespaced lineage-name sidecars.
- Pinned lineage names become canonical labels/metadata in SQLite and JSON exports.
- graph-export includes pinned lineage names for relevant sessions/threads.
- Raw sidecars are not mutated.
- `npm run lint`, `npm run build-store`, and `npm run export-graph` pass.
