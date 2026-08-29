# Agent Instructions

## Project

`pi-session-graph` is a lightweight Pi extension/application for inspecting session lineage, leaves, forks, labels, and graph views.

## Principles

- Keep prompt additions tiny; prefer slash commands and deterministic local analysis.
- Treat session lineage as a graph/forest: roots, ancestors, descendants, forks, leaves, and active leaves.
- Use explicit manifests and sidecar indexes first; do not mutate Pi session JSONLs in v1.
- Human names and lineage names are curated labels, not proof of identity.
- Preserve privacy: do not dump raw transcript content into prompts or reports.

## VCS

- Use jj for local content changes; do not use Git staged-index workflows.
- Treat a dirty working copy as pre-existing user work unless explicitly asked to continue it.
- Before publishing, verify `@` is empty, `@-` is the completed change, `main`, `main@git`, and `main@origin` point to `@-`, and Git HEAD is attached to `main`.
- If `jj new --no-edit` leaves `@` on completed work, switch to the empty child before moving a bookmark.
- Prefer `/jj-align-push [branch]` for publishing after the working copy is empty.

## Turnlog

- Record meaningful repository work in turnlog; initialize it rather than abandoning a record when it is missing.
- Keep `.turnlog/` out of GitHub unless this repository explicitly opts into tracking it.
