---
id: psg-canonical-temporal-html
status: closed
deps: [psg-html-graph-viewer]
links:
  - ../agent-session-store/.tickets/ass-cyp-project-alias.md
  - ../agent-session-store/.tickets/ass-graph-export-contract.md
  - ../agent-session-store/.tickets/ass-temporal-axis-data.md
created: 2026-05-31T17:00:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Generate canonical multi-provider temporal view

The existing temporal HTML is based on older Pi relocation/reconstruction inputs. Add a temporal mode over canonical `graph-export.json` so external providers and cross-provider continuity are visible.

## Acceptance Criteria

- Reads `graph-export.json`/`curated-store.json`.
- Shows Pi, Codex, oh-my-pi, OpenCode, Factory, Claude, Rovo, and Late sessions where present.
- Can group rows by repo identity/project alias, cwd, provider, or individual session.
- Shows confidence/provenance in hover/details.
- CYP/Check Your Photos can appear as one project lane when aliases are curated.

## Boundary note

This ticket is rendering/viewer work. Canonical temporal lanes, work bursts, provider activity counts, and repo identity aliases should be exported by `agent-session-store`; this repo should render and filter those prepared records.


## Closure

Implemented pi-session-graph temporal over canonical graph-export.json temporalActivitySpans/workBursts/activityMetrics/compactionEvents with grouping by project/cwd label, provider, or session and detail panes.
