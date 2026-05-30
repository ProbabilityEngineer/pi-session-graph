---
id: psg-store-read
status: closed
deps: []
links:
  - git:github.com/ProbabilityEngineer/agent-session-store
created: 2026-05-30T03:05:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Read canonical session store for graph views

Update `pi-session-graph` so graph commands can read the canonical store produced by `agent-session-store`.

Start with `~/.pi/agent/session-graph/curated-store.json` or `~/.pi/agent/session-store/session-store.export.json`; optionally read SQLite later. Keep `relocations.jsonl + lineage-overlays.jsonl` fallback for compatibility.

## Acceptance Criteria

- Graph build can consume canonical store sessions/edges/labels/classifications.
- Existing relocation manifest/overlay path remains a fallback.
- Output is compared against current graph output for key lineages/context jumps.
- README documents store input and fallback behavior.
- TypeScript check passes.
