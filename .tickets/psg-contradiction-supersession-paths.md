---
id: psg-contradiction-supersession-paths
status: open
deps: [psg-generic-memory-identity-schema]
links:
  - ../../research/agent-memory-identity/docs/graph-architecture.md
created: 2026-06-01T13:45:00Z
type: feature
priority: 3
assignee: ProbabilityEngineer
---
# Render contradiction and supersession paths

Memory/identity graphs need to show when claims, preferences, or memory records contradict or supersede earlier records.

## Acceptance Criteria

- Recognize `contradicts`, `supersedes`, `obsolete`, and `contested` relations/statuses.
- Style contradiction/supersession edges distinctly.
- Provide filter/toggle for contradiction and supersession paths.
- Detail panel explains current vs obsolete/contested records when metadata is present.
