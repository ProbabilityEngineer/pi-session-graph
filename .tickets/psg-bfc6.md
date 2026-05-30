---
id: psg-bfc6
status: open
deps: []
links: []
created: 2026-05-30T02:05:19Z
type: task
priority: 2
assignee: ProbabilityEngineer
tags: [classification, evidence, context-jump]
---
# Annotate context jumps and evidence records

Add curated classifications and evidence records for context jumps/new lineages, starting with manifest #26 pi-beads-adapter/agents to Probability-Engineer-github-profile. Preserve source-last-used timestamp, relocation timestamp, cwd/bucket distinction, shell/filesystem evidence where available, and human interpretation that it was a session jump to a new task rather than project continuation.

## Acceptance Criteria

Canonical store or overlay contains edge classification/evidence records for #26 and other explicit-new-lineage edges; generated graph labels distinguish continuation vs context jump/new lineage; raw relocations.jsonl remains unchanged.

