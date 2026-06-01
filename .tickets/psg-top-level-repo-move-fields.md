---
id: psg-top-level-repo-move-fields
status: closed
type: feature
priority: 2
created: 2026-06-01T00:00:00Z
---
# Render top-level pi-repo-move repo move fields

`agent-session-store` exposes repo move events derived from top-level `pi-repo-move` manifest fields. Historical `pi-move` / `pi-move-repo` tool values remain supported as compatibility data.

## Acceptance Criteria

- Render repo move events distinctly from session-only relocation edges when exported by the store.
- Show sourceRepo, targetRepo, operationType, and tool in detail panels.
- Preserve generic graph/session graph compatibility.
- Do not parse raw relocation manifests directly when store export has prepared repo events.
