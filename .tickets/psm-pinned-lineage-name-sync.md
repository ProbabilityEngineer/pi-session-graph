---
id: psm-pinned-lineage-name-sync
status: open
deps: []
links: []
created: 2026-06-01T00:00:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [lineage-name, session-name, pinning]
---
# Pin lineage names and sync current session display name

`/move-lineage --name <name>` should make the name a durable pinned lineage name and sync it to the current Pi session display name when Pi exposes the session naming API.

## Design

Treat the lineage name sidecar as the durable/pinned name for the moved session family. Treat the Pi session display name as a UI projection for the current session. Continue writing lineage records to the namespaced path and reading legacy records.

## Acceptance Criteria

- `/move-lineage --name <name>` writes a pinned lineage-name record.
- Current Pi session display name is updated when `appendSessionInfo` is available.
- `/move-status` and `/move-lineage` label the durable name as pinned lineage name.
- Legacy and namespaced lineage-name paths are both tolerated.
- `npx tsc --noEmit` passes.
