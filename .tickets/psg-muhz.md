---
id: psg-muhz
status: closed
deps: []
links: []
created: 2026-06-01T23:37:20Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [commands, cli, docs, refresh]
---
# Rename graph commands to lineage timeline

Replace confusing html/temporal/mermaid command names with lineage, lineage-mermaid, and timeline, including --refresh support and Desktop output.

## Design

Expose /session-graph lineage, /session-graph lineage-mermaid, /session-graph timeline and matching pigraph CLI subcommands. --refresh should run agent-session-store build and export-graph before rendering. Generated files should save to the user's Desktop by default instead of the current repo. No aliases required. Update README docs.

## Acceptance Criteria

- /session-graph lineage --refresh rebuilds/export graph and writes interactive lineage HTML to ~/Desktop.
- /session-graph lineage-mermaid --refresh rebuilds/export graph and writes lineage Markdown/Mermaid files to ~/Desktop.
- /session-graph timeline --refresh rebuilds/export graph and writes interactive timeline HTML to ~/Desktop.
- pigraph supports lineage, lineage-mermaid, timeline with --refresh.
- README documents the new names, refresh behavior, and Desktop output.
- npm run lint passes.

