---
id: psg-1ums
status: closed
deps: []
links: []
created: 2026-06-02T17:29:15Z
type: task
priority: 1
assignee: ProbabilityEngineer
---
# Build JS dist for extension and pigraph CLI

Fix pigraph packaging by using a standard TypeScript build: source TS compiles to committed dist JS, package main/bin/pi manifest point at dist, and `pigraph` runs from built JS instead of a TS file importing missing index.js.

## Acceptance Criteria

- Add/update build config to emit dist JS and declarations.
- package.json main/types/bin/pi.extensions point to built dist files.
- `pigraph` runs from dist without tsx or missing index.js.
- Decide whether to commit dist for Pi git install reliability and document the choice.
- npm run build/lint and a pigraph smoke test pass.

