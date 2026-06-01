# pi-session-graph

Lightweight Pi extension for viewing prepared session lineage, logical thread, classification, and repo identity data.

`pi-session-graph` does not mutate raw session JSONLs and does not run heavy reconstruction. Heavy imports/reports live in `agent-session-store`.

## Commands

```text
/session-graph status
/session-graph lineage [--files]
/session-graph leaves [--all]
/session-graph repos
/session-graph mermaid [--all] [--min-confidence <level>] [--provider pi,codex] [--edge-type relocation]
```

Compatibility aliases remain available:

```text
/session-status
/session-lineage [--files]
/session-leaves [--all]
/session-repos
```

A CLI entrypoint is also exposed for non-chat graph/status use:

```bash
pi-session-graph status
pi-session-graph mermaid --all
pi-session-graph html
```


## Pi session suite relationship

`pi-session-graph` is the read-only graph/viewer layer in the Pi session tooling suite.

- `agent-session-store`: provider-neutral canonical store and graph export builder.
- `pi-session-store`: planned Pi-facing wrapper around store workflows.
- `pi-session-relocate`: planned/session-facing relocation and restart UX.
- `pi-session-repo-move`: planned filesystem repo move UX.
- `pi-session-graph`: extension + CLI/static viewer over prepared exports.

The preferred future slash-command style is namespaced to reduce command clutter:

```text
/session-store ...
/session-graph ...
/session-relocate ...
/session-repo ...
```

Existing top-level graph commands remain compatibility aliases for now.

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

`/session-graph mermaid` and `pi-session-graph mermaid` write timestamped Markdown and Mermaid files under the current repo:

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

## HTML viewer

```bash
pi-session-graph html
```

Or inside Pi:

```text
/session-graph html
```

The viewer reads prepared graph data, supports search and confidence/provider/edge-type filters, and writes `session-graph/session_graph_viewer_<timestamp>.html`. Temporal rendering is intentionally deferred until `agent-session-store` exports canonical temporal activity data.
