---
id: psg-2igy
status: closed
deps: []
links: []
created: 2026-06-02T01:12:18Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [graphs, lineage-focused, semantics]
---
# Make lineage-focused match relocation-focused semantics

The new `lineage-focused` HTML currently matches `lineage-full` because it filters to sessions participating in any graph record, including compaction/self/store metadata edges. The original focused graph meant relocation/overlay progression only.

## Design

Update focused lineage generation to include only move/relocation continuity edges: relocation/session_move/repo_move/overlay curated lineage edges, and exclude compaction/checkpoint/self/generic metadata edges and standalone starts. Regenerate counts so lineage-focused is smaller than lineage-full when full includes non-move sessions/edges.

## Acceptance Criteria

- `lineage-focused` and `lineage-full` are not identical on the current graph export.
- Focused view includes sessions with relocation/session-move/repo-move/overlay lineage edges.
- Focused view excludes compaction/self/checkpoint-only sessions and edges.
- Generated page text documents the focused semantics.
- `npm run lint` passes.
- `pigraph graphs` validates and writes distinct focused/full files.

