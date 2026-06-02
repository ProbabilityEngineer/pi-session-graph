---
id: psg-pnnu
status: closed
deps: []
links: []
created: 2026-06-02T02:43:11Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [lineage-name, session-name, auto-pin]
---
# Auto-pin lineage name from current session name

If the current Pi session has a display name and the current move lineage has no pinned lineage name yet, automatically pin the lineage name to that session display name. After a lineage name is pinned, only explicit user commands should change it.

## Design

In `pi-session-move`, when status/lineage/move logic can determine the current lineage root and sees no existing pinned lineage name, read the current Pi session display name. If it is non-empty/non-default, append a lineage-name sidecar record using source `pi-session-move:auto-pin-session-name`. Do not overwrite existing pinned lineage names. `/move-lineage --name <name>` remains the explicit override and should keep source `pi-session-move`.

## Acceptance Criteria

- A named current Pi session with no pinned lineage name gets a pinned lineage-name record automatically.
- Existing pinned lineage names are not overwritten automatically.
- Empty/default/unknown session names are ignored.
- Explicit `/move-lineage --name <name>` still overrides by appending a newer pinned record.
- `/move-status` and `/move-lineage` show the auto-pinned name.
- `npx tsc --noEmit` passes.

