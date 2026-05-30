# Store-backed graph comparison

Generated after enabling canonical store reads.

Input:

```text
~/.pi/agent/session-graph/curated-store.json
```

Checks from `buildGraph()`:

```text
source: store
records: 41
nodes: 49
context classifications present: 1
Probability-Engineer profile edge present: 1
quicklook edges present: 3
```

Expected key facts preserved:

- canonical store is selected before legacy fallback
- context-jump/new-lineage classification survives as an edge lineage kind
- Probability-Engineer profile relocation is present
- quicklook continuation edges are present

Legacy fallback remains available when the curated store export is missing or invalid.
