---
id: psg-u7ll
status: closed
deps: []
links: []
created: 2026-05-29T20:00:22Z
type: task
priority: 1
assignee: ProbabilityEngineer
tags: [reconstruction, lineage, prefix]
---
# Add prefix-based session lineage reconstruction

Build a script that infers session lineage by exact content prefix relationships between session JSONL files, using longest-prefix matching, filesystem times, filename relocation timestamps, bucket/cwd consistency, shared session ids, and manifest records as validation.

## Acceptance Criteria

A script writes timestamped prefix-lineage JSON/MD sidecar reports under ~/.pi/agent/session-graph; it does not mutate session JSONLs or relocations.jsonl; reports best source per destination, ambiguity/forks, confidence/reasons, and manifest validation.

