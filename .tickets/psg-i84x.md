---
id: psg-i84x
status: closed
deps: []
links: []
created: 2026-06-02T03:19:17Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [lineage-split, lineage-name, forks]
---
# Detect lineage splits and require branch naming

When a session move lineage splits into multiple active/recoverable branches, surface that the split branch should get its own pinned lineage name instead of silently sharing the root lineage name forever.

## Design

Start with authoritative/probable detection from manifest topology: multiple children from the same source, explicit branch/diverge mode, and current chain forks. In pi-session-move status/lineage, show split warnings and suggested naming action. Do not rely on semantic transcript content. Future store/graph work can model split confidence and branch-level names canonically.

## Acceptance Criteria

- /move-status and /move-lineage identify authoritative/probable split/fork situations for the current lineage.
- Output distinguishes pinned lineage name from split branch naming needs.
- If current lineage has forks and no branch-specific/current-session name, output suggests /move-lineage --name <new-name>.
- Existing pinned names are not overwritten automatically.
- npx tsc --noEmit passes.

