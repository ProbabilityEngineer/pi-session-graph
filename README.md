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

## Data sources

V1 consumes relocation records from:

```text
~/.pi/agent/relocations.jsonl
```

It also reads optional curated overlay records from:

```text
~/.pi/agent/session-graph/lineage-overlays.jsonl
```

Overlays add reconstructed pre-manifest roots/edges, manual relocation evidence, and cwd aliases without mutating the raw relocation manifest. The graph is treated as a forest of session-file nodes and relocation/overlay edges. Inferred and overlay records are displayed separately from explicit records.

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
npm run temporal-lineage
npm run validate-timeline
npm run index-segments
npm run reconstruct
```

Trust model:

- `~/.pi/agent/relocations.jsonl` explicit records are authoritative for records created after manifest tracking existed.
- Pre-manifest relocations may include manual copy/edit session moves. Treat them as historical evidence, not as pi-relocate-authored manifest truth.
- `npm run prefix-lineage` is the strongest reconstruction signal. It compares canonicalized session content and finds source/destination common prefixes, then writes timestamped `prefix-lineage_*.md/json` plus latest `prefix-lineage.md/json`.
- `npm run temporal-lineage` writes latest aliases `temporal-lineage.md/json/mmd/html` and `temporal-timeline.html/json`. Use `npm run temporal-lineage -- --snapshot` to also write timestamped snapshots under `snapshots/temporal-lineage/`. The Mermaid lineage graph models topology and progression: purple circles are session starts, blue boxes are session-file topology nodes, yellow diamonds are time-indexed states, dotted arrows show progression, and solid arrows show relocation/fork edges. The HTML timeline gives a linear, comparable time axis with zoom/pan: rows are sessions/projects, purple dots are starts, yellow dots are relocation events, and green curves connect relocation events to destination rows. To avoid browser size limits, default visuals include relocation-connected starts plus significant standalone starts; JSON includes all discovered starts. Use `--all-starts` only for raw/full experiments. No transcript content is included.
- `npm run validate-timeline` checks session file metadata, including filename timestamps, filesystem birthtime/mtime, line counts, and manifest timestamp consistency.
- `npm run index-segments` is forensic. It logically segments copied sessions around relocation evidence and suppresses noisy copied transcript evidence where possible.
- `npm run reconstruct` is legacy/diagnostic. It scans transcript relocation output and is intentionally treated as noisy because relocated sessions copy old outputs forward.

Cwd/repo names are historical labels, not durable identity. Session file paths, session ids, manifest edges, timestamps, and content-prefix evidence are the reconstruction identities. Use curated labels/aliases for renamed folders or repos.

Do not mutate Pi session JSONLs or blindly backfill `relocations.jsonl` from forensic scans. Promote inferred edges only through explicit review or curated sidecar data.

## Development

```bash
npm install
npm run lint
```
