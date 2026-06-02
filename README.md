# pi-session-graph

Lightweight Pi extension for text session status/lineage and generated session graph artifacts.

`pi-session-graph` does not mutate raw session JSONLs or manifests. Canonical imports/rebuilds live in `agent-session-store`; this package reads prepared exports and renders views.

## Commands

Text/current-session commands:

```text
/session-status
/session-lineage [--files]
```

Graph artifact generation:

```text
/session-graphs
```

CLI equivalents:

```bash
pigraph status
pigraph lineage [--files]
pigraph graphs
npm run whole-lineage   # rough archived-style whole-lineage Mermaid HTML/MMD
```

`/session-graphs` and `pigraph graphs` always rebuild/export the canonical store, then write the pre-existing graph viewer artifacts. There is no `--refresh` flag.

The singular `/session-graph ...` command is no longer part of the public command surface.

## Graph outputs

Graph files are written to:

```text
~/Desktop/session-graph/
```

`/session-graphs` writes the older viewer styles rather than the simplified four-file HTML/SVG prototype:

| File pattern | What it shows |
|---|---|
| `session_graph_viewer_<timestamp>.html` | Interactive lineage/detail viewer over graph-export data. |
| `temporal_graph_<timestamp>.html` | Canonical temporal activity viewer over graph-export temporal spans/bursts/metrics/compactions. |
| `session_graph_<timestamp>.md` | Mermaid Markdown graph export. |
| `graph_<timestamp>.mmd` | Raw Mermaid graph export. |

For the clearer named reports (`lineage-full`, `lineage-focused`, `timeline-projects`, `timeline-sessions`), use `agent-session-store`:

```bash
cd /Users/sam/git/agents/agent-session-store
npm run build-graphs
```

For a rough recreation of the archived `whole-lineage-graph.html` / `.mmd` style, use:

```bash
npm run whole-lineage
```

This writes simple white-background Mermaid artifacts to `~/.pi/agent/session-graph/whole-lineage-graph.html` and `.mmd`.

## Data sources

Preferred input:

```text
~/.pi/agent/session-store/graph-export.json
```

Legacy store input:

```text
~/.pi/agent/session-graph/curated-store.json
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

## Pi session suite relationship

- `agent-session-store`: provider-neutral canonical store and graph export builder.
- `pi-session-store`: Pi-facing wrapper around store workflows.
- `pi-session-move`: session-facing move and restart UX.
- `pi-repo-move`: filesystem repo move UX (`/repo-move <target>`).
- `pi-session-graph`: read-only text status/lineage and graph artifact rendering.

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

`pi-session-graph` owns read-only rendering/navigation over prepared exports.

- Does not mutate session JSONLs.
- Does not rewrite legacy `~/.pi/agent/relocations.jsonl` or namespaced `~/.pi/agent/session-move/manifests/relocations.jsonl`.
- Does not infer repo identity from raw content.
- Does not perform backup extraction/reconstruction.
