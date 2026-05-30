---
id: psg-xdgt
status: open
deps: []
links: []
created: 2026-05-30T02:12:11Z
type: task
priority: 2
assignee: ProbabilityEngineer
tags: [store, naming, pi-imports]
---
# Ingest Pi named session display names

Pi now supports named startup sessions via --name / -n before startup across interactive, print, JSON, and RPC modes (https://github.com/earendil-works/pi/issues/5153). Update canonical store/import design and graph labels to preserve session display names separately from cwd/repo labels and curated lineage names.

## Acceptance Criteria

Store design includes session display name fields with provenance; Pi importer/generator can read display names when present; graph/report labels distinguish display name, cwd label, and curated lineage label; docs cite Pi named startup sessions.

