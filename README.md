# pi-session-graph

Session lineage graph tools for Pi.

`pi-session-graph` reads Pi relocation/session metadata and shows lineages, leaves, forks, and graph summaries without mutating session JSONLs.

## Commands

```text
/session-status
/session-lineage [--files]
/session-leaves [--all]
/session-graph [--all]
```

## Data source

V1 consumes relocation records from:

```text
~/.pi/agent/relocations.jsonl
```

It treats the graph as a forest of session nodes and relocation edges. Inferred records are displayed separately from explicit records when present in the manifest.

`/session-leaves` and `/session-graph` default to the current connected component. Use `--all` to include every known session tree.

`/session-graph` always writes timestamped files under the current repo:

```text
session-graph/session_graph_<timestamp>.md
session-graph/graph_<timestamp>.mmd
```

## Install

```bash
pi install git:github.com/ProbabilityEngineer/pi-session-graph
```

For local testing:

```bash
pi -e ./index.ts
```

## Reconstruction and forensic scripts

These scripts are read-only with respect to Pi session JSONLs and relocation manifests. They write sidecar reports under:

```text
~/.pi/agent/session-graph/
```

```bash
npm run prefix-lineage
npm run validate-timeline
npm run index-segments
npm run reconstruct
```

Trust model:

- `~/.pi/agent/relocations.jsonl` explicit records are authoritative.
- `npm run prefix-lineage` is the strongest reconstruction signal. It compares canonicalized session content and finds source/destination common prefixes, then writes timestamped `prefix-lineage_*.md/json` plus latest `prefix-lineage.md/json`.
- `npm run validate-timeline` checks session file metadata, including filename timestamps, filesystem birthtime/mtime, line counts, and manifest timestamp consistency.
- `npm run index-segments` is forensic. It logically segments copied sessions around relocation evidence and suppresses noisy copied transcript evidence where possible.
- `npm run reconstruct` is legacy/diagnostic. It scans transcript relocation output and is intentionally treated as noisy because relocated sessions copy old outputs forward.

Do not mutate Pi session JSONLs or blindly backfill `relocations.jsonl` from forensic scans. Promote inferred edges only through explicit review or curated sidecar data.

## Development

```bash
npm install
npm run lint
```
