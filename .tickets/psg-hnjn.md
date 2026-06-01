---
id: psg-hnjn
status: closed
deps: []
links: []
created: 2026-05-29T16:55:13Z
type: task
priority: 2
assignee: ProbabilityEngineer
---
# Rename CLI binary to pigraph

Use the shorter `pigraph` command name for the standalone pi-session-graph CLI.

## Acceptance Criteria

- Package `bin` exposes `pigraph`.
- CLI entrypoint file is named for `pigraph`.
- README examples use `pigraph`.
- Usage text uses `pigraph`.

## Closure

Renamed `bin/pi-session-graph.ts` to `bin/pigraph.ts`, changed package `bin` to expose `pigraph`, updated README CLI examples, and updated CLI usage text. Validated with `npm run lint` and `npx tsx bin/pigraph.ts status`.
