---
id: psg-jfqu
status: open
deps: []
links: []
created: 2026-05-29T22:07:14Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [labels, aliases, renames, lineage]
---
# Add curated labels and cwd aliases

Add a sidecar label/alias system for pi-session-graph so reports can distinguish session node identity from historical cwd labels and curated canonical project names. This should handle repo/folder renames such as pi-jj-vcs later becoming pi-jj-git-align without changing pi-relocate or mutating session JSONLs.

## Acceptance Criteria

pi-session-graph reads a sidecar labels JSONL file under ~/.pi/agent/session-graph; supports cwd aliases and lineage labels; reports display session identity plus historical cwd and curated label/alias where available; README documents that cwd/repo names are labels, not durable identity.

