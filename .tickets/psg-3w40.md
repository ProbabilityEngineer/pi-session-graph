---
id: psg-3w40
status: closed
deps: []
links: []
created: 2026-06-02T18:38:27Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Depend on agent-session-store for graph rebuilds

Make pi-session-graph install and invoke agent-session-store automatically so graph users do not need to separately discover/install the canonical backend.

## Acceptance Criteria

- pi-session-graph declares agent-session-store as an npm dependency or otherwise bundles it intentionally.
- /session-graphs and pigraph graphs invoke the dependency's build/export workflow instead of assuming a separately installed CLI/repo checkout.
- Missing/corrupt store is rebuilt from raw Pi sessions and session-move manifests.
- README explains the bundled backend relationship and delayed-install rebuild behavior.
- npm run build/lint and a graph-generation smoke test pass.


## Notes

**2026-06-02T18:39:53Z**

Partially implemented locally: package.json declares agent-session-store ^0.1.1; refresh now invokes agent-session-store CLI candidates (bundled node_modules/.bin, AGENT_SESSION_STORE_BIN, PATH) instead of assuming a repo checkout/npm run; README documents bundled backend/delayed install. Validation passed with AGENT_SESSION_STORE_BIN=/Users/sam/git/agents/agent-session-store/dist/bin/agent-session-store.js: npm run build; npm run lint; node dist/bin/pigraph.js graphs. Not committed yet because agent-session-store is not published to npm; npm install/package-lock update will fail until first publish completes.
