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
/session-graph html
/session-graph temporal [--output path]
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
pigraph status
pigraph mermaid --all
pigraph mermaid --operation-type repo_move --tool pi-repo-move
pigraph html
pigraph temporal [--input ~/.pi/agent/session-store/graph-export.json] [--output temporal.html]
```


## Pi session suite relationship

`pi-session-graph` is the read-only graph/viewer layer in the Pi session tooling suite.

- `agent-session-store`: provider-neutral canonical store and graph export builder.
- `pi-session-store`: planned Pi-facing wrapper around store workflows.
- `pi-session-move`: session-facing move and restart UX.
- `pi-repo-move`: filesystem repo move UX (`/repo-move <target>`).
- `pi-session-graph`: extension + CLI/static viewer over prepared exports.

The preferred slash-command style is namespaced/focused to reduce command clutter:

```text
/session-store ...
/session-graph ...
/move ...
/repo-move ...
```

Existing top-level graph commands remain compatibility aliases for now.

## Data sources

Preferred input:

```text
~/.pi/agent/session-store/graph-export.json
```

Legacy store input:

```text
~/.pi/agent/session-graph/curated-store.json
```

This JSON is produced by `agent-session-store` via:

```bash
npm run build-store
npm run export-graph
```

`agent-session-store` merges legacy and namespaced session-move manifests before graph export:

```text
~/.pi/agent/relocations.jsonl
~/.pi/agent/session-move/manifests/relocations.jsonl
```

Fallback inputs, used only when the prepared graph export is unavailable:

```text
~/.pi/agent/relocations.jsonl
~/.pi/agent/session-graph/lineage-overlays.jsonl
```

`pi-session-graph` should normally read the prepared store export rather than parsing raw session-move manifests directly.

## What it displays

- session nodes and relocation/overlay/compaction edges
- current lineage, leaves, roots, and fork points
- classifications/display labels from the canonical store
- logical thread counts and membership-derived summaries
- repo identity/event records when exported by `agent-session-store`
- canonical temporal activity spans, work bursts, activity metrics, and compaction metadata

Repo identity is read-only here. Stable repo/project identity, swap/rename/fork/archive events, and time-use reports are curated in `agent-session-store` and exported for display.

## Artifacts

`/session-graph mermaid` and `pigraph mermaid` write timestamped Markdown and Mermaid files under the current repo:

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

`agent-session-store` / `pi-session-store` owns provider imports, canonical SQLite/JSON exports, lineage/continuity/compaction/fork derivation, repo identity and alias facts, temporal work bursts, and provider/activity metrics.

`pi-session-graph` owns read-only rendering/navigation: Pi current-session commands, CLI/static HTML generation, Mermaid graph output, temporal viewers, filters, search, grouping, legends, and detail panels over prepared exports.

- Does not mutate session JSONLs.
- Does not rewrite legacy `~/.pi/agent/relocations.jsonl` or namespaced `~/.pi/agent/session-move/manifests/relocations.jsonl`.
- Does not infer repo identity from raw content.
- Does not compute temporal/activity metrics from raw sessions.
- Does not perform backup extraction/reconstruction.

Use `agent-session-store` for canonical store rebuilds, repo identity curation, bucket reconciliation, graph exports, and reports.

## HTML viewer

```bash
pigraph html
```

Or inside Pi:

```text
/session-graph html
```

The viewer reads prepared graph data, supports search and confidence/provider/edge-type filters, shows compaction counts in node details, and writes `session-graph/session_graph_viewer_<timestamp>.html`.

## Temporal HTML viewer

```bash
pigraph temporal
pigraph temporal --input ~/.pi/agent/session-store/graph-export.json --output /tmp/temporal.html
```

Or inside Pi:

```text
/session-graph temporal
```

The temporal viewer renders prepared `graph-export.json` records: `temporalActivitySpans`, `workBursts`, `activityMetrics`, and `compactionEvents`. It can group by project/cwd lane, provider, or session; the sticky legend explains wall-clock spans vs accrued activity metrics and compaction/checkpoint badges.
