---
id: psg-qq2q
status: open
deps: []
links: []
created: 2026-06-02T01:12:11Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [ux, status-bar, session-graphs]
---
# Do not leave session-graphs status bar item

`/session-graphs` currently calls `ctx.ui.setStatus("session-graphs", "building graph files")` and then leaves `"wrote graph files"` visible. In Pi this can reflow status indicators and move the LSP indicator under the text bar.

## Design

Remove the persistent status updates from `/session-graphs`, or clear the status item after completion if Pi exposes a clear API. Prefer quiet command output via the final notification only.

## Acceptance Criteria

- Running `/session-graphs` does not leave a persistent `session-graphs` status item.
- LSP/status indicators are not displaced by a lingering `wrote graph files` status.
- Command still reports written files in its normal output.
- `npm run lint` passes.

