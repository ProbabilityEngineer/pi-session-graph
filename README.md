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

It first tries to read the canonical store export from:

```text
~/.pi/agent/session-graph/curated-store.json
```

If that is unavailable, it falls back to relocation records plus optional curated overlays:

```text
~/.pi/agent/relocations.jsonl
~/.pi/agent/session-graph/lineage-overlays.jsonl
```

The canonical store is produced by `git:github.com/ProbabilityEngineer/agent-session-store`. SQLite remains canonical there; this extension reads the JSON export to stay lightweight and avoid runtime SQLite compatibility issues.

Store-backed graph output preserves edge types/classifications such as `explicit-continuation`, `explicit-new-lineage`, and display labels like `context jump`. It also understands optional derived logical thread records when the store provides them.

Overlays add reconstructed pre-manifest roots/edges, manual relocation evidence, cwd aliases, backup-derived session labels, and manifest classifications without mutating the raw relocation manifest. The graph is treated as a forest of session-file nodes and relocation/overlay edges. Inferred and overlay records are displayed separately from explicit records.

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

## Reconstruction and canonical store tooling

Heavy reconstruction, backup extraction, temporal reports, and canonical store work now live in the companion repo:

```text
/Users/sam/git/agents/agent-session-store
```

This extension should stay lightweight: slash commands and graph views over prepared relocation/session metadata. Do not mutate Pi session JSONLs or blindly backfill `relocations.jsonl` from forensic scans. Promote inferred edges only through explicit review or curated sidecar/store data.

## Development

```bash
npm install
npm run lint
```
