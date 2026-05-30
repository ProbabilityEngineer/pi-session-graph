---
id: psg-pism
status: open
deps: []
links: []
created: 2026-05-30T02:04:45Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [imports, adapters, oh-my-pi, codex, claude, opencode, factory]
---
# Add import adapter architecture for external agent sessions

Separate transcript/session ingestion from graph rendering by defining import adapters. Start with Pi and oh-my-pi compatible imports, then leave adapter interfaces for Codex, Claude, OpenCode, Factory, and other agent transcript/session formats. Imports should normalize sessions, events, messages/tool calls metadata, timestamps, cwd/project labels, and privacy-safe hashes without dumping transcript content into graph prompts/reports.

## Acceptance Criteria

An adapter interface and at least a Pi importer exist; design notes cover oh-my-pi, Codex, Claude, OpenCode, and Factory source differences; imported records land in the canonical store with source/provider provenance and do not mutate raw imported files.

