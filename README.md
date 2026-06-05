# pi-session-graph

Lightweight Pi extension for text session status/lineage and generated session graph artifacts.

`pi-session-graph` does not mutate raw session JSONLs or manifests. Canonical imports/rebuilds live in the bundled `agent-session-store` dependency; this package invokes that backend to prepare exports, then renders views.

## Commands

Text/current-session commands:

```text
/session-status
/session-lineage [--files]
```

Graph artifact generation:

```text
/session-graphs
/session-graphs --dot [--svg]
```

CLI/admin equivalents:

```bash
pigraph                 # help / command summary
pigraph status          # text status for the current session graph
pigraph lineage [--files]
pigraph leaves [--all]
pigraph repos
pigraph dot [--svg]
pigraph graphs
npm run whole-lineage   # rough archived-style whole-lineage Mermaid HTML/MMD
```

`pigraph` with no command prints help and does not inspect the store or generate files. Use `pigraph status` for the explicit status report. `/session-graphs` and `pigraph graphs` always rebuild/export the canonical store, then write timestamped interactive viewer files. There is no `--refresh` flag.

The singular `/session-graph ...` command is no longer part of the public command surface; graph artifact functions are under `/session-graphs ...`.

## Graphviz DOT/SVG

`/session-graphs --dot` and `pigraph dot` write a Graphviz DOT lineage export under the current working directory's `session-graphs/` directory. The structure follows the older Mermaid output from `agent-session-store/scripts/build-graphs.ts`: start circles point to session boxes, yellow diamond state nodes represent source-session state at relocation times, dotted arrows show progression inside a session file, and solid/dashed/bold edges show relocation/derived/compaction links.

```bash
/session-graphs --dot        # write .dot from inside Pi
/session-graphs --dot --svg  # also run graphviz dot -Tsvg when installed
pigraph dot                  # CLI equivalent
pigraph dot --svg
```

If Graphviz is not installed, `dot` is not on PATH, or Graphviz cannot render a large clustered graph, the DOT file is still written and the SVG step reports a clear skip message. On macOS, install Graphviz with:

```bash
brew install graphviz
```

DOT files are plain text. To render one manually:

```bash
dot -Gnewrank=true -Tsvg path/to/session_graph.dot -o session_graph.svg
open session_graph.svg
```

## Graph outputs

Graph report packs are written to timestamped folders:

```text
~/Desktop/session-graphs/<timestamp>/
  index.html
  README.md
  archive/
    full-session-graph.dot/.svg
    full-session-graph-with-starts.dot/.svg
    raw-graph-data.json
  reports/
    01-hotspots.html
    02-repo-jump-map.dot/.svg
    03-false-starts.html
    04-active-hours.html
    05-meaningful-lineage-forest.dot/.svg
    06-lineage-full-interactive.html
    07-lineage-focused-interactive.html
    08-timeline-projects.html
    09-timeline-sessions.html
    09-project-focus-index.html
    11-chart-timeline-projects.html
    12-chart-timeline-sessions.html
```

Open `index.html` first. The archive files preserve what happened; the report files are ranked/focused views for deciding what to inspect.

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

`/session-graphs` and `pigraph graphs` run the bundled `agent-session-store` backend first, so delayed installs are supported: a user can install only `pi-session-move` initially, then install `pi-session-graph` later and rebuild from raw sessions plus move manifests.

If `agent-session-store` is unavailable, install dependencies in this repo with:

```bash
npm install
```

or install the backend globally with:

```bash
npm install -g agent-session-store@latest
```

You can also point at an existing install with:

```bash
export AGENT_SESSION_STORE_BIN=/path/to/agent-session-store
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

- `agent-session-store`: provider-neutral canonical store and graph export builder, installed as this package's backend dependency.
- `pi-session-move`: session-facing move and restart UX.
- `pi-repo-move`: filesystem repo move UX (`/repo-move <target>`).
- `pi-session-graph`: read-only text status/lineage and graph artifact rendering.

## Install

```bash
pi install git:github.com/ProbabilityEngineer/pi-session-graph
```

This package ships committed `dist/` JavaScript so Pi git installs can load the extension and the `pigraph` CLI without running TypeScript directly. Package entry points are:

```text
pi extension: ./dist/index.js
CLI bin:      ./dist/bin/pigraph.js
```

Normal npm installs expose `pigraph` through npm's bin shim location. For global npm installs, that is usually:

```text
$(npm prefix -g)/bin/pigraph
```

With nvm this may resolve to a path like:

```text
~/.nvm/versions/node/<version>/bin/pigraph
```

Pi git installs clone the package under `~/.pi/agent/git/...`; if you want `pigraph` on your shell PATH from a Pi git install, create a user shim in a PATH directory such as `~/.pi/agent/bin`:

```bash
mkdir -p ~/.pi/agent/bin
ln -sfn ~/.pi/agent/git/github.com/ProbabilityEngineer/pi-session-graph/dist/bin/pigraph.js ~/.pi/agent/bin/pigraph
```

Local testing:

```bash
npm run build
pi -e ./dist/index.js
```

## Boundaries

`agent-session-store` owns provider imports, canonical SQLite/JSON exports, lineage/continuity/compaction/fork derivation, repo identity and alias facts, temporal work bursts, and provider/activity metrics.

`pi-session-graph` owns read-only rendering/navigation over prepared exports.

- Does not mutate session JSONLs.
- Does not rewrite legacy `~/.pi/agent/relocations.jsonl` or namespaced `~/.pi/agent/session-move/manifests/relocations.jsonl`.
- Does not infer repo identity from raw content.
- Does not perform backup extraction/reconstruction.
