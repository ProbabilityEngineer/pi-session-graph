# pi-session-graph

Lightweight Pi extension for viewing prepared session lineage, logical thread, classification, and repo identity data.

`pi-session-graph` does not mutate raw session JSONLs and does not run heavy reconstruction. Heavy imports/reports live in `agent-session-store`.

## Commands

```text
/session-status
/session-lineage [--files]
/session-leaves [--all]
/session-repos
/session-graph [--all]
```

## Data sources

Preferred input:

```text
~/.pi/agent/session-graph/curated-store.json
```

This JSON is produced by `agent-session-store` via:

```bash
npm run build-store
npm run export-graph
```

Fallback inputs:

```text
~/.pi/agent/relocations.jsonl
~/.pi/agent/session-graph/lineage-overlays.jsonl
```

## What it displays

- session nodes and relocation/overlay edges
- current lineage, leaves, roots, and fork points
- classifications/display labels from the canonical store
- logical thread counts and membership-derived summaries
- repo identity/event records when exported by `agent-session-store`

Repo identity is read-only here. Stable repo/project identity, swap/rename/fork/archive events, and time-use reports are curated in `agent-session-store` and exported for display.

## Artifacts

`/session-graph` writes timestamped Markdown and Mermaid files under the current repo:

```text
session-graph/session_graph_<timestamp>.md
session-graph/graph_<timestamp>.mmd
```

## Install

```bash
pi install git:github.com/ProbabilityEngineer/pi-session-graph
```

Local testing:

```bash
pi -e ./index.ts
```

## Boundaries

- Does not mutate session JSONLs.
- Does not rewrite `~/.pi/agent/relocations.jsonl`.
- Does not infer repo identity from raw content.
- Does not perform backup extraction/reconstruction.

Use `agent-session-store` for canonical store rebuilds, repo identity curation, bucket reconciliation, graph exports, and reports.
