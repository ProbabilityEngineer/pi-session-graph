---
id: psg-gcnp
status: closed
deps: []
links: []
created: 2026-06-05T00:20:09Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [reports, index, active-hours]
---
# Improve report index grouping and active-hours fallback

Update report pack index.html to split generated artifacts into Reports and Archive sections, listing links by numbered filename order. Make active-hours report still useful when top-level activeTimeMetrics is absent by deriving project totals from node activeTime metadata/repo labels.

## Acceptance Criteria

index.html has separate Reports and Archive sections ordered by filename; link labels include matching file names. 04-active-hours.html lists project rows when graph.activeTimeMetrics is missing but session node metadata.activeTime exists. Build/lint and graph generation validate.

