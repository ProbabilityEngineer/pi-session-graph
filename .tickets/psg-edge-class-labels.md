---
id: psg-edge-class-labels
status: closed
deps: []
links:
  - git:github.com/ProbabilityEngineer/agent-session-store
created: 2026-05-30T03:40:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Show store edge classifications in graph output

Make Mermaid/report output show important store-backed edge classifications such as context jump, explicit continuation, and new lineage.

## Acceptance Criteria

- Store edge classifications are visible in graph edge labels or report sections.
- Context-jump profile edge is clearly labeled.
- Output remains readable for compact graphs.
- TypeScript check passes.
