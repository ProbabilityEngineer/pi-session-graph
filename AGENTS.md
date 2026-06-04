# Agent Instructions

## Project

`pi-session-graph` is a lightweight Pi extension/application for inspecting session lineage, leaves, forks, labels, and graph views.

## Principles

- Keep prompt additions tiny; prefer slash commands and deterministic local analysis.
- Treat session lineage as a graph/forest: roots, ancestors, descendants, forks, leaves, and active leaves.
- Use explicit manifests and sidecar indexes first; do not mutate Pi session JSONLs in v1.
- Human names and lineage names are curated labels, not proof of identity.
- Preserve privacy: do not dump raw transcript content into prompts or reports.

## Turnlog

- When you attempt to use turnlog for meaningful repository work and the target repo is not initialized, initialize it rather than abandoning the record.
- Keep `.turnlog/` out of GitHub by default unless the repo explicitly opts into tracking it.
