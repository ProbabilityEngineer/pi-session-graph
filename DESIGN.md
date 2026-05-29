# pi-session-graph design

`pi-session-graph` inspects Pi session lineage without changing how Pi writes or reads sessions.

## Goals

- Show current session lineage, roots, leaves, forks, and graph views.
- Consume explicit relocation records from `~/.pi/agent/relocations.jsonl`.
- Support human-curated names for session branches/lineages later.
- Keep runtime prompt additions minimal or zero.
- Avoid mutating session JSONLs in v1.

## Non-goals

- No persistent mind or introspection system.
- No transcript ingestion into prompts.
- No direct session JSONL mutation in v1.
- No replacement for `pi-relocate`; it copies sessions and records edges.

## V1 commands

- `/session-lineage` — show current session ancestry chain.
- `/session-leaves` — show known graph leaves.
- `/session-graph` — show compact graph; `--mermaid` emits Mermaid.
- `/session-status` — current session ID, lineage depth, leaf/fork status.

## Data sources

- `~/.pi/agent/relocations.jsonl` — explicit/inferred relocation edges.
- `~/.pi/agent/sessions/**` — session files for fingerprinting/indexing only.
- Future: `~/.pi/agent/session-graph/labels.jsonl` for human names and notes.

## Session identity

Use stable derived IDs, not filenames alone:

- full path hash
- first entry hash
- first N lines hash
- filename timestamp/UUID when present
- line count and size as auxiliary metadata

## Future private reconstruction

A non-runtime script may scan historical session files to reconstruct pre-manifest edges. It should emit compact JSON/Markdown/Mermaid reports and avoid raw transcript dumps.
