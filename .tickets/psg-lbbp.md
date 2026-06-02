---
id: psg-lbbp
status: closed
deps: []
links: []
created: 2026-06-02T03:55:38Z
type: task
priority: 1
assignee: ProbabilityEngineer
tags: [build-graphs, output, data-files]
---
# Make build-graphs data artifacts opt-in

Update agent-session-store build-graphs so default output writes only HTML graph reports. JSON/MMD/MD data/debug artifacts should be written only with an explicit flag such as --include-data.

