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
	sessions?: { id: string; canonicalKey: string; metadata?: { cwd?: string; displayName?: string } }[];
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

function parseFlags(args: string) {
	const parts = args.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
	return new Set(parts.map((part) => part.replace(/^['"]|['"]$/g, "")));
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

function addNode(nodes: Map<string, SessionNode>, path: string, cwd: string, aliases = new Map<string, string>()) {
	if (!path || path.startsWith("(")) return;
	if (!nodes.has(path)) {
		const base = cwdLabel(cwd);
		const alias = aliases.get(cwd);
		const label = alias && alias !== base ? `${base} (${alias})` : base;
		nodes.set(path, { id: sessionId(path), path, cwd, label });
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
	const children = new Map<string, RelocationRecord[]>();
	const byDestination = new Map<string, RelocationRecord>();
	for (const record of records) {
		const list = children.get(record.sourceSession) ?? [];
		list.push(record);
		children.set(record.sourceSession, list);
		byDestination.set(record.destinationSession, record);
	}
	return { records, nodes, children, byDestination, overlays: graph.overlays, aliases: graph.aliases, source: graph.source, logicalThreads: graph.logicalThreads, repoIdentities: graph.repoIdentities };
}

function graphLegend() {
	return [
		"## Legend",
		"",
		"- `-->` explicit/authoritative continuation edge",
		"- `-.->` inferred, derived, overlay, or lower-confidence edge",
		"- `★` current session, when known",
		"- edge label format: `date / edge type or classification / confidence`",
		"- confidence values include `authoritative`, `high`, `medium`, `low`, and source-specific values such as `filename-and-session-bucket`",
		"- `same_cwd_temporal`: low-confidence cross-provider continuity from same cwd and adjacent time order",
		"- `same_repo_identity_temporal`: medium-confidence continuity from shared repo identity and adjacent time order",
		"- `relocation`: explicit Pi relocation manifest edge",
		"- `pre-manifest-inferred`: curated or reconstructed pre-manifest lineage edge",
		"",
	].join("\n");
}

function mermaid(graph: Graph, current?: string) {
	const lines = ["graph TD"];
	for (const node of graph.nodes.values()) {
		const currentMark = node.path === current ? " ★" : "";
		lines.push(`  ${node.id}["${node.label}${currentMark}<br/>${node.id}"]`);
	}
	for (const record of graph.records) {
		const from = graph.nodes.get(record.sourceSession);
		const to = graph.nodes.get(record.destinationSession);
		if (!from || !to) continue;
		const style = record.inferred ? "-.->" : "-->";
		const edgeLabel = [record.ts.slice(0, 10), record.displayLabel ?? record.lineageKind ?? record.edgeType, record.confidence].filter(Boolean).join(" / ");
		lines.push(`  ${from.id} ${style}|${edgeLabel}| ${to.id}`);
	}
	lines.push("", "  subgraph LEGEND[Legend]", "    LEG_EXPLICIT[explicit/authoritative] --> LEG_TARGET[continuation]", "    LEG_INFERRED[inferred/derived/overlay] -.-> LEG_TARGET", "    LEG_CURRENT[current session has ★]", "    LEG_LABEL[edge label: date / type / confidence]", "  end");
	return lines.join("\n");
}

function timestamp() {
	return new Date().toISOString().replace(/[:.]/g, "-");
}

async function writeGraphFiles(cwd: string, graph: Graph, current?: string) {
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

export default function (pi: ExtensionAPI) {
	pi.registerCommand("session-status", {
		description: "Show current session graph status.",
		handler: async (_args, ctx) => {
			const graph = await buildGraph();
			const current = currentSession(ctx);
			const lineage = lineageFor(graph, current);
			const leaf = current ? !graph.children.has(current) : false;
			const lines = [
				"Session graph status",
				"",
				`Current cwd: ${shortPath(ctx.cwd)}`,
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
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerCommand("session-lineage", {
		description: "Show current session ancestry chain. Use --files for paths.",
		handler: async (args, ctx) => {
			const flags = parseFlags(args);
			const graph = await buildGraph();
			const current = currentSession(ctx);
			const lineage = lineageFor(graph, current);
			const lines = ["Session lineage", "", `Current session: ${current ? shortPath(current) : "(ephemeral)"}`];
			if (!current) lines.push("", "Current session is ephemeral.");
			else if (!lineage.length) lines.push("", "Current session has no recorded ancestry.");
			else {
				lines.push("", "Current chain:");
				for (const [index, record] of lineage.entries()) lines.push(...formatHop(record, index + 1, current, flags.has("--files")));
			}
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerCommand("session-leaves", {
		description: "Show graph leaves for the current component. Use --all for all known leaves.",
		handler: async (args, ctx) => {
			const flags = parseFlags(args);
			const full = await buildGraph();
			const current = currentSession(ctx);
			const graph = flags.has("--all") ? full : componentGraph(full, current);
			const nodes = leaves(graph).sort((a, b) => a.label.localeCompare(b.label));
			const lines = [flags.has("--all") ? "Session leaves (all)" : "Session leaves (current component)", ""];
			for (const node of nodes) lines.push(`- ${node.label}${node.path === current ? " current" : ""} (${node.id})`);
			if (!nodes.length) lines.push("(none)");
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerCommand("session-repos", {
		description: "Show repo identity records from the canonical store export.",
		handler: async (_args, ctx) => {
			const graph = await buildGraph();
			const repos = graph.repoIdentities ?? [];
			const lines = ["Repo identities", "", `Source: ${graph.source}`, `Count: ${repos.length}`, ""];
			for (const repo of repos.slice(0, 30)) {
				lines.push(`- ${repo.displayName ?? repo.stableName} (${repo.confidence ?? "unknown"})`, `  observations: ${repo.observations?.length ?? 0}; events: ${repo.events?.length ?? 0}`);
				for (const event of (repo.events ?? []).slice(0, 3)) lines.push(`  - ${event.timestamp ?? "unknown"} ${event.eventType}: ${event.summary ?? `${event.fromPath ?? ""} -> ${event.toPath ?? ""}`.trim()}`);
			}
			if (repos.length > 30) lines.push(`... ${repos.length - 30} more`);
			if (!repos.length) lines.push("No repo identity records found. Run agent-session-store build/export after adding repo-identities.jsonl.");
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerCommand("session-graph", {
		description: "Write timestamped session graph Markdown/Mermaid files and show a summary. Use --all for the full forest.",
		handler: async (args, ctx) => {
			const flags = parseFlags(args);
			const full = await buildGraph();
			const current = currentSession(ctx);
			const graph = flags.has("--all") ? full : componentGraph(full, current);
			const written = await writeGraphFiles(ctx.cwd, graph, current);
			const lines = [
				flags.has("--all") ? "Session graph (all)" : "Session graph (current component)",
				"",
				`Source: ${graph.source}`,
				`Store: ${shortPath(curatedStoreFile())}`,
				`Manifest fallback: ${shortPath(manifestFile())}`,
				`Overlay fallback: ${shortPath(overlayFile())}`,
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
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}

export { buildGraph, leaves, lineageFor, listSessionFiles, mermaid, roots, sessionId };
