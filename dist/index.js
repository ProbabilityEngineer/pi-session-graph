import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { basename, join, resolve } from "node:path";
const execFileAsync = promisify(execFile);
const MANIFEST = "relocations.jsonl";
const OVERLAYS = "session-graph/lineage-overlays.jsonl";
const CURATED_STORE = "session-graph/curated-store.json";
const GRAPH_EXPORT = "session-store/graph-export.json";
function agentDir() {
    return process.env.PI_CODING_AGENT_DIR ?? join(process.env.HOME ?? ".", ".pi", "agent");
}
function manifestFile() {
    return join(agentDir(), MANIFEST);
}
function overlayFile() {
    return join(agentDir(), OVERLAYS);
}
function curatedStoreFile() {
    return join(agentDir(), CURATED_STORE);
}
function graphExportFile() {
    return join(agentDir(), GRAPH_EXPORT);
}
function desktopOutputRoot() {
    return join(process.env.HOME ?? ".", "Desktop");
}
function agentSessionStoreRoot() {
    return resolve(process.env.AGENT_SESSION_STORE_REPO ?? join(process.env.HOME ?? ".", "git", "agents", "agent-session-store"));
}
async function runAgentSessionStore(script) {
    const cwd = agentSessionStoreRoot();
    const { stdout, stderr } = await execFileAsync("npm", ["run", script], { cwd, env: process.env });
    return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
}
async function refreshStoreExport() {
    const cwd = agentSessionStoreRoot();
    const build = await runAgentSessionStore("build-store");
    const exportGraph = await runAgentSessionStore("export-graph");
    return [
        "Refreshed graph export",
        `Core repo: ${shortPath(cwd)}`,
        ...(build ? [build] : []),
        ...(exportGraph ? [exportGraph] : []),
    ];
}
function shortHash(value) {
    return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
function sessionId(path) {
    return `ses_${shortHash(path)}`;
}
function fieldString(value) {
    return typeof value === "string" && value.trim() ? value : undefined;
}
function contractField(edge, key) {
    return fieldString(edge[key]) ?? fieldString(edge.metadata?.[key]);
}
function shortPath(path) {
    if (!path || path.startsWith("("))
        return path;
    const home = process.env.HOME;
    return home && path.startsWith(`${home}/`) ? `~/${path.slice(home.length + 1)}` : path;
}
function cwdLabel(cwd) {
    if (!cwd || cwd.startsWith("("))
        return cwd;
    return basename(cwd) || cwd;
}
function pathLabel(cwd, path) {
    return cwd && !cwd.startsWith("(") ? cwdLabel(cwd) : cwdLabel(path);
}
function marker(record) {
    const kind = record.displayLabel ?? record.lineageKind ?? record.edgeType;
    if (record.overlay)
        return kind ? `overlay/${kind}` : "overlay";
    if (record.inferred)
        return kind ? `inferred/${kind}` : "inferred";
    return kind ? `explicit/${kind}` : "explicit";
}
function parseArgs(args) {
    return (args.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []).map((part) => part.replace(/^["']|["']$/g, ""));
}
function parseFlags(args) {
    return new Set(parseArgs(args));
}
async function readJson(path) {
    try {
        return JSON.parse(await readFile(path, "utf8"));
    }
    catch {
        return undefined;
    }
}
async function readJsonl(path) {
    try {
        const raw = await readFile(path, "utf8");
        return raw
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => JSON.parse(line));
    }
    catch {
        return [];
    }
}
async function readManifest() {
    return readJsonl(manifestFile());
}
async function readOverlays() {
    return readJsonl(overlayFile());
}
function addNode(nodes, path, cwd, aliases = new Map(), provider, compactionCount, extra = {}) {
    if (!path || path.startsWith("("))
        return;
    if (!nodes.has(path)) {
        const base = cwdLabel(cwd);
        const alias = aliases.get(cwd);
        const label = extra.label ?? (alias && alias !== base ? `${base} (${alias})` : base);
        nodes.set(path, { id: extra.id ?? sessionId(path), path, cwd, label, provider, compactionCount, ...extra });
    }
    else {
        const node = nodes.get(path);
        if (provider)
            node.provider = provider;
        if (compactionCount != null)
            node.compactionCount = (node.compactionCount ?? 0) + compactionCount;
        Object.assign(node, Object.fromEntries(Object.entries(extra).filter(([, value]) => value != null)));
    }
}
function overlayEdges(overlays) {
    return overlays.flatMap((record) => {
        if (record.kind !== "edge")
            return [];
        return [{
                ts: record.ts ?? "(overlay)",
                fromCwd: record.fromCwd ?? "(overlay/unknown)",
                toCwd: record.toCwd ?? "(overlay/unknown)",
                sourceSession: record.source,
                destinationSession: record.destination,
                inferred: true,
                confidence: record.confidence,
                lineageKind: record.lineageKind,
                overlay: true,
            }];
    });
}
function graphFromRecords(records, overlays, aliases, source, logicalThreads = [], repoIdentities = []) {
    const roots = overlays.filter((record) => record.kind === "root");
    const nodes = new Map();
    const children = new Map();
    const byDestination = new Map();
    for (const root of roots)
        addNode(nodes, root.session, root.historicalCwd ?? root.label ?? "(overlay/root)", aliases);
    for (const record of records) {
        addNode(nodes, record.sourceSession, record.fromCwd, aliases);
        addNode(nodes, record.destinationSession, record.toCwd, aliases);
        const list = children.get(record.sourceSession) ?? [];
        list.push(record);
        children.set(record.sourceSession, list);
        byDestination.set(record.destinationSession, record);
    }
    return { records, nodes, children, byDestination, overlays, aliases, source, logicalThreads, repoIdentities };
}
function edgeEndpoint(edge, side) {
    return side === "from" ? edge.from ?? edge.source ?? edge.from_id ?? edge.sourceId : edge.to ?? edge.target ?? edge.to_id ?? edge.targetId;
}
function buildGenericGraph(store) {
    const genericNodes = store.nodes ?? [];
    const genericEdges = (store.edges ?? []).filter((edge) => !("sourceSessionId" in edge) && edgeEndpoint(edge, "from") != null && edgeEndpoint(edge, "to") != null);
    if (!genericNodes.length && !genericEdges.length)
        return undefined;
    const nodes = new Map();
    for (const node of genericNodes)
        addNode(nodes, node.id, String(node.metadata?.cwd ?? node.type ?? node.kind ?? "generic"), new Map(), node.provider, undefined, { id: node.id, type: node.type ?? node.kind, label: node.label ?? node.title ?? node.id, status: node.status, confidence: node.confidence, provenance: node.provenance, scope: node.scope, timestamp: node.timestamp ?? node.created_at ?? node.createdAt, evidence: node.evidence, metadata: node.metadata });
    const records = [];
    for (const edge of genericEdges) {
        const from = edgeEndpoint(edge, "from");
        const to = edgeEndpoint(edge, "to");
        addNode(nodes, from, "generic", new Map(), undefined, undefined, { id: from, label: from, type: "unknown" });
        addNode(nodes, to, "generic", new Map(), undefined, undefined, { id: to, label: to, type: "unknown" });
        records.push({ id: edge.id, ts: edge.timestamp ?? edge.created_at ?? edge.createdAt ?? "(generic)", fromCwd: from, toCwd: to, sourceSession: from, destinationSession: to, inferred: edge.provenance === "inferred" || edge.provenance === "derived", confidence: edge.confidence, provenance: edge.provenance, status: edge.status, scope: edge.scope, edgeType: edge.type ?? edge.kind ?? "related_to", displayLabel: edge.type ?? edge.kind, evidence: edge.evidence, metadata: edge.metadata });
    }
    const graph = graphFromRecords(records, [], new Map(), "store");
    graph.nodes = nodes;
    return graph;
}
function buildStoreGraph(store) {
    const genericGraph = buildGenericGraph(store);
    if (genericGraph && !(store.sessions ?? []).length)
        return genericGraph;
    const sessionsById = new Map((store.sessions ?? []).map((session) => [session.id, session]));
    if (!sessionsById.size || !(store.edges ?? []).length)
        return genericGraph;
    const labelByTarget = new Map();
    const displayNameByTarget = new Map();
    const pinnedLineageNameByTarget = new Map();
    for (const label of store.labels ?? []) {
        if (label.targetType !== "session")
            continue;
        if (label.labelType === "display_name")
            displayNameByTarget.set(label.targetId, label.value);
        if (label.labelType === "pinned_lineage_name" || label.labelType === "lineage")
            pinnedLineageNameByTarget.set(label.targetId, label.value);
        const previous = labelByTarget.get(label.targetId);
        if (!previous || label.labelType === "pinned_lineage_name" || label.labelType === "lineage" || label.labelType === "display_name")
            labelByTarget.set(label.targetId, label.value);
    }
    const classificationByEdge = new Map((store.classifications ?? []).filter((item) => item.targetType === "edge").map((item) => [item.targetId, item]));
    const records = [];
    const overlays = [];
    const logicalThreads = (store.logicalThreads ?? []).map((thread) => ({
        id: thread.id,
        label: thread.label ?? thread.id,
        members: (store.threadMembers ?? [])
            .filter((member) => member.threadId === thread.id)
            .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
            .flatMap((member) => {
            const session = sessionsById.get(member.sessionId);
            return session ? [{ sessionPath: session.canonicalKey, role: member.role, ordinal: member.ordinal }] : [];
        }),
    }));
    const repoIdentities = (store.repoIdentities ?? []).map((repo) => ({
        ...repo,
        observations: (store.repoObservations ?? []).filter((obs) => obs.repoIdentityId === repo.id),
        events: (store.repoEvents ?? []).filter((event) => event.repoIdentityId === repo.id || event.relatedRepoIdentityId === repo.id),
    }));
    for (const compaction of store.compactionEvents ?? []) {
        const session = sessionsById.get(compaction.sessionId);
        if (!session)
            continue;
        const count = compaction.eventCount ?? compaction.summaryEventCount ?? compaction.metadata?.eventCount ?? compaction.metadata?.summaryEventCount ?? 1;
        records.push({
            ts: compaction.timestamp ?? compaction.lastCompactionAt ?? compaction.firstCompactionAt ?? "(compaction)",
            fromCwd: labelByTarget.get(session.id) ?? session.metadata?.cwd ?? "(store/unknown)",
            toCwd: labelByTarget.get(session.id) ?? session.metadata?.cwd ?? "(store/unknown)",
            sourceSession: session.canonicalKey,
            destinationSession: session.canonicalKey,
            inferred: false,
            confidence: compaction.confidence ?? "authoritative",
            lineageKind: "compaction",
            displayLabel: `compact x${count}`,
            edgeType: "compaction",
            overlay: false,
        });
    }
    for (const edge of store.edges ?? []) {
        if (!("sourceSessionId" in edge))
            continue;
        const source = sessionsById.get(edge.sourceSessionId);
        const target = sessionsById.get(edge.targetSessionId);
        if (!source || !target)
            continue;
        const classification = classificationByEdge.get(edge.id);
        const operationType = contractField(edge, "operationType");
        const tool = contractField(edge, "tool");
        const mode = contractField(edge, "mode");
        const batchId = contractField(edge, "batchId");
        const sourceRepo = contractField(edge, "sourceRepo");
        const targetRepo = contractField(edge, "targetRepo");
        records.push({
            ts: edge.timestamp ?? "(store)",
            fromCwd: edge.metadata?.fromCwd ?? labelByTarget.get(source.id) ?? source.metadata?.cwd ?? "(store/unknown)",
            toCwd: edge.metadata?.toCwd ?? labelByTarget.get(target.id) ?? target.metadata?.cwd ?? "(store/unknown)",
            sourceSession: source.canonicalKey,
            destinationSession: target.canonicalKey,
            inferred: edge.confidence !== "authoritative",
            confidence: edge.confidence,
            lineageKind: classification?.classification,
            displayLabel: classification?.metadata?.displayLabel,
            edgeType: edge.edgeType,
            provenance: edge.provenance,
            overlay: edge.provenance !== "pi-session-move-manifest" && edge.provenance !== "pi-relocate-manifest" && edge.provenance !== "pi-move-manifest" && edge.provenance !== "pi-move-repo-manifest" && edge.provenance !== "pi-repo-move-manifest",
            operationType,
            tool,
            mode,
            batchId,
            sourceRepo,
            targetRepo,
            metadata: { ...(edge.metadata ?? {}), operationType, tool, mode, batchId, sourceRepo, targetRepo },
        });
    }
    const graph = graphFromRecords(records, overlays, new Map(), "store", logicalThreads, repoIdentities);
    for (const session of store.sessions ?? []) {
        const node = graph.nodes.get(session.canonicalKey);
        const explicit = labelByTarget.get(session.id) ?? session.metadata?.displayName;
        if (node && explicit)
            node.label = explicit;
        if (node)
            node.displayName = displayNameByTarget.get(session.id) ?? session.metadata?.displayName;
        if (node)
            node.pinnedLineageName = pinnedLineageNameByTarget.get(session.id);
        if (node)
            node.provider = session.provider ?? session.metadata?.provider;
    }
    const compactionCounts = new Map();
    for (const compaction of store.compactionEvents ?? [])
        compactionCounts.set(compaction.sessionId, (compactionCounts.get(compaction.sessionId) ?? 0) + (compaction.eventCount ?? compaction.summaryEventCount ?? 1));
    for (const [sessionId, count] of compactionCounts) {
        const session = sessionsById.get(sessionId);
        const node = session ? graph.nodes.get(session.canonicalKey) : undefined;
        if (node)
            node.compactionCount = count;
    }
    graph.compactionEvents = store.compactionEvents;
    graph.temporalActivitySpans = store.temporalActivitySpans;
    graph.workBursts = store.workBursts;
    graph.activityMetrics = store.activityMetrics;
    return graph;
}
async function buildLegacyGraph() {
    const manifestRecords = await readManifest();
    const overlays = await readOverlays();
    const aliases = new Map(overlays.filter((record) => record.kind === "alias").map((record) => [record.path, record.label]));
    return graphFromRecords([...overlayEdges(overlays), ...manifestRecords], overlays, aliases, "legacy");
}
async function buildGraph(inputPath) {
    const store = await readJson(inputPath ?? graphExportFile()) ?? await readJson(curatedStoreFile());
    return buildStoreGraph(store ?? {}) ?? await buildLegacyGraph();
}
function currentSession(ctx) {
    return ctx.sessionManager.getSessionFile();
}
function lineageFor(graph, session) {
    if (!session)
        return [];
    const lineage = [];
    const seen = new Set();
    let record = graph.byDestination.get(session);
    while (record && !seen.has(record.destinationSession)) {
        lineage.unshift(record);
        seen.add(record.destinationSession);
        record = graph.byDestination.get(record.sourceSession) ?? graph.byDestination.get(record.parent ?? "");
    }
    return lineage;
}
function leaves(graph) {
    const sourceSet = new Set(graph.records.filter((record) => record.sourceSession !== record.destinationSession).map((record) => record.sourceSession));
    return [...graph.nodes.values()].filter((node) => !sourceSet.has(node.path));
}
function roots(graph) {
    const destinationSet = new Set(graph.records.filter((record) => record.sourceSession !== record.destinationSession).map((record) => record.destinationSession));
    return [...graph.nodes.values()].filter((node) => !destinationSet.has(node.path));
}
function forks(graph) {
    return [...graph.children.entries()].filter(([, records]) => records.length > 1);
}
function formatHop(record, index, current, files = false) {
    const currentMark = record.destinationSession === current ? " current" : "";
    const confidence = record.confidence ? ` confidence=${record.confidence}` : "";
    const lines = [`${index}. [${marker(record)}${confidence}] ${cwdLabel(record.fromCwd)} -> ${cwdLabel(record.toCwd)}${currentMark}`, `   ${record.ts}`];
    if (files) {
        lines.push(`   source: ${shortPath(record.sourceSession)}`);
        lines.push(`   dest:   ${shortPath(record.destinationSession)}`);
    }
    return lines;
}
function rebuildGraph(graph, records, nodes = graph.nodes) {
    const referenced = new Set(records.flatMap((record) => [record.sourceSession, record.destinationSession]));
    const keptNodes = new Map([...nodes.entries()].filter(([path]) => referenced.has(path)));
    const children = new Map();
    const byDestination = new Map();
    for (const record of records) {
        const list = children.get(record.sourceSession) ?? [];
        list.push(record);
        children.set(record.sourceSession, list);
        byDestination.set(record.destinationSession, record);
    }
    return { records, nodes: keptNodes, children, byDestination, overlays: graph.overlays, aliases: graph.aliases, source: graph.source, logicalThreads: graph.logicalThreads, repoIdentities: graph.repoIdentities };
}
function componentGraph(graph, current) {
    if (!current || !graph.nodes.has(current))
        return graph;
    const keep = new Set([current]);
    const queue = [current];
    while (queue.length) {
        const path = queue.shift();
        const parent = graph.byDestination.get(path);
        if (parent && !keep.has(parent.sourceSession)) {
            keep.add(parent.sourceSession);
            queue.push(parent.sourceSession);
        }
        for (const child of graph.children.get(path) ?? []) {
            if (!keep.has(child.destinationSession)) {
                keep.add(child.destinationSession);
                queue.push(child.destinationSession);
            }
        }
    }
    const records = graph.records.filter((record) => keep.has(record.sourceSession) && keep.has(record.destinationSession));
    const nodes = new Map([...graph.nodes.entries()].filter(([path]) => keep.has(path)));
    return rebuildGraph(graph, records, nodes);
}
const confidenceRank = new Map([["low", 1], ["medium", 2], ["filename-and-session-bucket", 2], ["high", 3], ["authoritative", 4]]);
function parseCsvOption(args, name) {
    const prefix = `${name}=`;
    const inline = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
    const index = args.indexOf(name);
    const value = inline ?? (index >= 0 ? args[index + 1] : undefined);
    return value ? new Set(value.split(",").map((part) => part.trim()).filter(Boolean)) : undefined;
}
function optionValue(args, name) {
    const prefix = `${name}=`;
    const inline = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
    const index = args.indexOf(name);
    return inline ?? (index >= 0 ? args[index + 1] : undefined);
}
function parseGraphFilters(args) {
    const minIndex = args.indexOf("--min-confidence");
    return {
        minConfidence: optionValue(args, "--min-confidence") ?? (minIndex >= 0 ? args[minIndex + 1] : undefined),
        providers: parseCsvOption(args, "--provider"),
        edgeTypes: parseCsvOption(args, "--edge-type"),
        operationTypes: parseCsvOption(args, "--operation-type"),
        tools: parseCsvOption(args, "--tool"),
        repos: parseCsvOption(args, "--repo"),
    };
}
function recordType(record) {
    return record.edgeType ?? record.lineageKind ?? record.displayLabel ?? marker(record);
}
function edgeStyle(record) {
    const type = recordType(record);
    if (["contradicts", "contested"].includes(type) || record.status === "contested")
        return "-.->";
    if (["supersedes", "obsolete"].includes(type) || record.status === "obsolete")
        return "==>";
    if (record.edgeType === "compaction")
        return "==>";
    return record.inferred ? "-.->" : "-->";
}
function recordPassesFilters(graph, record, filters) {
    if (filters.minConfidence) {
        const threshold = confidenceRank.get(filters.minConfidence) ?? 0;
        const rank = confidenceRank.get(record.confidence ?? "") ?? 0;
        if (rank < threshold)
            return false;
    }
    if (filters.edgeTypes?.size && !filters.edgeTypes.has(recordType(record)))
        return false;
    if (filters.operationTypes?.size && !filters.operationTypes.has(record.operationType ?? ""))
        return false;
    if (filters.tools?.size && !filters.tools.has(record.tool ?? ""))
        return false;
    if (filters.repos?.size) {
        const repoValues = [record.sourceRepo, record.targetRepo].filter(Boolean);
        if (!repoValues.some((repo) => filters.repos?.has(repo) || [...(filters.repos ?? [])].some((filter) => repo.includes(filter))))
            return false;
    }
    if (filters.providers?.size) {
        const fromProvider = graph.nodes.get(record.sourceSession)?.provider;
        const toProvider = graph.nodes.get(record.destinationSession)?.provider;
        if (!fromProvider && !toProvider)
            return false;
        if (fromProvider && !filters.providers.has(fromProvider))
            return false;
        if (toProvider && !filters.providers.has(toProvider))
            return false;
    }
    return true;
}
function filterGraph(graph, filters) {
    const records = graph.records.filter((record) => recordPassesFilters(graph, record, filters));
    return rebuildGraph(graph, records);
}
function filterSummary(filters) {
    const parts = [];
    if (filters.minConfidence)
        parts.push(`min-confidence=${filters.minConfidence}`);
    if (filters.providers?.size)
        parts.push(`provider=${[...filters.providers].join(",")}`);
    if (filters.edgeTypes?.size)
        parts.push(`edge-type=${[...filters.edgeTypes].join(",")}`);
    if (filters.operationTypes?.size)
        parts.push(`operation-type=${[...filters.operationTypes].join(",")}`);
    if (filters.tools?.size)
        parts.push(`tool=${[...filters.tools].join(",")}`);
    if (filters.repos?.size)
        parts.push(`repo=${[...filters.repos].join(",")}`);
    return parts.length ? parts.join("; ") : "none";
}
function graphLegend() {
    return [
        "## Legend",
        "",
        "- `-->` explicit/authoritative continuation edge",
        "- `-.->` inferred, derived, overlay, or lower-confidence edge",
        "- `==>` compaction/checkpoint summary event inside a session",
        "- `★` current session, when known",
        "- Mermaid subgraphs are lane/row delimiters grouped by cwd/repo label",
        "- edge label format: `date / edge type or classification / confidence`",
        "- confidence values include `authoritative`, `high`, `medium`, `low`, and source-specific values such as `filename-and-session-bucket`",
        "- `same_cwd_temporal`: low-confidence cross-provider continuity from same cwd and adjacent time order",
        "- `same_repo_identity_temporal`: medium-confidence continuity from shared repo identity and adjacent time order",
        "- `relocation`: explicit Pi relocation manifest edge",
        "- `repo_move`: repo move manifest edge with top-level `operationType`, `tool`, `sourceRepo`, and `targetRepo` fields",
        "- `pre-manifest-inferred`: curated or reconstructed pre-manifest lineage edge",
        "- `compaction`: Pi summary/checkpoint metadata; continuity-preserving, metadata-only",
        "",
    ].join("\n");
}
function mermaidLabel(value) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, "&quot;").replace(/\r?\n/g, " ");
}
function laneKey(node) {
    return node.label || cwdLabel(node.cwd) || "unknown";
}
function mermaid(graph, current) {
    const lines = ["graph TD"];
    const lanes = new Map();
    for (const node of graph.nodes.values()) {
        const key = laneKey(node);
        const list = lanes.get(key) ?? [];
        list.push(node);
        lanes.set(key, list);
    }
    const sortedLanes = [...lanes.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [index, [label, nodes]] of sortedLanes.entries()) {
        lines.push(`  subgraph LANE_${index}["${mermaidLabel(label)}"]`, "    direction TB");
        for (const node of nodes.sort((a, b) => a.id.localeCompare(b.id))) {
            const currentMark = node.path === current ? " ★" : "";
            lines.push(`    ${node.id}["${mermaidLabel(node.label)}${currentMark}<br/>${node.id}"]`);
        }
        lines.push("  end");
    }
    for (const record of graph.records) {
        const from = graph.nodes.get(record.sourceSession);
        const to = graph.nodes.get(record.destinationSession);
        if (!from || !to)
            continue;
        const style = edgeStyle(record);
        const edgeLabel = [record.ts.slice(0, 10), record.displayLabel ?? record.lineageKind ?? record.edgeType, record.confidence].filter(Boolean).join(" / ");
        lines.push(`  ${from.id} ${style}|${mermaidLabel(edgeLabel)}| ${to.id}`);
    }
    lines.push("", "  subgraph LEGEND[Legend]", "    LEG_EXPLICIT[explicit/authoritative] --> LEG_TARGET[continuation]", "    LEG_INFERRED[inferred/derived/overlay] -.-> LEG_TARGET", "    LEG_COMPACTION[compaction/checkpoint] ==> LEG_TARGET", "    LEG_CURRENT[current session has ★]", "    LEG_LANES[lane boxes group cwd/repo rows]", "    LEG_LABEL[edge label: date / type / confidence]", "  end");
    return lines.join("\n");
}
function timestamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}
function titleFromType(type) {
    return type.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}
function graphExportData(graph) {
    return {
        nodes: [...graph.nodes.values()].map((node) => ({ id: node.id, path: node.path, cwd: node.cwd, label: node.label, displayName: node.displayName, pinnedLineageName: node.pinnedLineageName, provider: node.provider, type: node.type ?? "session", status: node.status, confidence: node.confidence, provenance: node.provenance, scope: node.scope, timestamp: node.timestamp, evidence: node.evidence, metadata: node.metadata, compactionCount: node.compactionCount ?? 0 })),
        edges: graph.records.flatMap((record, index) => {
            const from = graph.nodes.get(record.sourceSession);
            const to = graph.nodes.get(record.destinationSession);
            if (!from || !to)
                return [];
            return [{
                    id: record.id ?? `edge_${index + 1}`,
                    from: from.id,
                    to: to.id,
                    sourceSession: record.sourceSession,
                    destinationSession: record.destinationSession,
                    type: recordType(record),
                    status: record.status,
                    scope: record.scope,
                    confidence: record.confidence ?? "unknown",
                    provider: from.provider || to.provider || "unknown",
                    timestamp: record.ts,
                    label: [record.ts.slice(0, 10), record.displayLabel ?? record.lineageKind ?? record.edgeType, record.confidence].filter(Boolean).join(" / "),
                    operationType: record.operationType,
                    tool: record.tool,
                    mode: record.mode,
                    batchId: record.batchId,
                    sourceRepo: record.sourceRepo,
                    targetRepo: record.targetRepo,
                    inferred: record.inferred,
                    overlay: record.overlay,
                    provenance: record.provenance ?? (record.overlay ? "overlay" : record.inferred ? "derived" : "authoritative/runtime"),
                    evidence: record.evidence,
                    metadata: { fromCwd: record.fromCwd, toCwd: record.toCwd, lineageKind: record.lineageKind, displayLabel: record.displayLabel, edgeType: record.edgeType, operationType: record.operationType, tool: record.tool, mode: record.mode, batchId: record.batchId, sourceRepo: record.sourceRepo, targetRepo: record.targetRepo, ...(record.metadata ?? {}) },
                }];
        }),
    };
}
async function writeHtmlViewer(cwd, graph, options = {}) {
    const dir = options.outputPath ? undefined : join(cwd, "session-graph");
    if (dir)
        await mkdir(dir, { recursive: true });
    const stamp = timestamp();
    const title = options.title ?? "Pi Session Graph Viewer";
    const data = JSON.stringify(graphExportData(graph)).replace(/</g, "\\u003c");
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;color:#d8dee9;background:#111827} header{position:sticky;top:0;background:#0f172a;padding:12px 16px;border-bottom:1px solid #334155;z-index:2} input,select,button{background:#1f2937;color:#e5e7eb;border:1px solid #475569;border-radius:6px;padding:4px 6px;margin-right:8px} main{display:grid;grid-template-columns:1fr 420px;gap:0;height:calc(100vh - 58px)} #graph{overflow:auto;padding:16px}.lane{border:1px solid #334155;border-radius:10px;margin:0 0 14px;padding:10px;background:#172033}.node{display:inline-block;border:1px solid #64748b;border-radius:8px;padding:6px 8px;margin:4px;background:#1e293b;cursor:pointer}.node:hover,.edge:hover,.selected{border-color:#93c5fd;outline:1px solid #93c5fd}.edge{border-left:3px solid #60a5fa;padding:6px 8px;margin:5px;background:#0f172a;cursor:pointer}.edge.low{border-left-color:#f97316}.edge.authoritative{border-left-color:#22c55e}.field{margin:0 0 8px}.field b{color:#cbd5e1}.actions{margin:8px 0}.code{white-space:pre-wrap;background:#020617;border:1px solid #334155;border-radius:8px;padding:8px} aside{border-left:1px solid #334155;padding:16px;background:#0f172a;overflow:auto} .muted{color:#94a3b8}.hidden{display:none}</style>
</head>
<body>
<header>
<strong>${title}</strong>
<input id="search" placeholder="search title/cwd/session/provider" size="34" />
<select id="confidence"><option value="">all confidence</option><option>authoritative</option><option>high</option><option>medium</option><option>low</option><option>unknown</option></select>
<select id="provider"><option value="">all providers</option></select>
<select id="nodeType"><option value="">all node types</option></select>
<select id="edgeType"><option value="">all edge types</option></select>
<select id="operationType"><option value="">all operations</option></select>
<select id="tool"><option value="">all tools</option></select>
<select id="provenance"><option value="">all provenance</option></select>
<select id="status"><option value="">all status</option></select>
<label><input type="checkbox" id="hasEvidence" /> has evidence</label>
<label><input type="checkbox" id="relations" /> contradictions/supersessions</label>
<span class="muted" id="counts"></span>
</header>
<main><section id="graph"></section><aside><h2>Details</h2><div class="actions"><button id="hop1">1-hop</button><button id="hop2">2-hop</button><button id="resetView">reset</button><button id="exportSubgraph">export JSON</button><button id="exportMermaid">export Mermaid</button></div><div id="details" class="code">Select a node or edge.</div></aside></main>
<script>const DATA=${data};
const $=id=>document.getElementById(id); const graph=$('graph'), details=$('details');let selected=null,focus=null;
function uniq(xs){return [...new Set(xs.filter(Boolean))].sort()}function esc(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
for(const p of uniq(DATA.nodes.map(n=>n.provider).concat(DATA.edges.map(e=>e.provider)))) $('provider').append(new Option(p,p));
for(const t of uniq(DATA.nodes.map(n=>n.type))) $('nodeType').append(new Option(t,t));
for(const t of uniq(DATA.edges.map(e=>e.type))) $('edgeType').append(new Option(t,t));
for(const t of uniq(DATA.edges.map(e=>e.operationType))) $('operationType').append(new Option(t,t));
for(const t of uniq(DATA.edges.map(e=>e.tool))) $('tool').append(new Option(t,t));
for(const p of uniq(DATA.nodes.map(n=>n.provenance).concat(DATA.edges.map(e=>e.provenance)))) $('provenance').append(new Option(p,p));
for(const s of uniq(DATA.nodes.map(n=>n.status).concat(DATA.edges.map(e=>e.status)))) $('status').append(new Option(s,s));
function matchText(obj,q){return !q || JSON.stringify(obj).toLowerCase().includes(q)}
function neighborhood(id,hops){let ids=new Set([id]);for(let i=0;i<hops;i++)for(const e of DATA.edges)if(ids.has(e.from)||ids.has(e.to)){ids.add(e.from);ids.add(e.to)}return ids}
function isRelation(e){return ['contradicts','supersedes','obsolete','contested'].includes(e.type)||['obsolete','contested'].includes(e.status)}
function hasEv(x){return x.evidence||(x.metadata&&x.metadata.evidence)}
function currentData(){const q=$('search').value.toLowerCase(), c=$('confidence').value, p=$('provider').value, nt=$('nodeType').value, t=$('edgeType').value, op=$('operationType').value, tool=$('tool').value, prov=$('provenance').value, st=$('status').value, ev=$('hasEvidence').checked, rel=$('relations').checked;let edges=DATA.edges.filter(e=>(!c||e.confidence===c)&&(!p||e.provider===p)&&(!t||e.type===t)&&(!op||e.operationType===op)&&(!tool||e.tool===tool)&&(!prov||e.provenance===prov)&&(!st||e.status===st)&&(!ev||hasEv(e))&&(!rel||isRelation(e))&&matchText(e,q));let ids=new Set(edges.flatMap(e=>[e.from,e.to]));let nodes=DATA.nodes.filter(n=>(!p||n.provider===p)&&(!nt||n.type===nt)&&(!prov||n.provenance===prov)&&(!st||n.status===st)&&(!ev||hasEv(n))&&(!q||matchText(n,q)||ids.has(n.id)));if(focus){nodes=nodes.filter(n=>focus.has(n.id));const keep=new Set(nodes.map(n=>n.id));edges=edges.filter(e=>keep.has(e.from)&&keep.has(e.to))}return {nodes,edges}}
function show(kind,obj){selected={kind,...obj};const rows=[['kind',kind],['id',obj.id],['type',obj.type],['operation',obj.operationType],['tool',obj.tool],['mode',obj.mode],['source repo',obj.sourceRepo],['target repo',obj.targetRepo],['label',obj.label],['confidence',obj.confidence],['provenance',obj.provenance],['timestamp',obj.timestamp],['provider',obj.provider],['path',obj.path],['source',obj.sourceSession],['destination',obj.destinationSession]].filter(([,v])=>v!=null&&v!=='').map(([k,v])=>'<div class="field"><b>'+esc(k)+':</b> '+esc(v)+'</div>').join('');details.innerHTML=rows+'<h3>Metadata / evidence</h3><pre class="code">'+esc(JSON.stringify(obj.metadata??obj,null,2))+'</pre>';render()}
function render(){const {nodes,edges}=currentData();graph.innerHTML='';for(const lane of uniq(nodes.map(n=>n.label))){const box=document.createElement('div');box.className='lane';box.innerHTML='<h3>'+esc(lane)+'</h3>';for(const n of nodes.filter(n=>n.label===lane)){const el=document.createElement('button');el.className='node '+(selected?.id===n.id?'selected':'');el.textContent=n.label+' · '+n.id+(n.compactionCount?' · compact x'+n.compactionCount:'');el.onclick=()=>show('node',n);box.append(el)}graph.append(box)}const edgeBox=document.createElement('div');edgeBox.className='lane';edgeBox.innerHTML='<h3>Edges</h3>';for(const e of edges){const el=document.createElement('div');el.className='edge '+e.confidence+(selected?.id===e.id?' selected':'');el.textContent=e.label+' · '+e.from+' → '+e.to;el.onclick=()=>show('edge',e);edgeBox.append(el)}graph.append(edgeBox);$('counts').textContent=nodes.length+' nodes, '+edges.length+' edges'+(focus?' · focused':'')}
$('hop1').onclick=()=>{if(selected?.kind==='node'){focus=neighborhood(selected.id,1);render()}};$('hop2').onclick=()=>{if(selected?.kind==='node'){focus=neighborhood(selected.id,2);render()}};$('resetView').onclick=()=>{focus=null;render()};$('exportSubgraph').onclick=()=>{details.textContent=JSON.stringify(currentData(),null,2)};$('exportMermaid').onclick=()=>{const {nodes,edges}=currentData(),ids=new Map(nodes.map(n=>[n.id,n]));details.textContent=['graph TD',...nodes.map(n=>'  '+n.id+'["'+n.label.replace(/"/g,'&quot;')+'"]'),...edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).map(e=>'  '+e.from+' -->|'+e.type+'| '+e.to)].join('\n')};
for(const id of ['search','confidence','provider','nodeType','edgeType','operationType','tool','provenance','status','hasEvidence','relations']) $(id).addEventListener('input',render); render();</script>
</body></html>`;
    const htmlPath = options.outputPath ?? join(dir, `session_graph_viewer_${stamp}.html`);
    await writeFile(htmlPath, html, { encoding: "utf8", flag: "wx" });
    return htmlPath;
}
async function writeTemporalHtml(cwd, graph, outputPath, title = "Pi Session Temporal View", defaultGroup = "label") {
    const dir = outputPath ? undefined : join(cwd, "session-graph");
    if (dir)
        await mkdir(dir, { recursive: true });
    const spans = graph.temporalActivitySpans ?? [];
    const bursts = graph.workBursts ?? [];
    const metrics = graph.activityMetrics ?? [];
    const compactions = graph.compactionEvents ?? [];
    const data = JSON.stringify({ spans, bursts, metrics, compactions }).replace(/</g, "\\u003c");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${title}</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;background:#111827;color:#e5e7eb}header{position:sticky;top:0;z-index:2;background:#0f172a;border-bottom:1px solid #334155;padding:12px 16px}.legend{margin-top:8px;padding:8px;border:1px solid #334155;border-radius:8px;background:#172033}button,input,select{background:#1f2937;color:#e5e7eb;border:1px solid #475569;border-radius:6px;padding:4px 6px;margin-right:8px}main{display:grid;grid-template-columns:1fr 360px;height:calc(100vh - 112px)}#timeline{overflow:auto;padding:16px}.lane{margin:0 0 10px}.lane h3{font-size:13px;margin:0 0 4px;color:#cbd5e1}.bar{height:18px;border-radius:4px;background:#60a5fa;margin:2px 0;position:relative;cursor:pointer}.bar.pi{background:#22c55e}.bar.codex{background:#a78bfa}.bar.claude{background:#f59e0b}.burst{height:8px;background:#f97316;border-radius:4px;margin-top:2px}.compact{display:inline-block;background:#eab308;color:#111827;border-radius:10px;padding:1px 6px;margin-left:4px;font-size:11px}.gap{position:absolute;height:100%;border-left:1px dashed #facc15;color:#facc15;font-size:11px;writing-mode:vertical-rl;top:0}aside{border-left:1px solid #334155;padding:16px;background:#0f172a;overflow:auto}.muted{color:#94a3b8}.hidden{display:none}</style></head><body><header><strong>${title}</strong> <input id="search" placeholder="filter provider/cwd/label" size="34"/><select id="group"><option value="label"${defaultGroup === "label" ? " selected" : ""}>project/cwd lane</option><option value="provider"${defaultGroup === "provider" ? " selected" : ""}>provider</option><option value="sessionId"${defaultGroup === "sessionId" ? " selected" : ""}>session</option></select><select id="axis"><option value="compressed">compressed time</option><option value="real">real time</option></select><button id="toggleLegend">toggle legend</button><span id="counts" class="muted"></span><div id="legend" class="legend">Renders prepared <code>graph-export.json</code> temporalActivitySpans, workBursts, activityMetrics, and compactionEvents. Bars show real session timestamps/durations in details. Compressed time collapses inactive gaps over 7 days into labeled breaks; real time is proportional. Orange ticks are store-derived work bursts. Yellow badges are compaction/checkpoint counts. Accrued effort metrics are provider/cwd aggregates exported by agent-session-store.</div></header><main><section id="timeline"></section><aside><h2>Details</h2><pre id="details">Select a span, burst, or metric.</pre></aside></main><script>const DATA=${data};const $=id=>document.getElementById(id),timeline=$('timeline'),details=$('details');
function time(x){const t=Date.parse(x||'');return Number.isFinite(t)?t:0}function esc(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}function keyOf(s,g){return s[g]||s.label||s.cwd||s.provider||'unknown'}function compactCount(s){return DATA.compactions.filter(c=>c.sessionId&&c.sessionId===s.sessionId).reduce((n,c)=>n+(c.eventCount||c.summaryEventCount||1),0)}
function axis(spans){const times=spans.flatMap(s=>[time(s.start),time(s.end)||time(s.start)]).filter(Boolean).sort((a,b)=>a-b);const min=times[0]||0,max0=times.at(-1)||min;const day=86400000,threshold=7*day,keep=day;let removed=0,gaps=[];for(let i=1;i<times.length;i++){const gap=times[i]-times[i-1];if(gap>threshold){removed+=gap-keep;gaps.push({at:times[i]-removed,label:'gap: '+Math.round(gap/day)+' days'})}}return {min,max:max0-removed,gaps,project(t){if($('axis').value==='real')return t;let r=0;for(let i=1;i<times.length;i++){const gap=times[i]-times[i-1];if(gap>threshold&&t>=times[i])r+=gap-keep}return t-r}}}
$('toggleLegend').onclick=()=>$('legend').classList.toggle('hidden');function render(){const q=$('search').value.toLowerCase(),g=$('group').value;const spans=DATA.spans.filter(s=>!q||JSON.stringify(s).toLowerCase().includes(q));const ax=axis(spans);const width=Math.max(900, timeline.clientWidth-40);timeline.innerHTML='';const wrap=document.createElement('div');wrap.style.position='relative';wrap.style.minHeight='24px';if($('axis').value==='compressed')for(const gap of ax.gaps){const ge=document.createElement('div');ge.className='gap';ge.style.left=((gap.at-ax.min)/(ax.max-ax.min))*width+'px';ge.textContent=gap.label;wrap.append(ge)}timeline.append(wrap);const groups=[...new Set(spans.map(s=>keyOf(s,g)))].sort();for(const lane of groups){const box=document.createElement('div');box.className='lane';box.innerHTML='<h3>'+esc(lane)+'</h3>';for(const s of spans.filter(s=>keyOf(s,g)===lane)){const left=ax.max>ax.min?((ax.project(time(s.start))-ax.min)/(ax.max-ax.min))*width:0;const right=ax.max>ax.min?((ax.project(time(s.end)||time(s.start))-ax.min)/(ax.max-ax.min))*width:left+6;const bar=document.createElement('div');bar.className='bar '+esc(s.provider);bar.style.marginLeft=Math.max(0,left)+'px';bar.style.width=Math.max(6,right-left)+'px';bar.textContent=(s.provider||'')+' '+(compactCount(s)?' compact x'+compactCount(s):'');bar.onclick=()=>details.textContent=JSON.stringify({...s,compactionCount:compactCount(s)},null,2);box.append(bar)}timeline.append(box)}const b=document.createElement('div');b.className='lane';b.innerHTML='<h3>Work bursts / accrued effort</h3>';for(const burst of DATA.bursts){const el=document.createElement('div');el.className='burst';el.title=JSON.stringify(burst);el.onclick=()=>details.textContent=JSON.stringify(burst,null,2);b.append(el)}for(const metric of DATA.metrics.slice(0,80)){const el=document.createElement('button');el.textContent=(metric.provider||'provider')+' '+(metric.cwd||'')+' sessions='+metric.sessionCount+' lines='+(metric.lineCount||0);el.onclick=()=>details.textContent=JSON.stringify(metric,null,2);b.append(el)}timeline.append(b);$('counts').textContent=spans.length+' spans, '+DATA.bursts.length+' bursts, '+DATA.compactions.length+' compactions'}for(const id of ['search','group','axis'])$(id).addEventListener('input',render);render();</script></body></html>`;
    const htmlPath = outputPath ?? join(dir, `temporal_graph_${timestamp()}.html`);
    await writeFile(htmlPath, html, { encoding: "utf8", flag: "wx" });
    return htmlPath;
}
async function temporalWriteLines(cwd, graph, outputPath) {
    const htmlPath = await writeTemporalHtml(cwd, graph, outputPath);
    return ["Canonical temporal HTML", "", `Source: ${graph.source}`, `Spans: ${graph.temporalActivitySpans?.length ?? 0}`, `Work bursts: ${graph.workBursts?.length ?? 0}`, `Activity metrics: ${graph.activityMetrics?.length ?? 0}`, `Compactions: ${graph.compactionEvents?.length ?? 0}`, "", "Wrote:", shortPath(htmlPath)];
}
async function writeGraphFiles(cwd, graph, current, filters = {}) {
    const dir = join(cwd, "session-graph");
    await mkdir(dir, { recursive: true });
    const stamp = timestamp();
    const mmd = mermaid(graph, current);
    const md = [
        "# Session graph",
        "",
        `Generated: ${new Date().toISOString()}`,
        `Records: ${graph.records.length}`,
        `Sessions: ${graph.nodes.size}`,
        `Roots: ${roots(graph).length}`,
        `Leaves: ${leaves(graph).length}`,
        `Fork points: ${forks(graph).length}`,
        `Logical threads: ${graph.logicalThreads?.length ?? 0}`,
        `Active filters: ${filterSummary(filters)}`,
        "",
        graphLegend(),
        "```mermaid",
        mmd,
        "```",
        "",
    ].join("\n");
    const mdPath = join(dir, `session_graph_${stamp}.md`);
    const mmdPath = join(dir, `graph_${stamp}.mmd`);
    await writeFile(mdPath, md, { encoding: "utf8", flag: "wx" });
    await writeFile(mmdPath, mmd + "\n", { encoding: "utf8", flag: "wx" });
    return { mdPath, mmdPath };
}
async function listSessionFiles(root = join(agentDir(), "sessions")) {
    const found = [];
    async function walk(dir) {
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            if (entry.isDirectory())
                await walk(path);
            else if (entry.isFile() && entry.name.endsWith(".jsonl"))
                found.push(path);
        }
    }
    await walk(root);
    return found;
}
function statusLines(graph, current, cwd = process.cwd()) {
    const lineage = lineageFor(graph, current);
    const leaf = current ? !graph.children.has(current) : false;
    const node = current ? graph.nodes.get(current) : undefined;
    const chainSources = new Set(lineage.map((record) => record.sourceSession));
    const chainDestinations = new Set(lineage.map((record) => record.destinationSession));
    const lineageForks = graph.records.filter((record) => chainSources.has(record.sourceSession) && !chainDestinations.has(record.destinationSession));
    return [
        "Session graph status",
        "",
        `Current cwd: ${shortPath(cwd)}`,
        `Current session: ${current ? shortPath(current) : "(ephemeral)"}`,
        `Current id: ${current ? sessionId(current) : "(none)"}`,
        `Current display name: ${node?.displayName ?? "(unknown)"}`,
        `Pinned lineage name: ${node?.pinnedLineageName ?? "(unnamed)"}`,
        `Tracked: ${current && graph.byDestination.has(current) ? "yes" : "no"}`,
        `Generation/depth: ${lineage.length}`,
        `Leaf: ${leaf ? "yes" : "no"}`,
        `Lineage split/forks: ${lineageForks.length}`,
        ...(lineageForks.length && node?.pinnedLineageName ? [`Branch naming: forked lineage; use /lineage-name <new-branch-name> if this branch is separate work`] : []),
        `Source: ${graph.source}`,
        `Records: ${graph.records.length}`,
        `Overlay records: ${graph.overlays.length}`,
        `Sessions: ${graph.nodes.size}`,
        `Roots: ${roots(graph).length}`,
        `Leaves: ${leaves(graph).length}`,
        `Fork points: ${forks(graph).length}`,
        `Logical threads: ${graph.logicalThreads?.length ?? 0}`,
        `Repo identities: ${graph.repoIdentities?.length ?? 0}`,
    ];
}
function lineageLines(graph, current, files = false) {
    const lineage = lineageFor(graph, current);
    const lines = ["Session lineage", "", `Current session: ${current ? shortPath(current) : "(ephemeral)"}`];
    if (!current)
        lines.push("", "Current session is ephemeral.");
    else if (!lineage.length)
        lines.push("", "Current session has no recorded ancestry.");
    else {
        lines.push("", "Current chain:");
        for (const [index, record] of lineage.entries())
            lines.push(...formatHop(record, index + 1, current, files));
    }
    return lines;
}
function leavesLines(graph, current, all = false) {
    const view = all ? graph : componentGraph(graph, current);
    const nodes = leaves(view).sort((a, b) => a.label.localeCompare(b.label));
    const lines = [all ? "Session leaves (all)" : "Session leaves (current component)", ""];
    for (const node of nodes)
        lines.push(`- ${node.label}${node.path === current ? " current" : ""} (${node.id})`);
    if (!nodes.length)
        lines.push("(none)");
    return lines;
}
function reposLines(graph) {
    const repos = graph.repoIdentities ?? [];
    const lines = ["Repo identities", "", `Source: ${graph.source}`, `Count: ${repos.length}`, ""];
    for (const repo of repos.slice(0, 30)) {
        lines.push(`- ${repo.displayName ?? repo.stableName} (${repo.confidence ?? "unknown"})`, `  observations: ${repo.observations?.length ?? 0}; events: ${repo.events?.length ?? 0}`);
        for (const event of (repo.events ?? []).slice(0, 3))
            lines.push(`  - ${event.timestamp ?? "unknown"} ${event.eventType}: ${event.summary ?? `${event.fromPath ?? ""} -> ${event.toPath ?? ""}`.trim()}`);
    }
    if (repos.length > 30)
        lines.push(`... ${repos.length - 30} more`);
    if (!repos.length)
        lines.push("No repo identity records found. Run agent-session-store build/export after adding repo-identities.jsonl.");
    return lines;
}
async function htmlWriteLines(cwd, graph) {
    const htmlPath = await writeHtmlViewer(cwd, graph);
    return [
        "Session lineage HTML viewer",
        "",
        `Source: ${graph.source}`,
        `Records: ${graph.records.length}`,
        `Sessions: ${graph.nodes.size}`,
        "",
        "Wrote:",
        shortPath(htmlPath),
    ];
}
async function graphWriteLines(cwd, graph, current, all, filters) {
    const written = await writeGraphFiles(cwd, graph, current, filters);
    const lines = [
        all ? "Session lineage Mermaid (all)" : "Session lineage Mermaid (current component)",
        "",
        `Source: ${graph.source}`,
        `Graph export: ${shortPath(graphExportFile())}`,
        `Legacy store fallback: ${shortPath(curatedStoreFile())}`,
        `Manifest fallback: ${shortPath(manifestFile())}`,
        `Overlay fallback: ${shortPath(overlayFile())}`,
        `Active filters: ${filterSummary(filters)}`,
        `Records: ${graph.records.length}`,
        `Overlay records: ${graph.overlays.length}`,
        `Sessions: ${graph.nodes.size}`,
        `Roots: ${roots(graph).length}`,
        `Leaves: ${leaves(graph).length}`,
        `Fork points: ${forks(graph).length}`,
        `Logical threads: ${graph.logicalThreads?.length ?? 0}`,
        `Repo identities: ${graph.repoIdentities?.length ?? 0}`,
        "",
        "Wrote:",
        shortPath(written.mdPath),
        shortPath(written.mmdPath),
        "",
        "Recent edges:",
    ];
    for (const [index, record] of graph.records.slice(-10).entries())
        lines.push(...formatHop(record, graph.records.length - Math.min(10, graph.records.length) + index + 1, current, false));
    return lines;
}
function graphTime(node, records) {
    const candidates = [node.timestamp, ...records.flatMap((record) => record.sourceSession === node.path || record.destinationSession === node.path ? [record.ts] : [])]
        .map((ts) => Date.parse(ts ?? ""))
        .filter(Number.isFinite);
    return candidates.length ? Math.min(...candidates) : 0;
}
function lineageSvgHtml(graph, type, stamp) {
    const title = `${stamp} — ${titleFromType(type)}`;
    const edgeNodes = new Set(graph.records.flatMap((record) => [record.sourceSession, record.destinationSession]));
    const nodes = [...graph.nodes.values()]
        .filter((node) => type === "lineage-full" || edgeNodes.has(node.path))
        .sort((a, b) => graphTime(a, graph.records) - graphTime(b, graph.records) || a.label.localeCompare(b.label));
    const keep = new Set(nodes.map((node) => node.path));
    const edges = graph.records.filter((record) => keep.has(record.sourceSession) && keep.has(record.destinationSession));
    const width = Math.max(1200, nodes.length * 170 + 220);
    const height = Math.max(700, Math.min(2200, 160 + Math.ceil(nodes.length / 6) * 130));
    const lanes = [...new Set(nodes.map((node) => node.label || node.cwd || "unknown"))].sort();
    const laneY = new Map(lanes.map((lane, index) => [lane, 100 + (index % Math.max(1, Math.floor((height - 180) / 90))) * 90]));
    const positions = new Map();
    nodes.forEach((node, index) => positions.set(node.path, { x: 120 + index * 170, y: laneY.get(node.label || node.cwd || "unknown") ?? 120 }));
    const lines = [
        `<svg id="graph-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`,
        `<style>.edge{stroke:#60a5fa;stroke-width:1.5;fill:none;opacity:.65}.node{fill:#1e293b;stroke:#93c5fd;stroke-width:1.2}.label{font:12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#e5e7eb}.small{font:10px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#94a3b8}.lane{stroke:#334155;stroke-width:1;stroke-dasharray:4 4}</style>`,
        ...lanes.map((lane) => `<text class="small" x="12" y="${(laneY.get(lane) ?? 100) - 32}">${escapeHtml(lane)}</text><line class="lane" x1="0" y1="${(laneY.get(lane) ?? 100) - 25}" x2="${width}" y2="${(laneY.get(lane) ?? 100) - 25}"/>`),
    ];
    for (const edge of edges) {
        const from = positions.get(edge.sourceSession), to = positions.get(edge.destinationSession);
        if (!from || !to)
            continue;
        const mid = Math.max(25, Math.abs(to.x - from.x) / 2);
        lines.push(`<path class="edge" d="M ${from.x + 130} ${from.y + 22} C ${from.x + mid} ${from.y - 35}, ${to.x - mid} ${to.y - 35}, ${to.x} ${to.y + 22}"><title>${escapeHtml(`${edge.ts} ${edge.displayLabel ?? edge.lineageKind ?? edge.edgeType ?? "edge"}`)}</title></path>`);
    }
    for (const node of nodes) {
        const pos = positions.get(node.path);
        lines.push(`<g><rect class="node" x="${pos.x}" y="${pos.y}" rx="8" width="138" height="50"><title>${escapeHtml(node.path)}</title></rect><text class="label" x="${pos.x + 8}" y="${pos.y + 20}">${escapeHtml(node.label).slice(0, 22)}</text><text class="small" x="${pos.x + 8}" y="${pos.y + 38}">${escapeHtml(node.id)}</text></g>`);
    }
    lines.push(`</svg>`);
    return htmlShell(title, `<p>${type === "lineage-full" ? "All known session graph nodes with available edges." : "Only sessions participating in relocation/session-move/repo-move/overlay edges."} No Mermaid is used.</p><div class="wrap">${lines.join("\n")}</div><h2>Edges</h2><ol>${edges.map((edge) => `<li>${escapeHtml(edge.ts)} — ${escapeHtml(pathLabel(edge.fromCwd, edge.sourceSession))} → ${escapeHtml(pathLabel(edge.toCwd, edge.destinationSession))}</li>`).join("\n")}</ol>`);
}
function timelineHtml(graph, type, stamp) {
    const title = `${stamp} — ${titleFromType(type)}`;
    const groupBySession = type === "timeline-sessions";
    const events = graph.records
        .filter((event) => Number.isFinite(Date.parse(event.ts)))
        .sort((a, b) => a.ts.localeCompare(b.ts));
    const groups = [...new Set(events.flatMap((event) => groupBySession ? [event.sourceSession, event.destinationSession] : [pathLabel(event.fromCwd, event.sourceSession), pathLabel(event.toCwd, event.destinationSession)]))].sort();
    const min = Math.min(...events.map((event) => Date.parse(event.ts)), Date.now());
    const max = Math.max(...events.map((event) => Date.parse(event.ts)), min + 1);
    const width = 2200, rowHeight = 34, left = 310, height = Math.max(360, 90 + groups.length * rowHeight);
    const rowY = new Map(groups.map((group, index) => [group, 58 + index * rowHeight]));
    const x = (ts) => left + ((Date.parse(ts) - min) / Math.max(1, max - min)) * (width - left - 80);
    const svg = [`<svg id="timeline-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`, `<style>.row{font:12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#e5e7eb}.grid{stroke:#334155}.event{fill:#fbbf24;stroke:#d97706}.edge{stroke:#22c55e;fill:none;opacity:.75}.small{font:10px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#94a3b8}</style>`];
    for (const group of groups) {
        const y = rowY.get(group);
        svg.push(`<text class="row" x="10" y="${y + 4}">${escapeHtml(shortPath(group)).slice(0, 45)}</text><line class="grid" x1="0" y1="${y + 14}" x2="${width}" y2="${y + 14}"/>`);
    }
    for (const event of events) {
        const source = groupBySession ? event.sourceSession : pathLabel(event.fromCwd, event.sourceSession);
        const dest = groupBySession ? event.destinationSession : pathLabel(event.toCwd, event.destinationSession);
        const sx = x(event.ts), sy = rowY.get(source), dy = rowY.get(dest);
        if (sy == null || dy == null)
            continue;
        svg.push(`<circle class="event" cx="${sx.toFixed(1)}" cy="${sy}" r="5"><title>${escapeHtml(`${event.ts} ${source} -> ${dest}`)}</title></circle><path class="edge" d="M ${sx.toFixed(1)} ${sy} C ${(sx + 35).toFixed(1)} ${sy}, ${(sx + 35).toFixed(1)} ${dy}, ${sx.toFixed(1)} ${dy}"><title>${escapeHtml(event.displayLabel ?? event.lineageKind ?? event.edgeType ?? "edge")}</title></path>`);
    }
    svg.push(`</svg>`);
    return htmlShell(title, `<p>${groupBySession ? "Timeline grouped by individual session file." : "Timeline grouped by project/folder label."} Yellow dots are source events; green curves connect destination rows at the same timestamp.</p><div class="wrap">${svg.join("\n")}</div>`);
}
function htmlShell(title, body) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#111827;color:#e5e7eb;margin:2rem;line-height:1.4}.wrap{height:82vh;overflow:auto;border:1px solid #334155;border-radius:10px;background:#0f172a}svg{width:100%;height:100%}a{color:#93c5fd}ol{max-height:40vh;overflow:auto}.muted{color:#94a3b8}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>\n`;
}
function isFocusedLineageRecord(record) {
    if (record.sourceSession === record.destinationSession)
        return false;
    const type = recordType(record);
    return record.overlay || record.operationType === "repo_move" || record.operationType === "session_relocation" || record.operationType === "bucket_relocation" || ["relocation", "repo_move", "branch", "diverge"].includes(type);
}
async function writeNamedInteractiveViewers(graph) {
    const stamp = timestamp();
    const dir = join(desktopOutputRoot(), "session-graphs");
    await mkdir(dir, { recursive: true });
    const focusedGraph = rebuildGraph(graph, graph.records.filter(isFocusedLineageRecord));
    const lineageFullTitle = `${stamp} — Lineage Full Interactive`;
    const lineageFocusedTitle = `${stamp} — Lineage Focused Interactive`;
    const timelineProjectsTitle = `${stamp} — Timeline Projects Interactive`;
    const timelineSessionsTitle = `${stamp} — Timeline Sessions Interactive`;
    const lineageFullPath = join(dir, `${stamp}-lineage-full-interactive.html`);
    const lineageFocusedPath = join(dir, `${stamp}-lineage-focused-interactive.html`);
    const timelineProjectsPath = join(dir, `${stamp}-timeline-projects-interactive.html`);
    const timelineSessionsPath = join(dir, `${stamp}-timeline-sessions-interactive.html`);
    await writeHtmlViewer(dir, graph, { title: lineageFullTitle, outputPath: lineageFullPath });
    await writeHtmlViewer(dir, focusedGraph, { title: lineageFocusedTitle, outputPath: lineageFocusedPath });
    await writeTemporalHtml(dir, graph, timelineProjectsPath, timelineProjectsTitle, "label");
    await writeTemporalHtml(dir, graph, timelineSessionsPath, timelineSessionsTitle, "sessionId");
    return [lineageFullPath, lineageFocusedPath, timelineProjectsPath, timelineSessionsPath];
}
async function sessionGraphsWriteLines(_graph) {
    const refreshLines = await refreshStoreExport();
    const graph = await buildGraph();
    const interactive = await writeNamedInteractiveViewers(graph);
    return [
        "Session graphs",
        "",
        ...refreshLines,
        "",
        "Wrote interactive viewer files:",
        ...interactive.map(shortPath),
    ];
}
function cliUsage() {
    return [
        "Usage: pigraph <command> [options]",
        "",
        "Commands:",
        "  status              Show current session graph status",
        "  lineage [--files]   Show current session lineage",
        "  leaves [--all]      Show resume leaf suggestions",
        "  repos               Show repo identity summary",
        "  graphs              Rebuild/export and write graph HTML artifacts",
        "",
        "Options:",
        "  --input <path>      Read a specific graph export JSON",
        "  -h, --help          Show this help",
    ].join("\n");
}
async function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
    const subcommand = argv[0];
    if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h")
        return cliUsage();
    const rest = argv.slice(1);
    const flags = new Set(rest);
    const inputPath = optionValue(rest, "--input");
    const graph = await buildGraph(inputPath);
    const current = process.env.PI_SESSION_FILE;
    if (subcommand === "status")
        return statusLines(graph, current, cwd).join("\n");
    if (subcommand === "lineage")
        return lineageLines(graph, current, flags.has("--files")).join("\n");
    if (subcommand === "leaves")
        return leavesLines(graph, current, flags.has("--all")).join("\n");
    if (subcommand === "repos")
        return reposLines(graph).join("\n");
    if (subcommand === "graphs")
        return (await sessionGraphsWriteLines(graph)).join("\n");
    return cliUsage();
}
export default function (pi) {
    pi.registerCommand("session-status", {
        description: "Show current session graph status.",
        handler: async (_args, ctx) => {
            ctx.ui.notify(statusLines(await buildGraph(), currentSession(ctx), ctx.cwd).join("\n"), "info");
        },
    });
    pi.registerCommand("session-lineage", {
        description: "Show current session ancestry chain. Use --files for paths.",
        handler: async (args, ctx) => {
            ctx.ui.notify(lineageLines(await buildGraph(), currentSession(ctx), parseFlags(args).has("--files")).join("\n"), "info");
        },
    });
    pi.registerCommand("session-graphs", {
        description: "Generate timestamped session graph HTML files on the Desktop.",
        handler: async (_args, ctx) => {
            const lines = await sessionGraphsWriteLines(await buildGraph());
            ctx.ui.notify(lines.join("\n"), "info");
        },
    });
}
export { buildGraph, leaves, lineageFor, listSessionFiles, mermaid, roots, runCli, sessionId };
//# sourceMappingURL=index.js.map