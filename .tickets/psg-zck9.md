---
id: psg-zck9
status: closed
deps: []
links: []
created: 2026-06-05T04:32:09Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [charts, regression]
---
# Fix Weekly Project Area render regression

Weekly Project Area chart stopped rendering after tooltip ordering change, likely due to generated JavaScript syntax error. Fix generated script so activeProject state is declared outside chart option object.

