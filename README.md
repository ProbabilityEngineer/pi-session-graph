# pi-session-graph

Session lineage graph tools for Pi.

`pi-session-graph` reads Pi relocation/session metadata and shows lineages, leaves, forks, and graph summaries without mutating session JSONLs.

## Commands

```text
/session-status
/session-lineage [--files]
/session-leaves
/session-graph [--mermaid]
```

## Data source

V1 consumes relocation records from:

```text
~/.pi/agent/relocations.jsonl
```

It treats the graph as a forest of session nodes and relocation edges. Inferred records are displayed separately from explicit records when present in the manifest.

## Install

```bash
pi install git:github.com/ProbabilityEngineer/pi-session-graph
```

For local testing:

```bash
pi -e ./index.ts
```

## Development

```bash
npm install
npm run lint
```
