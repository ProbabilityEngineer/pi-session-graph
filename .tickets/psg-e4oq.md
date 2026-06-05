---
id: psg-e4oq
status: closed
deps: []
links: []
created: 2026-06-05T00:57:56Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [charts, active-hours, gantt, reports]
---
# Correct project activity charts data sources

Fix the new project Gantt, weekly area, and treemap charts to use temporalActivitySpans and activeTimeMetrics consistently with canonical repo identities. The Gantt should not depend on graph nodes only, should collapse aliases such as check-your-photos-v1 correctly, and should display short repo names rather than full paths. Weekly/treemap outputs should make their time basis clear and avoid misleading path labels.

## Acceptance Criteria

Project Gantt includes all temporal activity spans for approved aliases and shows check-your-photos-v1 with its full active history; chart row labels are canonical display names or repo basenames, not full paths; weekly area and treemap use consistent active-hour data and canonical/basename labels; build/lint and graph generation validate.

