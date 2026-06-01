---
id: psg-5xbf
status: closed
deps: []
links: []
created: 2026-06-02T00:29:33Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [commands, ux, graphs]
---
# Simplify graph command surface to session-graphs

Replace the singular /session-graph artifact command surface with a single plural /session-graphs command for generating graph files. Keep text/current-session commands separate as /session-status and /session-lineage.

## Design

Remove /session-graph command registration from the public surface. Add /session-graphs that generates all graph artifacts. Keep /session-status and /session-lineage as text/status commands. CLI should use pigraph graphs for artifact generation. Do not keep aliases for the removed /session-graph subcommands unless explicitly needed later.

## Acceptance Criteria

- /session-graphs generates graph artifacts.
- /session-status remains text status.
- /session-lineage remains text lineage.
- /session-graph is no longer registered/documented.
- pigraph graphs is the CLI equivalent.
- npm run lint passes.

