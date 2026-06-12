---
id: psg-ay52
status: closed
deps: []
links: []
created: 2026-06-12T04:11:31Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [npm, install, packaging]
---
# Fix missing postinstall script in published package

pi-session-graph npm install fails because postinstall runs scripts/check-agent-session-store.mjs but package files only publish dist/README/LICENSE/DESIGN so the script is missing from the installed package. Ship the script or move it into published dist and republish.

