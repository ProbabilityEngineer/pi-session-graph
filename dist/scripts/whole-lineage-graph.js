#!/usr/bin/env tsx
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildGraph } from "../index.js";
function homeShort(path) {
    const home = process.env.HOME;
    return home && path.startsWith(`${home}/`) ? `~/${path.slice(home.length + 1)}` : path;
}
function slug(path) {
    const cwd = path.split("/sessions/")[1]?.split("/")[0]?.replace(/^--|--$/g, "");
    if (!cwd)
        return path.split("/").at(-1)?.slice(0, 24) ?? "session";
    return cwd
        .replace(/^Users-sam-git-agents-/, "")
        .replace(/^Users-sam-git-public-/, "")
        .replace(/^Users-sam-git-private-utilities-/, "")
        .replace(/^Users-sam-git-bespoke-thinking-/, "")
        .replace(/^Users-sam-git-/, "")
        .replace(/^Users-sam-/, "")
        .replaceAll("-", "-");
}
function timestamp(path, fallback) {
    const file = path.split("/").at(-1) ?? "";
    const relocated = [...file.matchAll(/_relocated_(?:.*?_)?(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/g)].at(-1)?.[1];
    const base = file.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/)?.[1];
    return (relocated ?? base ?? fallback ?? "unknown").replace(/T(\d{2})-(\d{2})-(\d{2})-.*/, " $1:$2");
}
function nodeId(path) {
    let h = 0n;
    for (const ch of path)
        h = (h * 131n + BigInt(ch.charCodeAt(0))) % 9007199254740991n;
    return `n${h}`;
}
function mermaidLabel(value) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, "&quot;").replace(/\r?\n/g, "<br/>");
}
function edgeKind(record) {
    if (record.operationType === "repo_move")
        return "explicit-continuation";
    if (record.lineageKind)
        return record.lineageKind;
    if (record.edgeType)
        return record.edgeType;
    if (record.inferred)
        return "inferred";
    return "explicit-continuation";
}
function classFor(record) {
    const kind = edgeKind(record);
    if (String(kind).includes("new-lineage"))
        return "new";
    if (record.confidence === "low" || String(kind).includes("duplicate"))
        return "low";
    if (record.overlay || record.inferred || String(kind).includes("inferred"))
        return "inferred";
    return "explicit";
}
async function main() {
    const outputDir = process.argv[2] ?? join(process.env.HOME ?? ".", ".pi", "agent", "session-graph");
    await mkdir(outputDir, { recursive: true });
    const graph = await buildGraph();
    const nodes = [...graph.nodes.values()].sort((a, b) => a.label.localeCompare(b.label) || a.path.localeCompare(b.path));
    const records = [...graph.records].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    const classes = new Map();
    const lines = ["flowchart TD"];
    for (const node of nodes) {
        const id = nodeId(node.path);
        const label = `${node.label || slug(node.path)}@${timestamp(node.path, node.timestamp)}${node.pinnedLineageName ? `\npinned: ${node.pinnedLineageName}` : ""}`;
        lines.push(`  ${id}["${mermaidLabel(label)}"]`);
    }
    for (const [index, record] of records.entries()) {
        const from = graph.nodes.get(record.sourceSession);
        const to = graph.nodes.get(record.destinationSession);
        if (!from || !to)
            continue;
        const kind = edgeKind(record);
        const edgeLabel = `${record.inferred ? "inferred" : `#${index + 1}`} ${kind}`;
        lines.push(`  ${nodeId(from.path)} -->|"${mermaidLabel(edgeLabel)}"| ${nodeId(to.path)}`);
        classes.set(from.path, classes.get(from.path) ?? classFor(record));
        classes.set(to.path, classFor(record));
    }
    lines.push("  classDef root fill:#dbeafe,stroke:#2563eb,stroke-width:2px;", "  classDef explicit fill:#dcfce7,stroke:#16a34a;", "  classDef inferred fill:#fef9c3,stroke:#ca8a04;", "  classDef low fill:#fee2e2,stroke:#dc2626;", "  classDef manual fill:#ede9fe,stroke:#7c3aed;", "  classDef new fill:#f3f4f6,stroke:#6b7280;");
    const destinations = new Set(records.map((record) => record.destinationSession));
    for (const node of nodes) {
        const cls = destinations.has(node.path) ? classes.get(node.path) ?? "explicit" : "root";
        lines.push(`  class ${nodeId(node.path)} ${cls};`);
    }
    const mmd = lines.join("\n") + "\n";
    const generated = new Date().toISOString();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pi session lineage graph</title><script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs'; mermaid.initialize({startOnLoad:true,securityLevel:'loose'});</script><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:2rem;} .mermaid{background:#fff;padding:1rem;border:1px solid #ddd;border-radius:8px;} pre{white-space:pre-wrap;}</style></head><body><h1>Pi session lineage graph</h1><p>Generated ${generated}. Cwd/repo names are historical labels, not durable identity.</p><ul><li>Blue: root/no incoming edge</li><li>Green: explicit continuation</li><li>Yellow: inferred/overlay</li><li>Red: low-confidence/duplicate-like</li><li>Gray: explicit new lineage/separate root</li></ul><div class="mermaid">${mmd.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</div></body></html>\n`;
    const mmdPath = join(outputDir, "whole-lineage-graph.mmd");
    const htmlPath = join(outputDir, "whole-lineage-graph.html");
    await writeFile(mmdPath, mmd);
    await writeFile(htmlPath, html);
    console.log(`Wrote ${homeShort(mmdPath)}`);
    console.log(`Wrote ${homeShort(htmlPath)}`);
}
await main();
//# sourceMappingURL=whole-lineage-graph.js.map