---
id: psg-9cky
status: open
deps: []
links: []
created: 2026-08-30T16:20:37Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [dependencies, session-store, release]
---
# Use published agent-session-store dependency

Replace pi-session-graph’s pinned GitHub v0.1.8 backend dependency with the published npm agent-session-store package so Pi’s shared npm root can deduplicate it instead of installing a second backend.

## Acceptance Criteria

package.json and lockfile require agent-session-store ^0.1.11; clean install resolves one compatible backend; build/lint pass; release is published.

