---
id: psg-ehad
status: closed
deps: []
links: []
created: 2026-06-05T00:32:04Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [reports, index, ux]
---
# Group report index variants by basename

Change report pack index.html ordering to list Archive before Reports and group multiple file formats of the same artifact together by basename. Number grouped variants with suffix letters such as 2a/2b for DOT/SVG pairs while single-file artifacts keep a plain number.

## Acceptance Criteria

index.html renders Archive section before Reports; artifacts are grouped by directory+basename and ordered by numeric filename prefix; DOT/SVG or other format variants of the same basename are adjacent and labeled 2a/2b etc.; single artifacts retain plain numbering; build/lint and graph generation validate.

