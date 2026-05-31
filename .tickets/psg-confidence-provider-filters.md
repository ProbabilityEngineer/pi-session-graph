---
id: psg-confidence-provider-filters
status: open
deps: []
links: []
created: 2026-05-31T16:30:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Add confidence/provider/edge-type graph filters

Add static graph filtering options before building an interactive HTML viewer.

## Acceptance Criteria

- `/session-graph` supports `--min-confidence authoritative|high|medium|low`.
- Supports provider include filters such as `--provider pi,codex,oh-my-pi`.
- Supports edge type filters such as `--edge-type relocation,same_cwd_temporal`.
- Generated Markdown/Mermaid output records active filters in the legend/header.
- Low-confidence cross-provider links can be hidden without changing the canonical store.
- Document that slider/check-box UI is future HTML viewer work, not part of this ticket.
