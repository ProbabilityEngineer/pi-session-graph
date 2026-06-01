import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const MANIFEST = "relocations.jsonl";
const OVERLAYS = "session-graph/lineage-overlays.jsonl";
const CURATED_STORE = "session-graph/curated-store.json";

type RelocationRecord = {
	ts: string;
	fromCwd: string;
	toCwd: string;
	sourceSession: string;
	destinationSession: string;
	parent?: string;
	replacements?: number | null;
	inferred?: boolean;
	confidence?: string;
	lineageKind?: string;
	displayLabel?: string;
	edgeType?: string;
	overlay?: boolean;
};

type OverlayRecord =
	| { kind: "root"; session: string; historicalCwd?: string; label?: string; confidence?: string }
	| { kind: "edge"; source: string; destination: string; fromCwd?: string; toCwd?: string; ts?: string; confidence?: string; lineageKind?: string }
	| { kind: "alias"; path: string; label: string; note?: string }
	| { kind: "classification"; manifestIndex: number; lineageKind?: string; recordConfidence?: string; continuationConfidence?: string };

type StoreExport = {
	sessions?: { id: string; canonicalKey: string; provider?: string; metadata?: { cwd?: string; displayName?: string; provider?: string } }[];
	edges?: { id: string; sourceSessionId: string; targetSessionId: string; edgeType: string; timestamp?: string; confidence?: string; provenance?: string; metadata?: { fromCwd?: string; toCwd?: string; manifestIndex?: number } }[];
	labels?: { targetType: string; targetId: string; labelType: string; value: string; confidence?: string }[];
	classifications?: { targetType: string; targetId: string; classification: string; confidence?: string; metadata?: { displayLabel?: string } }[];
	logicalThreads?: { id: string; label?: string; metadata?: Record<string, unknown> }[];
	threadMembers?: { threadId: string; sessionId: string; role?: string; ordinal?: number; metadata?: Record<string, unknown> }[];
	repoIdentities?: { id: string; stableName: string; displayName?: string; description?: string; confidence?: string }[];
	repoObservations?: { repoIdentityId: string; path?: string; bucket?: string; remoteUrl?: string; validFrom?: string; validTo?: string; confidence?: string }[];
	repoEvents?: { eventType: string; repoIdentityId?: string; relatedRepoIdentityId?: string; fromPath?: string; toPath?: string; timestamp?: string; confidence?: string; manualReviewRequired?: boolean; summary?: string }[];
};

type SessionNode = {
	id: string;
	path: string;
	cwd: string;
	label: string;
	provider?: string;
};

type LogicalThread = { id: string; label: string; members: { sessionPath: string; role?: string; ordinal?: number }[] };
type RepoIdentity = { id: string; stableName: string; displayName?: string; description?: string; confidence?: string; observations: StoreExport["repoObservations"]; events: StoreExport["repoEvents"] };

type Graph = {
	records: RelocationRecord[];
	nodes: Map<string, SessionNode>;
	children: Map<string, RelocationRecord[]>;
	byDestination: Map<string, RelocationRecord>;
	overlays: OverlayRecord[];
	aliases: Map<string, string>;
	source: "store" | "legacy";
	logicalThreads?: LogicalThread[];
	repoIdentities?: RepoIdentity[];
};

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

function shortHash(value: string) {
	return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function sessionId(path: string) {
	return `ses_${shortHash(path)}`;
}

function shortPath(path: string) {
	if (!path || path.startsWith("(")) return path;
	const home = process.env.HOME;
	return home && path.startsWith(`${home}/`) ? `~/${path.slice(home.length + 1)}` : path;
}

function cwdLabel(cwd: string) {
	if (!cwd || cwd.startsWith("(")) return cwd;
	return basename(cwd) || cwd;
}

function marker(record: RelocationRecord) {
	const kind = record.displayLabel ?? record.lineageKind ?? record.edgeType;
	if (record.overlay) return kind ? `overlay/${kind}` : "overlay";
	if (record.inferred) return kind ? `inferred/${kind}` : "inferred";
	return kind ? `explicit/${kind}` : "explicit";
}

function parseArgs(args: string) {
	return (args.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []).map((part) => part.replace(/^["']|["']$/g, ""));
}

function parseFlags(args: string) {
	return new Set(parseArgs(args));
}
async function readJson<T>(path: string): Promise<T | undefined> {
	try {
		return JSON.parse(await readFile(path, "utf8")) as T;
	} catch {
		return undefined;
	}
}

async function readJsonl<T>(path: string): Promise<T[]> {
	try {
		const raw = await readFile(path, "utf8");
		return raw
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => JSON.parse(line) as T);
	} catch {
		return [];
	}
}

async function readManifest(): Promise<RelocationRecord[]> {
	return readJsonl<RelocationRecord>(manifestFile());
}

async function readOverlays(): Promise<OverlayRecord[]> {
	return readJsonl<OverlayRecord>(overlayFile());
}

function addNode(nodes: Map<string, SessionNode>, path: string, cwd: string, aliases = new Map<string, string>(), provider?: string) {
	if (!path || path.startsWith("(")) return;
	if (!nodes.has(path)) {
		const base = cwdLabel(cwd);
		const alias = aliases.get(cwd);
		const label = alias && alias !== base ? `${base} (${alias})` : base;
		nodes.set(path, { id: sessionId(path), path, cwd, label, provider });
	} else if (provider) {
		nodes.get(path)!.provider = provider;
	}
}

function overlayEdges(overlays: OverlayRecord[]): RelocationRecord[] {
	return overlays.flatMap((record) => {
		if (record.kind !== "edge") return [];
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
		} satisfies RelocationRecord];
	});
}

function graphFromRecords(records: RelocationRecord[], overlays: OverlayRecord[], aliases: Map<string, string>, source: Graph["source"], logicalThreads: LogicalThread[] = [], repoIdentities: RepoIdentity[] = []): Graph {
	const roots = overlays.filter((record) => record.kind === "root");
	const nodes = new Map<string, SessionNode>();
	const children = new Map<string, RelocationRecord[]>();
	const byDestination = new Map<string, RelocationRecord>();
	for (const root of roots) addNode(nodes, root.session, root.historicalCwd ?? root.label ?? "(overlay/root)", aliases);
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

function buildStoreGraph(store: StoreExport): Graph | undefined {
	const sessionsById = new Map((store.sessions ?? []).map((session) => [session.id, session]));
	if (!sessionsById.size || !(store.edges ?? []).length) return undefined;
	const labelByTarget = new Map<string, string>();
	for (const label of store.labels ?? []) {
		if (label.targetType !== "session") continue;
		const previous = labelByTarget.get(label.targetId);
		if (!previous || label.labelType === "lineage" || label.labelType === "display_name") labelByTarget.set(label.targetId, label.value);
	}
	const classificationByEdge = new Map((store.classifications ?? []).filter((item) => item.targetType === "edge").map((item) => [item.targetId, item]));
	const records: RelocationRecord[] = [];
	const overlays: OverlayRecord[] = [];
	const logicalThreads: LogicalThread[] = (store.logicalThreads ?? []).map((thread) => ({
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
	const repoIdentities: RepoIdentity[] = (store.repoIdentities ?? []).map((repo) => ({
		...repo,
		observations: (store.repoObservations ?? []).filter((obs) => obs.repoIdentityId === repo.id),
		events: (store.repoEvents ?? []).filter((event) => event.repoIdentityId === repo.id || event.relatedRepoIdentityId === repo.id),
	}));
	for (const edge of store.edges ?? []) {
		const source = sessionsById.get(edge.sourceSessionId);
		const target = sessionsById.get(edge.targetSessionId);
		if (!source || !target) continue;
		const classification = classificationByEdge.get(edge.id);
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
			overlay: edge.provenance !== "pi-relocate-manifest",
		});
	}
	const graph = graphFromRecords(records, overlays, new Map(), "store", logicalThreads, repoIdentities);
	for (const session of store.sessions ?? []) {
		const node = graph.nodes.get(session.canonicalKey);
		const explicit = labelByTarget.get(session.id) ?? session.metadata?.displayName;
		if (node && explicit) node.label = explicit;
		if (node) node.provider = session.provider ?? session.metadata?.provider;
	}
	return graph;
}

async function buildLegacyGraph(): Promise<Graph> {
	const manifestRecords = await readManifest();
	const overlays = await readOverlays();
	const aliases = new Map(overlays.filter((record) => record.kind === "alias").map((record) => [record.path, record.label]));
	return graphFromRecords([...overlayEdges(overlays), ...manifestRecords], overlays, aliases, "legacy");
}

async function buildGraph(): Promise<Graph> {
	const store = await readJson<StoreExport>(curatedStoreFile());
	return buildStoreGraph(store ?? {}) ?? await buildLegacyGraph();
}

function currentSession(ctx: { sessionManager: { getSessionFile(): string | undefined } }) {
	return ctx.sessionManager.getSessionFile();
}

function lineageFor(graph: Graph, session?: string) {
	if (!session) return [];
	const lineage: RelocationRecord[] = [];
	const seen = new Set<string>();
	let record = graph.byDestination.get(session);
	while (record && !seen.has(record.destinationSession)) {
		lineage.unshift(record);
		seen.add(record.destinationSession);
		record = graph.byDestination.get(record.sourceSession) ?? graph.byDestination.get(record.parent ?? "");
	}
	return lineage;
}

function leaves(graph: Graph) {
	const sourceSet = new Set(graph.records.map((record) => record.sourceSession));
	return [...graph.nodes.values()].filter((node) => !sourceSet.has(node.path));
}

function roots(graph: Graph) {
	const destinationSet = new Set(graph.records.map((record) => record.destinationSession));
	return [...graph.nodes.values()].filter((node) => !destinationSet.has(node.path));
}

function forks(graph: Graph) {
	return [...graph.children.entries()].filter(([, records]) => records.length > 1);
}

function formatHop(record: RelocationRecord, index: number, current?: string, files = false) {
	const currentMark = record.destinationSession === current ? " current" : "";
	const confidence = record.confidence ? ` confidence=${record.confidence}` : "";
	const lines = [`${index}. [${marker(record)}${confidence}] ${cwdLabel(record.fromCwd)} -> ${cwdLabel(record.toCwd)}${currentMark}`, `   ${record.ts}`];
	if (files) {
		lines.push(`   source: ${shortPath(record.sourceSession)}`);
		lines.push(`   dest:   ${shortPath(record.destinationSession)}`);
	}
	return lines;
}

function rebuildGraph(graph: Graph, records: RelocationRecord[], nodes = graph.nodes): Graph {
	const referenced = new Set(records.flatMap((record) => [record.sourceSession, record.destinationSession]));
	const keptNodes = new Map([...nodes.entries()].filter(([path]) => referenced.has(path)));
	const children = new Map<string, RelocationRecord[]>();
	const byDestination = new Map<string, RelocationRecord>();
	for (const record of records) {
		const list = children.get(record.sourceSession) ?? [];
		list.push(record);
		children.set(record.sourceSession, list);
		byDestination.set(record.destinationSession, record);
	}
	return { records, nodes: keptNodes, children, byDestination, overlays: graph.overlays, aliases: graph.aliases, source: graph.source, logicalThreads: graph.logicalThreads, repoIdentities: graph.repoIdentities };
}

function componentGraph(graph: Graph, current?: string) {
	if (!current || !graph.nodes.has(current)) return graph;
	const keep = new Set<string>([current]);
	const queue = [current];
	while (queue.length) {
		const path = queue.shift()!;
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

type GraphFilters = { minConfidence?: string; providers?: Set<string>; edgeTypes?: Set<string> };

const confidenceRank = new Map<string, number>([["low", 1], ["medium", 2], ["filename-and-session-bucket", 2], ["high", 3], ["authoritative", 4]]);

function parseCsvOption(args: string[], name: string) {
	const prefix = `${name}=`;
	const inline = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
	const index = args.indexOf(name);
	const value = inline ?? (index >= 0 ? args[index + 1] : undefined);
	return value ? new Set(value.split(",").map((part) => part.trim()).filter(Boolean)) : undefined;
}

function parseGraphFilters(args: string[]): GraphFilters {
	const minIndex = args.indexOf("--min-confidence");
	return {
		minConfidence: args.find((arg) => arg.startsWith("--min-confidence="))?.split("=")[1] ?? (minIndex >= 0 ? args[minIndex + 1] : undefined),
		providers: parseCsvOption(args, "--provider"),
		edgeTypes: parseCsvOption(args, "--edge-type"),
	};
}

function recordType(record: RelocationRecord) {
	return record.edgeType ?? record.lineageKind ?? record.displayLabel ?? marker(record);
}

function recordPassesFilters(graph: Graph, record: RelocationRecord, filters: GraphFilters) {
	if (filters.minConfidence) {
		const threshold = confidenceRank.get(filters.minConfidence) ?? 0;
		const rank = confidenceRank.get(record.confidence ?? "") ?? 0;
		if (rank < threshold) return false;
	}
	if (filters.edgeTypes?.size && !filters.edgeTypes.has(recordType(record))) return false;
	if (filters.providers?.size) {
		const fromProvider = graph.nodes.get(record.sourceSession)?.provider;
		const toProvider = graph.nodes.get(record.destinationSession)?.provider;
		if (!fromProvider && !toProvider) return false;
		if (fromProvider && !filters.providers.has(fromProvider)) return false;
		if (toProvider && !filters.providers.has(toProvider)) return false;
	}
	return true;
}

function filterGraph(graph: Graph, filters: GraphFilters) {
	const records = graph.records.filter((record) => recordPassesFilters(graph, record, filters));
	return rebuildGraph(graph, records);
}

function filterSummary(filters: GraphFilters) {
	const parts: string[] = [];
	if (filters.minConfidence) parts.push(`min-confidence=${filters.minConfidence}`);
	if (filters.providers?.size) parts.push(`provider=${[...filters.providers].join(",")}`);
	if (filters.edgeTypes?.size) parts.push(`edge-type=${[...filters.edgeTypes].join(",")}`);
	return parts.length ? parts.join("; ") : "none";
}

function graphLegend() {
	return [
		"## Legend",
		"",
		"- `-->` explicit/authoritative continuation edge",
		"- `-.->` inferred, derived, overlay, or lower-confidence edge",
		"- `★` current session, when known",
		"- Mermaid subgraphs are lane/row delimiters grouped by cwd/repo label",
		"- edge label format: `date / edge type or classification / confidence`",
		"- confidence values include `authoritative`, `high`, `medium`, `low`, and source-specific values such as `filename-and-session-bucket`",
		"- `same_cwd_temporal`: low-confidence cross-provider continuity from same cwd and adjacent time order",
		"- `same_repo_identity_temporal`: medium-confidence continuity from shared repo identity and adjacent time order",
		"- `relocation`: explicit Pi relocation manifest edge",
		"- `pre-manifest-inferred`: curated or reconstructed pre-manifest lineage edge",
		"",
	].join("\n");
}

function mermaidLabel(value: string) {
	return value.replace(/\\/g, "\\\\").replace(/"/g, "&quot;").replace(/\r?\n/g, " ");
}

function laneKey(node: SessionNode) {
	return node.label || cwdLabel(node.cwd) || "unknown";
}

function mermaid(graph: Graph, current?: string) {
	const lines = ["graph TD"];
	const lanes = new Map<string, SessionNode[]>();
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
		if (!from || !to) continue;
		const style = record.inferred ? "-.->" : "-->";
		const edgeLabel = [record.ts.slice(0, 10), record.displayLabel ?? record.lineageKind ?? record.edgeType, record.confidence].filter(Boolean).join(" / ");
		lines.push(`  ${from.id} ${style}|${mermaidLabel(edgeLabel)}| ${to.id}`);
	}
	lines.push("", "  subgraph LEGEND[Legend]", "    LEG_EXPLICIT[explicit/authoritative] --> LEG_TARGET[continuation]", "    LEG_INFERRED[inferred/derived/overlay] -.-> LEG_TARGET", "    LEG_CURRENT[current session has ★]", "    LEG_LANES[lane boxes group cwd/repo rows]", "    LEG_LABEL[edge label: date / type / confidence]", "  end");
	return lines.join("\n");
}

function timestamp() {
	return new Date().toISOString().replace(/[:.]/g, "-");
}

function graphExportData(graph: Graph) {
	return {
		nodes: [...graph.nodes.values()].map((node) => ({ id: node.id, path: node.path, cwd: node.cwd, label: node.label, provider: node.provider })),
		edges: graph.records.flatMap((record, index) => {
			const from = graph.nodes.get(record.sourceSession);
			const to = graph.nodes.get(record.destinationSession);
			if (!from || !to) return [];
			return [{
				id: `edge_${index + 1}`,
				from: from.id,
				to: to.id,
				sourceSession: record.sourceSession,
				destinationSession: record.destinationSession,
				type: recordType(record),
				confidence: record.confidence ?? "unknown",
				provider: from.provider || to.provider || "unknown",
				timestamp: record.ts,
				label: [record.ts.slice(0, 10), record.displayLabel ?? record.lineageKind ?? record.edgeType, record.confidence].filter(Boolean).join(" / "),
				inferred: record.inferred,
				overlay: record.overlay,
			}];
		}),
	};
}

async function writeHtmlViewer(cwd: string, graph: Graph) {
	const dir = join(cwd, "session-graph");
	await mkdir(dir, { recursive: true });
	const stamp = timestamp();
	const data = JSON.stringify(graphExportData(graph)).replace(/</g, "\\u003c");
	const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Pi Session Graph Viewer</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;color:#d8dee9;background:#111827} header{position:sticky;top:0;background:#0f172a;padding:12px 16px;border-bottom:1px solid #334155;z-index:2} input,select{background:#1f2937;color:#e5e7eb;border:1px solid #475569;border-radius:6px;padding:4px 6px;margin-right:8px} main{display:grid;grid-template-columns:1fr 360px;gap:0;height:calc(100vh - 58px)} #graph{overflow:auto;padding:16px}.lane{border:1px solid #334155;border-radius:10px;margin:0 0 14px;padding:10px;background:#172033}.node{display:inline-block;border:1px solid #64748b;border-radius:8px;padding:6px 8px;margin:4px;background:#1e293b;cursor:pointer}.node:hover,.edge:hover{border-color:#93c5fd}.edge{border-left:3px solid #60a5fa;padding:6px 8px;margin:5px;background:#0f172a;cursor:pointer}.edge.low{border-left-color:#f97316}.edge.authoritative{border-left-color:#22c55e} aside{border-left:1px solid #334155;padding:16px;background:#0f172a;overflow:auto} .muted{color:#94a3b8}.hidden{display:none}</style>
</head>
<body>
<header>
<strong>Pi Session Graph</strong>
<input id="search" placeholder="search title/cwd/session/provider" size="34" />
<select id="confidence"><option value="">all confidence</option><option>authoritative</option><option>high</option><option>medium</option><option>low</option><option>unknown</option></select>
<select id="provider"><option value="">all providers</option></select>
<select id="edgeType"><option value="">all edge types</option></select>
<span class="muted" id="counts"></span>
</header>
<main><section id="graph"></section><aside><h2>Details</h2><pre id="details">Select a node or edge.</pre></aside></main>
<script>const DATA=${data};
const $=id=>document.getElementById(id); const graph=$('graph'), details=$('details');
function uniq(xs){return [...new Set(xs.filter(Boolean))].sort()}
for(const p of uniq(DATA.nodes.map(n=>n.provider).concat(DATA.edges.map(e=>e.provider)))) $('provider').append(new Option(p,p));
for(const t of uniq(DATA.edges.map(e=>e.type))) $('edgeType').append(new Option(t,t));
function matchText(obj,q){return !q || JSON.stringify(obj).toLowerCase().includes(q)}
function render(){const q=$('search').value.toLowerCase(), c=$('confidence').value, p=$('provider').value, t=$('edgeType').value; graph.innerHTML=''; const visibleEdges=DATA.edges.filter(e=>(!c||e.confidence===c)&&(!p||e.provider===p)&&(!t||e.type===t)&&matchText(e,q)); const ids=new Set(visibleEdges.flatMap(e=>[e.from,e.to])); const visibleNodes=DATA.nodes.filter(n=>(!p||n.provider===p)&&(!q||matchText(n,q)||ids.has(n.id))); for(const lane of uniq(visibleNodes.map(n=>n.label))){const box=document.createElement('div');box.className='lane';box.innerHTML='<h3>'+lane+'</h3>'; for(const n of visibleNodes.filter(n=>n.label===lane)){const el=document.createElement('button');el.className='node';el.textContent=n.label+' · '+n.id;el.onclick=()=>details.textContent=JSON.stringify(n,null,2);box.append(el)} graph.append(box)} const edgeBox=document.createElement('div');edgeBox.className='lane';edgeBox.innerHTML='<h3>Edges</h3>'; for(const e of visibleEdges.filter(e=>matchText(e,q)||visibleNodes.some(n=>n.id===e.from||n.id===e.to))){const el=document.createElement('div');el.className='edge '+e.confidence;el.textContent=e.label+' · '+e.from+' → '+e.to;el.onclick=()=>details.textContent=JSON.stringify(e,null,2);edgeBox.append(el)} graph.append(edgeBox); $('counts').textContent=visibleNodes.length+' nodes, '+visibleEdges.length+' edges'}
for(const id of ['search','confidence','provider','edgeType']) $(id).addEventListener('input',render); render();</script>
</body></html>`;
	const htmlPath = join(dir, `session_graph_viewer_${stamp}.html`);
	await writeFile(htmlPath, html, { encoding: "utf8", flag: "wx" });
	return htmlPath;
}

async function writeGraphFiles(cwd: string, graph: Graph, current?: string, filters: GraphFilters = {}) {
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
	const found: string[] = [];
	async function walk(dir: string) {
		let entries: import("node:fs").Dirent[];
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) await walk(path);
			else if (entry.isFile() && entry.name.endsWith(".jsonl")) found.push(path);
		}
	}
	await walk(root);
	return found;
}

function statusLines(graph: Graph, current: string | undefined, cwd = process.cwd()) {
	const lineage = lineageFor(graph, current);
	const leaf = current ? !graph.children.has(current) : false;
	return [
		"Session graph status",
		"",
		`Current cwd: ${shortPath(cwd)}`,
		`Current session: ${current ? shortPath(current) : "(ephemeral)"}`,
		`Current id: ${current ? sessionId(current) : "(none)"}`,
		`Tracked: ${current && graph.byDestination.has(current) ? "yes" : "no"}`,
		`Generation/depth: ${lineage.length}`,
		`Leaf: ${leaf ? "yes" : "no"}`,
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

function lineageLines(graph: Graph, current: string | undefined, files = false) {
	const lineage = lineageFor(graph, current);
	const lines = ["Session lineage", "", `Current session: ${current ? shortPath(current) : "(ephemeral)"}`];
	if (!current) lines.push("", "Current session is ephemeral.");
	else if (!lineage.length) lines.push("", "Current session has no recorded ancestry.");
	else {
		lines.push("", "Current chain:");
		for (const [index, record] of lineage.entries()) lines.push(...formatHop(record, index + 1, current, files));
	}
	return lines;
}

function leavesLines(graph: Graph, current: string | undefined, all = false) {
	const view = all ? graph : componentGraph(graph, current);
	const nodes = leaves(view).sort((a, b) => a.label.localeCompare(b.label));
	const lines = [all ? "Session leaves (all)" : "Session leaves (current component)", ""];
	for (const node of nodes) lines.push(`- ${node.label}${node.path === current ? " current" : ""} (${node.id})`);
	if (!nodes.length) lines.push("(none)");
	return lines;
}

function reposLines(graph: Graph) {
	const repos = graph.repoIdentities ?? [];
	const lines = ["Repo identities", "", `Source: ${graph.source}`, `Count: ${repos.length}`, ""];
	for (const repo of repos.slice(0, 30)) {
		lines.push(`- ${repo.displayName ?? repo.stableName} (${repo.confidence ?? "unknown"})`, `  observations: ${repo.observations?.length ?? 0}; events: ${repo.events?.length ?? 0}`);
		for (const event of (repo.events ?? []).slice(0, 3)) lines.push(`  - ${event.timestamp ?? "unknown"} ${event.eventType}: ${event.summary ?? `${event.fromPath ?? ""} -> ${event.toPath ?? ""}`.trim()}`);
	}
	if (repos.length > 30) lines.push(`... ${repos.length - 30} more`);
	if (!repos.length) lines.push("No repo identity records found. Run agent-session-store build/export after adding repo-identities.jsonl.");
	return lines;
}

async function htmlWriteLines(cwd: string, graph: Graph) {
	const htmlPath = await writeHtmlViewer(cwd, graph);
	return [
		"Session graph HTML viewer",
		"",
		`Source: ${graph.source}`,
		`Records: ${graph.records.length}`,
		`Sessions: ${graph.nodes.size}`,
		"",
		"Wrote:",
		shortPath(htmlPath),
	];
}

async function graphWriteLines(cwd: string, graph: Graph, current: string | undefined, all: boolean, filters: GraphFilters) {
	const written = await writeGraphFiles(cwd, graph, current, filters);
	const lines = [
		all ? "Session graph (all)" : "Session graph (current component)",
		"",
		`Source: ${graph.source}`,
		`Store: ${shortPath(curatedStoreFile())}`,
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
	for (const [index, record] of graph.records.slice(-10).entries()) lines.push(...formatHop(record, graph.records.length - Math.min(10, graph.records.length) + index + 1, current, false));
	return lines;
}

async function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
	const subcommand = argv[0] ?? "status";
	const rest = argv.slice(1);
	const flags = new Set(rest);
	const graph = await buildGraph();
	const current = process.env.PI_SESSION_FILE;
	const filters = parseGraphFilters(rest);
	if (subcommand === "status") return statusLines(graph, current, cwd).join("\n");
	if (subcommand === "lineage") return lineageLines(graph, current, flags.has("--files")).join("\n");
	if (subcommand === "leaves") return leavesLines(graph, current, flags.has("--all")).join("\n");
	if (subcommand === "repos") return reposLines(graph).join("\n");
	if (subcommand === "html") return htmlWriteLines(cwd, filterGraph(graph, filters)).then((lines) => lines.join("\n"));
	if (subcommand === "mermaid" || subcommand === "graph") {
		const scoped = flags.has("--all") ? graph : graph;
		const filtered = filterGraph(scoped, filters);
		return graphWriteLines(cwd, filtered, current, flags.has("--all"), filters).then((lines) => lines.join("\n"));
	}
	if (subcommand === "temporal") return "Temporal rendering needs canonical temporal activity exports from agent-session-store before this CLI can implement it.";
	return "Usage: pi-session-graph [status|lineage|leaves|repos|mermaid|html|temporal] [--all] [--files] [--min-confidence <level>] [--provider a,b] [--edge-type a,b]";
}

export default function (pi: ExtensionAPI) {
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

	pi.registerCommand("session-leaves", {
		description: "Show graph leaves for the current component. Use --all for all known leaves.",
		handler: async (args, ctx) => {
			ctx.ui.notify(leavesLines(await buildGraph(), currentSession(ctx), parseFlags(args).has("--all")).join("\n"), "info");
		},
	});

	pi.registerCommand("session-repos", {
		description: "Show repo identity records from the canonical store export.",
		handler: async (_args, ctx) => {
			ctx.ui.notify(reposLines(await buildGraph()).join("\n"), "info");
		},
	});

	pi.registerCommand("session-graph", {
		description: "Session graph namespace: status, lineage, leaves, repos, or mermaid (default).",
		handler: async (args, ctx) => {
			const parsed = parseArgs(args);
			const subcommand = parsed[0]?.startsWith("-") ? "mermaid" : parsed[0] ?? "mermaid";
			const rest = subcommand === "mermaid" && parsed[0]?.startsWith("-") ? parsed : parsed.slice(1);
			const flags = new Set(rest);
			const full = await buildGraph();
			const current = currentSession(ctx);
			const filters = parseGraphFilters(rest);
			if (subcommand === "status") return ctx.ui.notify(statusLines(full, current, ctx.cwd).join("\n"), "info");
			if (subcommand === "lineage") return ctx.ui.notify(lineageLines(full, current, flags.has("--files")).join("\n"), "info");
			if (subcommand === "leaves") return ctx.ui.notify(leavesLines(full, current, flags.has("--all")).join("\n"), "info");
			if (subcommand === "repos") return ctx.ui.notify(reposLines(full).join("\n"), "info");
			if (subcommand === "html") return ctx.ui.notify((await htmlWriteLines(ctx.cwd, filterGraph(full, filters))).join("\n"), "info");
			if (subcommand === "temporal") return ctx.ui.notify("Temporal rendering needs canonical temporal activity exports from agent-session-store before this command can be implemented.", "warning");
			if (subcommand !== "mermaid" && subcommand !== "graph") {
				return ctx.ui.notify("Usage: /session-graph [status|lineage|leaves|repos|mermaid|html|temporal] [--all] [--files] [--min-confidence <level>] [--provider a,b] [--edge-type a,b]", "warning");
			}
			const scoped = flags.has("--all") ? full : componentGraph(full, current);
			const graph = filterGraph(scoped, filters);
			ctx.ui.notify((await graphWriteLines(ctx.cwd, graph, current, flags.has("--all"), filters)).join("\n"), "info");
		},
	});
}

export { buildGraph, leaves, lineageFor, listSessionFiles, mermaid, roots, runCli, sessionId };
