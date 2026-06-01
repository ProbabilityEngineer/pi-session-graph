---
id: psg-cli-html-temporal-commands
status: closed
deps: [psg-extension-cli-split]
links:
  - psg-html-graph-viewer
  - psg-canonical-temporal-html
  - psg-temporal-compressed-time
  - psg-agent-accrued-effort-lanes
created: 2026-06-01T14:20:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Add CLI commands for HTML and temporal graph outputs

After defining the extension/CLI split, add CLI commands for large graph outputs.

## Acceptance Criteria

- Add a package `bin` command such as `pi-session-graph`.
- `pi-session-graph html` generates an interactive viewer from canonical graph exports.
- `pi-session-graph temporal` generates temporal HTML views.
- Commands accept input/output path flags.
- Commands do not depend on Pi interactive chat context.
- Existing extension behavior is preserved.


## Progress

Implemented the package `bin` entrypoint and initial `pi-session-graph html`/`pi-session-graph mermaid`/status-style commands. `pi-session-graph temporal` is intentionally blocked until `agent-session-store` exports canonical temporal activity spans and effort metrics.


## Closure

Completed CLI temporal command with --input and --output path support; existing html/mermaid/status commands remain preserved.
