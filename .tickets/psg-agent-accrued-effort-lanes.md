---
id: psg-agent-accrued-effort-lanes
status: open
deps: [psg-canonical-temporal-html]
links:
  - ../agent-session-store/.tickets/ass-agent-effort-metrics.md
created: 2026-06-01T14:00:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Show accrued agent effort across repos in temporal views

Temporal session views currently emphasize how long a repo/worktree lane has been open. They should also show how much activity an agent/provider/session lineage accrued across repos.

## Acceptance Criteria

- Temporal canonical view can group or overlay activity by agent/provider/session lineage across repo lanes.
- Shows an accrued activity metric such as session count, turn count, message count, token count, duration, or evidence-derived activity score depending on available data.
- Activity metrics are visibly distinct from wall-clock repo-open duration.
- Hover/detail shows per-repo and cross-repo totals for the selected agent/provider/lineage.
- Works with Pi sessions first; degrades gracefully for providers with sparse metadata.
- Legend explains the difference between wall-clock span and accrued activity.

## Boundary note

Effort/activity metrics should be computed/exported by `agent-session-store`. This ticket renders those metrics across repo lanes and explains them in the viewer.
