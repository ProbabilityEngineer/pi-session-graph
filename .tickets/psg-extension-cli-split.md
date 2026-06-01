---
id: psg-extension-cli-split
status: open
deps: []
links: []
created: 2026-06-01T14:20:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Split pi-session-graph into extension commands and CLI/static viewer

`pi-session-graph` should remain useful as a Pi extension for current-session awareness, but large graph generation/viewing should not be limited to slash commands.

## Proposed split

### Pi extension surface

Keep lightweight in-Pi commands:

```text
/session-status
/session-lineage [--files]
/session-leaves [--all]
/session-repos
/session-graph [--all|--component]
```

Purpose:

- current session awareness
- small component graphs
- quick lineage/leaves/forks checks
- handoff/restart context

### CLI/static app surface

Add executable commands such as:

```text
pi-session-graph html
pi-session-graph temporal
pi-session-graph export
pi-session-graph serve
```

Purpose:

- full interactive graph viewer
- canonical multi-provider temporal graph
- compressed-time timeline
- accrued agent/provider effort views
- evidence/detail panels
- filters/search/grouping
- selected subgraph exports

## Boundaries

- Data generation/reconstruction remains in `agent-session-store` / future `pi-session-store`.
- `pi-session-graph` reads prepared graph exports and renders/navigates them.
- The extension should not load huge graphs into prompts or require chat output for large HTML viewers.

## Acceptance Criteria

- README documents extension vs CLI/static responsibilities.
- Package exposes a `bin` entry for CLI use.
- Existing Pi extension commands remain available.
- CLI can read the same canonical graph export paths as the extension.
- Large HTML/temporal outputs are generated through CLI/static commands rather than slash-command chat output.

## Boundary note

The CLI/static app surface belongs here for rendering and navigation. Data preparation and heavy inference remain in `agent-session-store` / future `pi-session-store`.
