---
id: psg-suite-docs
status: closed
deps: []
links: []
created: 2026-05-31T15:10:00Z
type: task
priority: 2
assignee: ProbabilityEngineer
---
# Document pi-session suite relationship

Update pi-session-graph docs to explain its place in the pi-session suite.

## Acceptance Criteria

- README references `agent-session-store`/`pi-session-store`, `pi-session-move`, and `pi-repo-move`.
- Graph remains documented as read-only viewer over prepared store exports.
- Install examples use the aligned naming once packages exist.

## Slash command policy

Prefer a compact namespaced command surface:

```text
/session-graph status
/session-graph lineage
/session-graph leaves
/session-graph repos
```

Existing top-level commands may remain as compatibility aliases, but docs should steer users toward the namespace to reduce slash-command clutter.


## Closure

README now documents the Pi session suite relationship, store/graph boundary, planned wrapper packages, and namespaced slash-command direction while preserving compatibility aliases.
