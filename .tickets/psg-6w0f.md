---
id: psg-6w0f
status: closed
deps: []
links: []
created: 2026-06-04T23:28:36Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [repo-identity, active-hours, reports, aliases]
---
# Render canonical repo identity names and aliases

Update pi-session-graph reports to prefer repoIdentity displayName/stableName over raw cwd when enriched graph export provides canonical repo identity. Active-hours reports and timelines should show the canonical project name, with contributing paths/aliases available in drilldown and confidence/provenance visible.

## Acceptance Criteria

Active-hours and project reports display canonical repo identity names where available; aliases/contributing paths are visible in details; reports indicate manual/derived confidence where relevant; unlinked projects still fall back to cwd; renamed projects render as one project after agent-session-store aggregates by repo identity.

