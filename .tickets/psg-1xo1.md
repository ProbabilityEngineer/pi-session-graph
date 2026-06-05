---
id: psg-1xo1
status: closed
deps: []
links: []
created: 2026-06-05T01:09:31Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [reports, timeline, labels, metrics]
---
# Use repo names in timeline reports and clarify chart metrics

Fix timeline projects/sessions reports to display canonical repo identity names or repo basenames instead of full cwd paths. Also correct project activity chart labels and make metric limitations clear where active hours are derived from available imported session metadata rather than complete external history.

## Acceptance Criteria

08/09/16/17 timeline reports use repo/project labels, not full paths; generated Gantt/area/treemap and timelines show pi-jj-git-align when aliases are approved and never use full cwd as category labels; reports include a visible caveat that imported archives may undercount historical project work when event timestamps are unavailable; build/lint and graph generation validate.

