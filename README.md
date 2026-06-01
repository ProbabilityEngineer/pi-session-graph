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
```

`/session-graphs` and `pigraph graphs` always rebuild/export the canonical store, then write a fresh timestamped set of graph files. There is no `--refresh` flag.

The singular `/session-graph ...` command is no longer part of the public command surface.

## Graph outputs

Graph files are written to:

```text
~/Desktop/session-graphs/
```

Each run writes timestamp-prefixed HTML files and does not overwrite previous runs:

| File suffix | Old report | What it shows | Best for |
|---|---|---|---|
| `lineage-full.html` | `temporal-lineage.html` | All known session graph nodes with available edges/significant starts. Rendered as HTML/SVG, not Mermaid. | Global overview |
| `lineage-focused.html` | `temporal-lineage-focused.html` | Sessions that participate in at least one relocation/session-move/repo-move/overlay edge. Rendered as HTML/SVG, not Mermaid. | Continuity debugging |
| `timeline-projects.html` | `temporal-timeline.html` | Timeline grouped by project/folder label. | Project/cwd movement over time |
| `timeline-sessions.html` | `temporal-timeline-sessions.html` | Timeline grouped by individual session file. | Session-file movement over time |

Example filenames:

```text
2026-06-02T12-34-56-789Z-lineage-full.html
2026-06-02T12-34-56-789Z-lineage-focused.html
2026-06-02T12-34-56-789Z-timeline-projects.html
2026-06-02T12-34-56-789Z-timeline-sessions.html
```

Page titles include the same timestamp and graph type, for example:

```text
2026-06-02T12-34-56-789Z — Lineage Full
```

Mermaid is not used for the primary lineage graph rendering because large session graphs exceed Mermaid renderer size limits.

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
