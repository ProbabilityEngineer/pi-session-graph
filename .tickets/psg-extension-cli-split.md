---
id: psg-extension-cli-split
status: closed
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

Move toward one namespaced command with subcommands, while keeping legacy aliases for compatibility:

```text
/session-graph status
/session-graph lineage [--files]
/session-graph leaves [--all]
/session-graph repos
/session-graph mermaid [--all|--component]
```

Compatibility aliases may remain temporarily:

```text
/session-status
/session-lineage
/session-leaves
/session-repos
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
- New docs prefer one top-level `/session-graph ...` namespace.
- Existing Pi extension commands remain available as compatibility aliases during migration.
- CLI can read the same canonical graph export paths as the extension.
- Large HTML/temporal outputs are generated through CLI/static commands rather than slash-command chat output.

## Boundary note

The CLI/static app surface belongs here for rendering and navigation. Data preparation and heavy inference remain in `agent-session-store` / future `pi-session-store`.


## Closure

Implemented initial split: `/session-graph` now acts as a namespaced command while compatibility aliases remain; package exposes a `pi-session-graph` CLI entrypoint backed by shared graph/status functions. Larger HTML/temporal commands remain follow-up work.
