---
id: psg-qkeb
status: closed
deps: []
links: []
created: 2026-06-02T01:15:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [svg, lineage, agent-session-store]
---
# Add SVG temporal lineage generator

Add a new agent-session-store report command that preserves existing npm run temporal-lineage behavior but writes lineage HTML as generated SVG instead of Mermaid, avoiding Mermaid maximum text size errors.

## Design

Do not change or delete npm run temporal-lineage. Add a new script/command, e.g. temporal-lineage-svg, that reuses the existing temporal lineage data model and timeline outputs where useful, but renders lineage-full and lineage-focused as inline SVG/HTML. Keep output simple/readable, not the newer fancy blue graph UI. Write timestamped or clearly named files without mutating raw evidence.

## Acceptance Criteria

- Existing npm run temporal-lineage remains unchanged.
- New npm script/CLI command generates SVG-based lineage full and focused HTML.
- SVG focused semantics match original focused graph: relocation/overlay progression only.
- SVG full includes full temporal lineage nodes/edges/significant starts comparable to the original full report.
- No Mermaid dependency for the new lineage HTML.
- npm run lint passes.
- New command smoke test writes files successfully.

