---
id: psg-8hoa
status: closed
deps: []
links: []
created: 2026-06-02T00:29:39Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [output, desktop, timestamps]
---
# Write timestamped graph files to Desktop

Graph generation should write timestamped outputs to the user's Desktop instead of overwriting stable files or writing into the current repo by default.

## Design

Make /session-graphs and pigraph graphs write all generated files to ~/Desktop/session-graphs/. Each run should use a timestamp prefix in every filename. Do not overwrite previous graph outputs. Return concise output listing the written files.

## Acceptance Criteria

- Graph files are written under ~/Desktop/session-graphs/.
- Filenames include a timestamp prefix.
- Re-running graph generation does not overwrite prior outputs.
- Command output lists all generated files.
- npm run lint passes.

