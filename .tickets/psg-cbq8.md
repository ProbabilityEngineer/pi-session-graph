---
id: psg-cbq8
status: closed
deps: []
links: []
created: 2026-06-02T00:54:49Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [pi-extension, install, session-store]
---
# Add Pi extension metadata

`pi-session-store` registers a `/session-store` command in `index.ts`, but `package.json` lacks the `pi.extensions` metadata, so Pi installs may not load the extension automatically.

## Design

Add a `pi.extensions` entry pointing to `./index.ts`, matching the pattern used by the other Pi suite packages. Validate that `npm run lint` passes and document/reinstall if needed.

## Acceptance Criteria

- `package.json` contains `"pi": { "extensions": ["./index.ts"] }`.
- `/session-store` is available after installing/reloading the package.
- `npm run lint` passes.

