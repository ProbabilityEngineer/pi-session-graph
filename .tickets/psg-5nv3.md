---
id: psg-5nv3
status: closed
deps: []
links: []
created: 2026-06-02T21:30:42Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [reports, session-graphs, ux, archive]
---
# Generate timestamped session graph report pack

Make /session-graphs and pigraph graphs generate a complete timestamped report folder instead of only standalone graph files. The report pack should separate archive artifacts from insight reports and provide a clear index for human/assistant review.

## Acceptance Criteria

- /session-graphs and pigraph graphs write to ~/Desktop/session-graphs/<timestamp>/.
- Each run creates index.html and README.md explaining every artifact and recommended reading order.
- Use clear filenames and page titles so users can reference them in conversation.
- Create archive/ and reports/ subdirectories.
- Preserve existing interactive lineage/timeline HTML outputs, either moved into reports/ or linked from the index.
- Validation includes npm run build, npm run lint, pigraph graphs smoke test, and opening/index path output.

