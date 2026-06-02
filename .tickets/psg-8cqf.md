---
id: psg-8cqf
status: closed
deps: []
links: []
created: 2026-06-02T17:39:01Z
type: task
priority: 1
assignee: ProbabilityEngineer
---
# Make pigraph default to help and release npm package

Adjust pigraph CLI so no args shows help, document CLI/npm bin path behavior, bump version, push git, and publish npm.

## Acceptance Criteria

- `pigraph` with no args shows usage/help.
- `pigraph status` remains explicit status command.
- README explains CLI commands and npm global bin path.
- Version bumped and git pushed.
- npm package published if authentication permits.

