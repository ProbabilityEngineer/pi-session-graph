---
id: psg-a88d
status: closed
deps: []
links: []
created: 2026-06-02T21:31:07Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [reports, hotspots, false-starts, insight]
---
# Add hotspots and false-start reports

Generate ranked report pages that answer what the user should notice: busiest repos/projects, most jumps in/out, restart friction, abandoned short sessions, and repeated starts in the same repo within a time window.

## Acceptance Criteria

- reports/ includes hotspots.html with top repos/projects by session count, line/activity count, jump-in count, jump-out count, and restart count.
- reports/ includes false-starts.html or a section listing short leaf sessions under configurable N lines.
- Detect repeated starts in the same repo/project within configurable X hours.
- Identify abandoned sessions as short sessions with no descendants unless connected meaningfully.
- Pages include concise definitions of metrics and no raw transcript content.
- index.html shows summary cards for the most important hotspots/anomalies.

