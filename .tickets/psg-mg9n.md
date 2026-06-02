---
id: psg-mg9n
status: closed
deps: []
links: []
created: 2026-06-02T01:37:41Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [whole-lineage, mermaid, reconstruction]
---
# Restore rough whole-lineage graph generator

Add an unpolished command/script that can regenerate `whole-lineage-graph.mmd` and `whole-lineage-graph.html` style artifacts similar to the archived pre-store reconstruction outputs.

## Design

Use existing reconstruction/pre-manifest/prefix/manifest data where available. Output simple Mermaid flowchart HTML/MMD with white background and category legend; do not replace the newer graph generators. The goal is recoverability/usefulness, not polish.

## Acceptance Criteria

- New command/script writes `whole-lineage-graph.mmd` and `whole-lineage-graph.html` or timestamped equivalents.
- Output resembles archived `whole-lineage-graph` style: simple Mermaid flowchart, white background, legend/classes.
- Does not mutate raw session JSONLs/manifests.
- Existing graph commands remain unchanged.
- `npm run lint` passes and command smoke test writes files.

