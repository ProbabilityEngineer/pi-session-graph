---
id: psg-k8w0
status: open
deps: []
links: []
created: 2026-06-01T23:46:33Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [lineage-name, status, session-name]
---
# Show pinned lineage name in session status

`/session-status` should show the current session display name and the durable pinned lineage name so users can verify continuity after session moves. The pinned lineage name should be treated as distinct from, but normally synced to, the Pi session display name.

## Design

Read lineage-name sidecars from both legacy and namespaced locations, or consume the canonical store export once available. Status output should include current session display name when available and pinned lineage name when found for the current session/lineage. Keep labels privacy-preserving; do not dump transcript content.

## Acceptance Criteria

- `/session-status` includes current session/display name when available.
- `/session-status` includes pinned lineage name when available.
- Output distinguishes session display name from pinned lineage name.
- Reads/tolerates legacy `~/.pi/agent/relocation-lineages.jsonl` and namespaced `~/.pi/agent/session-move/manifests/relocation-lineages.jsonl`, or equivalent store export fields.
- `npm run lint` passes.

