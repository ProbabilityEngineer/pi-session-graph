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


## Notes

**2026-06-02T17:40:30Z**

Git push completed at 15fe846 (v0.1.1 metadata). npm publish attempted with --auth-type=web but failed: npm whoami is E401 and npm publish returned E404/permission for first publish of pi-session-graph. Needs npm login/web auth and possibly first-publish permissions before npm publish can complete.

**2026-06-02T17:42:00Z**

Added GitHub Actions trusted publishing workflow .github/workflows/publish.yml for tag pushes v*. Workflow uses id-token: write and npm publish --access public. Also kept npm's package.json bin normalization (removed leading ./). Validated build/lint/help/npm pack dry-run.
