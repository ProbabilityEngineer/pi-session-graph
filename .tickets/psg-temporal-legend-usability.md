---
id: psg-temporal-legend-usability
status: closed
deps: []
links: []
created: 2026-05-31T17:00:00Z
type: task
priority: 3
assignee: ProbabilityEngineer
---
# Improve temporal HTML legend usability

The temporal timeline has a text legend at the top, but it disappears from view when users pan/zoom inside the SVG.

## Acceptance Criteria

- Make the temporal timeline legend sticky/collapsible or add an in-SVG legend overlay.
- Clarify that temporal HTML currently shows Pi relocation/reconstruction data, not full multi-provider canonical graph data.
- Link to the future graph-export HTML viewer for multi-provider views.


## Closure

Temporal HTML now has a sticky header legend with a toggle button. The legend states that the view renders canonical graph-export records, distinguishes wall-clock session spans from accrued activity metrics, and points users at the graph-export-backed HTML/temporal viewers rather than older relocation-only data.
