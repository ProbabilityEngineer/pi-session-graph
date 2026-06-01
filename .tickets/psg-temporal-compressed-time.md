---
id: psg-temporal-compressed-time
status: open
deps: [psg-canonical-temporal-html]
links:
  - ../agent-session-store/.tickets/ass-temporal-axis-data.md
created: 2026-06-01T14:00:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Compress inactive time in temporal session graphs

Temporal session graphs should avoid wasting horizontal space on months where no relevant session activity occurred.

## Acceptance Criteria

- Temporal HTML can use a compressed or segmented time axis that collapses long inactive gaps.
- Inactive gaps remain visible as labeled breaks, e.g. `gap: 42 days`, rather than disappearing silently.
- User can toggle between real-time proportional axis and compressed-time axis.
- Gap compression works for whole graph and focused/component views.
- Hover/detail text still shows real timestamps and durations.
- Legend explains compressed time and gap markers.

## Boundary note

The compression algorithm belongs in the renderer, but it should operate over prepared temporal activity spans from `agent-session-store`, not parse raw sessions directly.
