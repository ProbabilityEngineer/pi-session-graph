---
id: psg-store-compare
status: open
deps: [psg-store-read]
links:
  - git:github.com/ProbabilityEngineer/agent-session-store
created: 2026-05-30T03:05:00Z
type: task
priority: 2
assignee: ProbabilityEngineer
---
# Compare graph output from store vs legacy inputs

Add a verification path or manual documented process comparing store-backed graph output with legacy `relocations.jsonl + lineage-overlays.jsonl` output.

## Acceptance Criteria

- Key expected edges are present in store-backed output.
- Context-jump/new-lineage classification is visible or preserved.
- Backup-derived labels are preserved.
- Differences are documented before switching defaults.
- TypeScript check passes.
