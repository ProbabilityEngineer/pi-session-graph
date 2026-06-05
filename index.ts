import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const packageVersion = JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")).version as string;

const MANIFEST = "relocations.jsonl";
const OVERLAYS = "session-graph/lineage-overlays.jsonl";
const CURATED_STORE = "session-graph/curated-store.json";
const GRAPH_EXPORT = "session-store/graph-export.json";

type RelocationRecord = {
	id?: string;
	ts: string;
	fromCwd: string;
	toCwd: string;
	sourceSession: string;
	destinationSession: string;
	parent?: string;
	replacements?: number | null;
	inferred?: boolean;
	confidence?: string;
	provenance?: string;
	status?: string;
	scope?: string;
	lineageKind?: string;
	displayLabel?: string;
	edgeType?: string;
	overlay?: boolean;
	evidence?: unknown;
	operationType?: string;
	tool?: string;
	mode?: string;
	batchId?: string;
	sourceRepo?: string;
	targetRepo?: string;
	metadata?: Record<string, unknown>;
};

type OverlayRecord =
	| { kind: "root"; session: string; historicalCwd?: string; label?: string; confidence?: string }
	| { kind: "edge"; source: string; destination: string; fromCwd?: string; toCwd?: string; ts?: string; confidence?: string; lineageKind?: string }
	| { kind: "alias"; path: string; label: string; note?: string }
	| { kind: "classification"; manifestIndex: number; lineageKind?: string; recordConfidence?: string; continuationConfidence?: string };

type GenericNode = { id: string; type?: string; kind?: string; label?: string; title?: string; status?: string; confidence?: string; provenance?: string; provider?: string; scope?: string; created_at?: string; createdAt?: string; timestamp?: string; metadata?: Record<string, unknown>; evidence?: unknown };
type GenericEdge = { id?: string; type?: string; kind?: string; from?: string; to?: string; source?: string; target?: string; from_id?: string; to_id?: string; sourceId?: string; targetId?: string; status?: string; confidence?: string; provenance?: string; scope?: string; created_at?: string; createdAt?: string; timestamp?: string; metadata?: Record<string, unknown>; evidence?: unknown };

type MetricMetadata = Record<string, unknown> & { timestampCoverage?: Record<string, unknown>; visitRowMetrics?: Record<string, unknown>; activeTime?: Record<string, unknown>; rowMetrics?: Record<string, unknown> };

type StoreExport = {
	nodes?: GenericNode[];
	sessions?: { id: string; canonicalKey: string; provider?: string; providerSessionId?: string; startTimestamp?: string; endTimestamp?: string; lineCount?: number; byteCount?: number; metadata?: MetricMetadata & { cwd?: string; displayName?: string; provider?: string; repoIdentityId?: string } }[];
	edges?: ({ id: string; sourceSessionId: string; targetSessionId: string; edgeType: string; timestamp?: string; confidence?: string; provenance?: string; operationType?: string; tool?: string; mode?: string; batchId?: string; sourceRepo?: string; targetRepo?: string; metadata?: MetricMetadata & { fromCwd?: string; toCwd?: string; manifestIndex?: number; operationType?: string; tool?: string; mode?: string; batchId?: string; sourceRepo?: string; targetRepo?: string } } | GenericEdge)[];
	labels?: { targetType: string; targetId: string; labelType: string; value: string; confidence?: string }[];
	classifications?: { targetType: string; targetId: string; classification: string; confidence?: string; metadata?: { displayLabel?: string } }[];
	logicalThreads?: { id: string; label?: string; metadata?: Record<string, unknown> }[];
	threadMembers?: { threadId: string; sessionId: string; role?: string; ordinal?: number; metadata?: Record<string, unknown> }[];
	repoIdentities?: { id: string; stableName: string; displayName?: string; description?: string; confidence?: string }[];
	repoObservations?: { repoIdentityId: string; path?: string; bucket?: string; remoteUrl?: string; validFrom?: string; validTo?: string; confidence?: string }[];
	repoEvents?: { eventType: string; repoIdentityId?: string; relatedRepoIdentityId?: string; fromPath?: string; toPath?: string; timestamp?: string; confidence?: string; manualReviewRequired?: boolean; summary?: string; operationType?: string; tool?: string; sourceRepo?: string; targetRepo?: string; metadata?: Record<string, unknown> }[];
	compactionEvents?: { id: string; sessionId: string; timestamp?: string; confidence?: string; eventCount?: number; summaryEventCount?: number; compactedLineCount?: number; compactedCharCount?: number; firstCompactionAt?: string; lastCompactionAt?: string; summary?: string; metadata?: { path?: string; eventCount?: number; summaryEventCount?: number } }[];
	temporalActivitySpans?: { id: string; sessionId?: string; repoIdentityId?: string; provider?: string; cwd?: string; label?: string; start?: string; end?: string; lineCount?: number; byteCount?: number; activityScore?: number; activeMinutes?: number; activeHours?: number; workBlockCount?: number; visitRows?: number; metricConfidence?: string; confidence?: string; provenance?: string }[];
	workBursts?: { id: string; repoIdentityId?: string; sessionIds?: string[]; providers?: string[]; start?: string; end?: string; sessionCount?: number; confidence?: string; provenance?: string }[];
	activeTimeMetrics?: { id: string; project?: string; repoIdentityId?: string; displayName?: string; contributingPaths?: string[]; activeMinutes?: number; activeHours?: number; workBlockCount?: number; sessionCount?: number; sessionIds?: string[]; providers?: string[]; idleThresholdMinutes?: number; confidence?: string; provenance?: string; metadata?: Record<string, unknown> }[];
	activityMetrics?: { id: string; provider?: string; cwd?: string; sessionCount?: number; eventCount?: number; messageCount?: number; toolCount?: number; lineCount?: number; byteCount?: number; activityScore?: number; activeMinutes?: number; activeHours?: number; workBlockCount?: number; visitRows?: number; firstStart?: string; lastEnd?: string; confidence?: string; provenance?: string; missingDataNotes?: string[] }[];
};

type SessionNode = {
	id: string;
	path: string;
	cwd: string;
	label: string;
	displayName?: string;
	pinnedLineageName?: string;
	provider?: string;
	type?: string;
	status?: string;
	confidence?: string;
	provenance?: string;
	scope?: string;
	timestamp?: string;
	evidence?: unknown;
	metadata?: Record<string, unknown>;
	compactionCount?: number;
	lineCount?: number;
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
	compactionEvents?: StoreExport["compactionEvents"];
	temporalActivitySpans?: StoreExport["temporalActivitySpans"];
	workBursts?: StoreExport["workBursts"];
	activeTimeMetrics?: StoreExport["activeTimeMetrics"];
	activityMetrics?: StoreExport["activityMetrics"];
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

function graphExportFile() {
	return join(agentDir(), GRAPH_EXPORT);
}

function desktopOutputRoot() {
	return join(process.env.HOME ?? ".", "Desktop");
}

function packageRoot() {
	const here = dirname(fileURLToPath(import.meta.url));
	return basename(here) === "dist" ? join(here, "..") : here;
}

function agentSessionStoreBinCandidates() {
	const root = packageRoot();
	const suffix = process.platform === "win32" ? ".cmd" : "";
	return [
		process.env.AGENT_SESSION_STORE_BIN,
		join(root, "node_modules", ".bin", `agent-session-store${suffix}`),
		join(root, "..", ".bin", `agent-session-store${suffix}`),
		join(root, "..", "node_modules", ".bin", `agent-session-store${suffix}`),
		join(root, "..", "agent-session-store", "dist", "bin", "agent-session-store.js"),
		"agent-session-store",
	].filter((value): value is string => Boolean(value));
}

async function runAgentSessionStore(command: "build" | "build-store" | "export-graph" | "build-graphs") {
	const errors: string[] = [];
	for (const bin of agentSessionStoreBinCandidates()) {
		try {
			const { stdout, stderr } = await execFileAsync(bin, [command], { env: process.env });
			return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			errors.push(`${bin}: ${message}`);
		}
	}
	throw new Error(`Unable to run bundled agent-session-store. Install dependencies or set AGENT_SESSION_STORE_BIN. Attempts:\n${errors.join("\n")}`);
}

async function refreshStoreExport(): Promise<string[]> {
	const build = await runAgentSessionStore("build");
	const exportGraph = await runAgentSessionStore("export-graph");
	return [
		"Refreshed graph export",
		"Backend: agent-session-store",
		...(build ? [build] : []),
		...(exportGraph ? [exportGraph] : []),
	];
}

function shortHash(value: string) {
	return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function sessionId(path: string) {
	return `ses_${shortHash(path)}`;
}

function fieldString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value : undefined;
}

function contractField(edge: { operationType?: string; tool?: string; mode?: string; batchId?: string; sourceRepo?: string; targetRepo?: string; metadata?: Record<string, unknown> }, key: "operationType" | "tool" | "mode" | "batchId" | "sourceRepo" | "targetRepo") {
	return fieldString(edge[key]) ?? fieldString(edge.metadata?.[key]);
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

function normalizeRepoPath(path: string) {
	return path
		.replace(/^\/users\/sam\//, "/Users/sam/")
		.replace(/^\/Users\/sam\/(?:Users|users)\/sam\//, "/Users/sam/")
		.replace(/^\/Users\/sam\/users-sam-git-agents-/, "/Users/sam/git/agents/")
		.replace(/^users-sam-git-agents-/, "/Users/sam/git/agents/")
		.replace(/^\/Users\/sam\/users-sam-git-/, "/Users/sam/git/")
		.replace(/^users-sam-git-/, "/Users/sam/git/")
		.replace(/^users-sam-/, "/Users/sam/");
}

function bucketLabel(path: string) {
	const bucket = path.match(/\/sessions\/--(.+?)--\//)?.[1];
	if (!bucket) return undefined;
	const rules: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
		[/^Users-sam-git-agents-(.+)$/, (match) => `/Users/sam/git/agents/${match[1]}`],
		[/^Users-sam-git-public-(.+)$/, (match) => `/Users/sam/git/public/${match[1]}`],
		[/^Users-sam-git-private-tools-(.+)$/, (match) => `/Users/sam/git/private-tools/${match[1]}`],
		[/^Users-sam-git-private-utilities-(.+)$/, (match) => `/Users/sam/git/private-utilities/${match[1]}`],
		[/^Users-sam-git-utilities-(.+)$/, (match) => `/Users/sam/git/utilities/${match[1]}`],
		[/^Users-sam-git-(.+)$/, (match) => `/Users/sam/git/${match[1]}`],
		[/^Users-sam-Documents-GitHub-(.+)$/, (match) => `/Users/sam/Documents/GitHub/${match[1]}`],
		[/^Users-sam-(.+)$/, (match) => `/Users/sam/${match[1]}`],
	];
	for (const [pattern, format] of rules) {
		const match = bucket.match(pattern);
		if (match) return normalizeRepoPath(format(match));
	}
	return normalizeRepoPath(bucket);
}

function repoIdentityDisplay(graph: Graph | undefined, repoIdentityId: unknown) {
	if (typeof repoIdentityId !== "string" || !repoIdentityId) return undefined;
	const repo = graph?.repoIdentities?.find((identity) => identity.id === repoIdentityId);
	return repo?.displayName ?? repo?.stableName ?? repoIdentityId;
}

function repoLabelForNode(node: SessionNode, graph?: Graph) {
	const identityLabel = repoIdentityDisplay(graph, node.metadata?.repoIdentityId);
	if (identityLabel) return identityLabel;
	if (node.cwd && node.cwd.startsWith("/")) return normalizeRepoPath(node.cwd);
	const bucket = bucketLabel(node.path);
	if (bucket?.startsWith("/")) return bucket;
	return bucket ?? (node.cwd && !node.cwd.startsWith("(") ? node.cwd : undefined) ?? node.label ?? "unknown";
}

function pathLabel(cwd: string | undefined, path: string) {
	return cwd && !cwd.startsWith("(") ? cwdLabel(cwd) : cwdLabel(path);
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

function addNode(nodes: Map<string, SessionNode>, path: string, cwd: string, aliases = new Map<string, string>(), provider?: string, compactionCount?: number, extra: Partial<SessionNode> = {}) {
	if (!path || path.startsWith("(")) return;
	if (!nodes.has(path)) {
		const base = cwdLabel(cwd);
		const alias = aliases.get(cwd);
		const label = extra.label ?? (alias && alias !== base ? `${base} (${alias})` : base);
		nodes.set(path, { id: extra.id ?? sessionId(path), path, cwd, label, provider, compactionCount, ...extra });
	} else {
		const node = nodes.get(path)!;
		if (provider) node.provider = provider;
		if (compactionCount != null) node.compactionCount = (node.compactionCount ?? 0) + compactionCount;
		Object.assign(node, Object.fromEntries(Object.entries(extra).filter(([, value]) => value != null)));
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

function edgeEndpoint(edge: GenericEdge, side: "from" | "to") {
	return side === "from" ? edge.from ?? edge.source ?? edge.from_id ?? edge.sourceId : edge.to ?? edge.target ?? edge.to_id ?? edge.targetId;
}

function buildGenericGraph(store: StoreExport): Graph | undefined {
	const genericNodes = store.nodes ?? [];
	const genericEdges = (store.edges ?? []).filter((edge): edge is GenericEdge => !("sourceSessionId" in edge) && edgeEndpoint(edge, "from") != null && edgeEndpoint(edge, "to") != null);
	if (!genericNodes.length && !genericEdges.length) return undefined;
	const nodes = new Map<string, SessionNode>();
	for (const node of genericNodes) addNode(nodes, node.id, String(node.metadata?.cwd ?? node.type ?? node.kind ?? "generic"), new Map(), node.provider, undefined, { id: node.id, type: node.type ?? node.kind, label: node.label ?? node.title ?? node.id, status: node.status, confidence: node.confidence, provenance: node.provenance, scope: node.scope, timestamp: node.timestamp ?? node.created_at ?? node.createdAt, evidence: node.evidence, metadata: node.metadata });
	const records: RelocationRecord[] = [];
	for (const edge of genericEdges) {
		const from = edgeEndpoint(edge, "from")!;
		const to = edgeEndpoint(edge, "to")!;
		addNode(nodes, from, "generic", new Map(), undefined, undefined, { id: from, label: from, type: "unknown" });
		addNode(nodes, to, "generic", new Map(), undefined, undefined, { id: to, label: to, type: "unknown" });
		records.push({ id: edge.id, ts: edge.timestamp ?? edge.created_at ?? edge.createdAt ?? "(generic)", fromCwd: from, toCwd: to, sourceSession: from, destinationSession: to, inferred: edge.provenance === "inferred" || edge.provenance === "derived", confidence: edge.confidence, provenance: edge.provenance, status: edge.status, scope: edge.scope, edgeType: edge.type ?? edge.kind ?? "related_to", displayLabel: edge.type ?? edge.kind, evidence: edge.evidence, metadata: edge.metadata });
	}
	const graph = graphFromRecords(records, [], new Map(), "store");
	graph.nodes = nodes;
	return graph;
}

function buildStoreGraph(store: StoreExport): Graph | undefined {
	const genericGraph = buildGenericGraph(store);
	if (genericGraph && !(store.sessions ?? []).length) return genericGraph;
	const sessionsById = new Map((store.sessions ?? []).map((session) => [session.id, session]));
	if (!sessionsById.size || !(store.edges ?? []).length) return genericGraph;
	const labelByTarget = new Map<string, string>();
	const displayNameByTarget = new Map<string, string>();
	const pinnedLineageNameByTarget = new Map<string, string>();
	for (const label of store.labels ?? []) {
		if (label.targetType !== "session") continue;
		if (label.labelType === "display_name") displayNameByTarget.set(label.targetId, label.value);
		if (label.labelType === "pinned_lineage_name" || label.labelType === "lineage") pinnedLineageNameByTarget.set(label.targetId, label.value);
		const previous = labelByTarget.get(label.targetId);
		if (!previous || label.labelType === "pinned_lineage_name" || label.labelType === "lineage" || label.labelType === "display_name") labelByTarget.set(label.targetId, label.value);
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
	for (const compaction of store.compactionEvents ?? []) {
		const session = sessionsById.get(compaction.sessionId);
		if (!session) continue;
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
		if (!("sourceSessionId" in edge)) continue;
		const source = sessionsById.get(edge.sourceSessionId);
		const target = sessionsById.get(edge.targetSessionId);
		if (!source || !target) continue;
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
		if (node && explicit) node.label = explicit;
		if (node) node.displayName = displayNameByTarget.get(session.id) ?? session.metadata?.displayName;
		if (node) node.pinnedLineageName = pinnedLineageNameByTarget.get(session.id);
		if (node) node.provider = session.provider ?? session.metadata?.provider;
		if (node) node.timestamp = session.startTimestamp ?? node.timestamp;
		if (node) node.lineCount = session.lineCount;
		if (node) node.metadata = { ...(node.metadata ?? {}), ...(session.metadata ?? {}), lineCount: session.lineCount, byteCount: session.byteCount, startTimestamp: session.startTimestamp, endTimestamp: session.endTimestamp };
	}
	const compactionCounts = new Map<string, number>();
	for (const compaction of store.compactionEvents ?? []) compactionCounts.set(compaction.sessionId, (compactionCounts.get(compaction.sessionId) ?? 0) + (compaction.eventCount ?? compaction.summaryEventCount ?? 1));
	for (const [sessionId, count] of compactionCounts) {
		const session = sessionsById.get(sessionId);
		const node = session ? graph.nodes.get(session.canonicalKey) : undefined;
		if (node) node.compactionCount = count;
	}
	graph.compactionEvents = store.compactionEvents;
	graph.temporalActivitySpans = store.temporalActivitySpans;
	graph.workBursts = store.workBursts;
	graph.activeTimeMetrics = store.activeTimeMetrics;
	graph.activityMetrics = store.activityMetrics;
	return graph;
}

async function buildLegacyGraph(): Promise<Graph> {
	const manifestRecords = await readManifest();
	const overlays = await readOverlays();
	const aliases = new Map(overlays.filter((record) => record.kind === "alias").map((record) => [record.path, record.label]));
	return graphFromRecords([...overlayEdges(overlays), ...manifestRecords], overlays, aliases, "legacy");
}

async function buildGraph(inputPath?: string): Promise<Graph> {
	const store = await readJson<StoreExport>(inputPath ?? graphExportFile()) ?? await readJson<StoreExport>(curatedStoreFile());
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
	const sourceSet = new Set(graph.records.filter((record) => record.sourceSession !== record.destinationSession).map((record) => record.sourceSession));
	return [...graph.nodes.values()].filter((node) => !sourceSet.has(node.path));
}

function roots(graph: Graph) {
	const destinationSet = new Set(graph.records.filter((record) => record.sourceSession !== record.destinationSession).map((record) => record.destinationSession));
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

type GraphFilters = { minConfidence?: string; providers?: Set<string>; edgeTypes?: Set<string>; operationTypes?: Set<string>; tools?: Set<string>; repos?: Set<string> };

const confidenceRank = new Map<string, number>([["low", 1], ["medium", 2], ["filename-and-session-bucket", 2], ["high", 3], ["authoritative", 4]]);

function parseCsvOption(args: string[], name: string) {
	const prefix = `${name}=`;
	const inline = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
	const index = args.indexOf(name);
	const value = inline ?? (index >= 0 ? args[index + 1] : undefined);
	return value ? new Set(value.split(",").map((part) => part.trim()).filter(Boolean)) : undefined;
}

function optionValue(args: string[], name: string) {
	const prefix = `${name}=`;
	const inline = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
	const index = args.indexOf(name);
	return inline ?? (index >= 0 ? args[index + 1] : undefined);
}

function parseGraphFilters(args: string[]): GraphFilters {
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

function recordType(record: RelocationRecord) {
	return record.edgeType ?? record.lineageKind ?? record.displayLabel ?? marker(record);
}

function edgeStyle(record: RelocationRecord) {
	const type = recordType(record);
	if (["contradicts", "contested"].includes(type) || record.status === "contested") return "-.->";
	if (["supersedes", "obsolete"].includes(type) || record.status === "obsolete") return "==>";
	if (record.edgeType === "compaction") return "==>";
	return record.inferred ? "-.->" : "-->";
}

function recordPassesFilters(graph: Graph, record: RelocationRecord, filters: GraphFilters) {
	if (filters.minConfidence) {
		const threshold = confidenceRank.get(filters.minConfidence) ?? 0;
		const rank = confidenceRank.get(record.confidence ?? "") ?? 0;
		if (rank < threshold) return false;
	}
	if (filters.edgeTypes?.size && !filters.edgeTypes.has(recordType(record))) return false;
	if (filters.operationTypes?.size && !filters.operationTypes.has(record.operationType ?? "")) return false;
	if (filters.tools?.size && !filters.tools.has(record.tool ?? "")) return false;
	if (filters.repos?.size) {
		const repoValues = [record.sourceRepo, record.targetRepo].filter(Boolean) as string[];
		if (!repoValues.some((repo) => filters.repos?.has(repo) || [...(filters.repos ?? [])].some((filter) => repo.includes(filter)))) return false;
	}
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
	if (filters.operationTypes?.size) parts.push(`operation-type=${[...filters.operationTypes].join(",")}`);
	if (filters.tools?.size) parts.push(`tool=${[...filters.tools].join(",")}`);
	if (filters.repos?.size) parts.push(`repo=${[...filters.repos].join(",")}`);
	return parts.length ? parts.join("; ") : "none";
}

function graphLegend() {
	return [
		"## Legend",
		"",
		"- `-->` explicit/authoritative continuation edge",
		"- `-.->` inferred, derived, overlay, or lower-confidence edge",
		"- `==>` compaction/checkpoint summary event inside a session",
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

function mermaidLabel(value: string) {
	return value.replace(/\\/g, "\\\\").replace(/"/g, "&quot;").replace(/\r?\n/g, " ");
}

function laneKey(node: SessionNode, graph?: Graph) {
	return repoLabelForNode(node, graph);
}

function agentLabel(node: SessionNode) {
	return node.pinnedLineageName ?? node.displayName;
}

function dotEscape(value: unknown) {
	return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\r?\n/g, "\\n");
}

function dotId(value: string) {
	return `n_${shortHash(value)}`;
}

function hslToHex(hue: number, saturation: number, lightness: number) {
	const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
	const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
	const m = lightness - c / 2;
	const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
	return `#${[r, g, b].map((value) => Math.round((value + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function hexRgb(hex: string) {
	const match = hex.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
	return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : [0, 0, 0];
}

function relativeLuminance(hex: string) {
	const values = hexRgb(hex).map((channel) => {
		const value = channel / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrastRatio(a: string, b: string) {
	const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}

function safeAgentColor(baseHue: number, step: number) {
	const avoid = ["#111827", "#3f2f12", "#334155"];
	for (let attempt = 0; attempt < 12; attempt++) {
		const hue = (baseHue + attempt * step / 2) % 360;
		for (const lightness of [0.66, 0.72, 0.78, 0.6]) {
			const color = hslToHex(hue, 0.78, lightness);
			if (avoid.every((background) => contrastRatio(color, background) >= 3)) return color;
		}
	}
	return hslToHex(baseHue, 0.82, 0.74);
}

function agentColorMap(agents: Iterable<string>) {
	const sorted = [...new Set([...agents].filter(Boolean))].sort((a, b) => a.localeCompare(b));
	const map = new Map<string, string>();
	const step = 360 / Math.max(sorted.length, 1);
	const offset = 132;
	for (const [index, agent] of sorted.entries()) map.set(agent, safeAgentColor((offset + index * step) % 360, step));
	return map;
}

function agentColor(colors: Map<string, string>, agent?: string) {
	return agent ? colors.get(agent) ?? "#60a5fa" : "#60a5fa";
}

function dotHtmlLabel(agent: string | undefined, lines: string[], color: string) {
	const body = lines.map((line, index) => {
		const text = escapeHtml(line);
		return index === 0 && agent ? `<FONT COLOR="${color}">${text}</FONT>` : text;
	}).join("<BR/>");
	return `<${body}>`;
}

function metricNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function metricObject(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function activeHoursLabel(metadata?: Record<string, unknown>) {
	const active = metricObject(metadata?.activeTime);
	const hours = metricNumber(active?.activeHours) ?? (metricNumber(active?.activeMinutes) != null ? metricNumber(active?.activeMinutes)! / 60 : undefined);
	return hours != null && hours > 0 ? `active: ${hours.toFixed(hours >= 10 ? 1 : 2)}h` : undefined;
}
function visitRowsLabel(metadata?: Record<string, unknown>) {
	const rows = metricNumber(metricObject(metadata?.visitRowMetrics)?.visitRows);
	return rows != null ? `visit rows: +${rows}` : undefined;
}

function dotGraph(graph: Graph, current?: string, options: { starts?: boolean } = {}) {
	const lines = [
		"digraph SessionLineage {",
		"  graph [rankdir=LR, bgcolor=\"#111827\", pad=0.35, nodesep=0.45, ranksep=0.8, splines=true, overlap=false];",
		"  node [shape=box, style=\"rounded,filled\", fontname=\"Helvetica\", fontsize=10, color=\"#64748b\", fillcolor=\"#1e293b\", fontcolor=\"#e5e7eb\"];",
		"  edge [fontname=\"Helvetica\", fontsize=9, color=\"#60a5fa\", fontcolor=\"#cbd5e1\", arrowsize=0.7];",
	];
	const lanes = new Map<string, SessionNode[]>();
	for (const node of graph.nodes.values()) {
		const key = laneKey(node, graph);
		const list = lanes.get(key) ?? [];
		list.push(node);
		lanes.set(key, list);
	}
	const incomingBySession = new Map<string, RelocationRecord>();
	const outgoingBySession = new Map<string, RelocationRecord[]>();
	for (const record of graph.records) {
		if (!incomingBySession.has(record.destinationSession) || record.ts < (incomingBySession.get(record.destinationSession)?.ts ?? "")) incomingBySession.set(record.destinationSession, record);
		const out = outgoingBySession.get(record.sourceSession) ?? [];
		out.push(record);
		outgoingBySession.set(record.sourceSession, out);
	}
	const propagatedAgent = new Map<string, string>();
	for (const node of graph.nodes.values()) {
		const label = agentLabel(node);
		if (label) propagatedAgent.set(node.path, label);
	}
	for (let pass = 0; pass < 8; pass++) {
		let changed = false;
		for (const record of graph.records) {
			const fromAgent = propagatedAgent.get(record.sourceSession);
			const toAgent = propagatedAgent.get(record.destinationSession);
			if (fromAgent && !toAgent) { propagatedAgent.set(record.destinationSession, fromAgent); changed = true; }
			if (toAgent && !fromAgent) { propagatedAgent.set(record.sourceSession, toAgent); changed = true; }
		}
		if (!changed) break;
	}
	const colors = agentColorMap(propagatedAgent.values());
	let cluster = 0;
	const stateIds: string[] = [];
	for (const [label, nodes] of [...lanes.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		lines.push(`  subgraph cluster_${cluster++} {`, `    label="${dotEscape(`repo: ${label}`)}";`, "    color=\"#334155\";", "    fontcolor=\"#94a3b8\";", "    style=\"rounded,dashed\";");
		for (const node of nodes.sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? "") || a.id.localeCompare(b.id))) {
			const repo = repoLabelForNode(node, graph);
			const agent = agentLabel(node) ?? propagatedAgent.get(node.path);
			const providerLabel = node.provider && node.provider !== "pi" ? `provider: ${node.provider}` : undefined;
			const incoming = incomingBySession.get(node.path);
			const outgoing = (outgoingBySession.get(node.path) ?? []).filter((record) => record.destinationSession !== node.path).sort((a, b) => a.ts.localeCompare(b.ts));
			const activeOrArrivedLabel = outgoing[0]
				? incoming ? `arrived: ${incoming.ts.slice(0, 16)}` : node.timestamp ? `lineage start: ${node.timestamp.slice(0, 16)} (filename)` : undefined
				: `active since: ${(incoming?.ts ?? node.timestamp ?? "unknown").slice(0, 16)}${incoming ? "" : " (filename)"}`;
			const departedLabel = outgoing[0] ? `departed: ${outgoing[0].ts.slice(0, 16)}` : undefined;
			const labelLines = [agent ? `agent: ${agent}` : "session", `repo: ${repo}`, activeOrArrivedLabel, departedLabel, activeHoursLabel(node.metadata), visitRowsLabel(node.metadata), providerLabel].filter(Boolean) as string[];
			const fill = "#3f2f12";
			const nodeAgentColor = agentColor(colors, agent);
			if (options.starts && node.timestamp) {
				const startId = `${dotId(node.id)}_start`;
				lines.push(`    ${startId} [shape=circle, label="start\\n${dotEscape(node.timestamp.slice(0, 16))}", fillcolor="#312e81", color="#818cf8"];`);
				lines.push(`    ${startId} -> ${dotId(node.id)} [label="", color="#818cf8"];`);
			}
			lines.push(`    ${dotId(node.id)} [label=${dotHtmlLabel(agent, labelLines, nodeAgentColor)}, tooltip="${dotEscape(node.path)}", fillcolor="${fill}"];`);
		}
		lines.push("  }");
	}
	const edgesBySource = new Map<string, RelocationRecord[]>();
	for (const record of graph.records) {
		const list = edgesBySource.get(record.sourceSession) ?? [];
		list.push(record);
		edgesBySource.set(record.sourceSession, list);
	}
	for (const [sourceSession, sourceEdges] of edgesBySource) {
		const from = graph.nodes.get(sourceSession);
		if (!from) continue;
		let previousState: string | undefined;
		for (const record of sourceEdges.sort((a, b) => a.ts.localeCompare(b.ts))) {
			const to = graph.nodes.get(record.destinationSession);
			if (!to) continue;
			const type = recordType(record);
			const edgeAgent = agentLabel(from) ?? agentLabel(to) ?? propagatedAgent.get(record.sourceSession) ?? propagatedAgent.get(record.destinationSession) ?? "Agent";
			const fanoutCount = new Set((outgoingBySession.get(record.sourceSession) ?? []).filter((edge) => edge.destinationSession !== record.sourceSession).map((edge) => edge.destinationSession)).size;
			const isBranch = record.mode === "branch" || type === "branch" || fanoutCount > 1;
			const eventLabel = isBranch ? "Branched" : record.inferred || record.overlay || record.confidence !== "authoritative" ? "Inferred Move" : "Moved";
			const confidenceLabel = record.confidence && !["authoritative", "filename-and-session-bucket"].includes(record.confidence) ? record.confidence : undefined;
			const rowMetrics = metricObject(record.metadata?.rowMetrics);
			const rowLabel = metricNumber(rowMetrics?.sourceRowAtMove) != null ? `row ${metricNumber(rowMetrics?.sourceRowAtMove)}` : undefined;
			const label = [`${edgeAgent} ${eventLabel}`, rowLabel, confidenceLabel].filter(Boolean).join("\n");
			const style = record.inferred || record.overlay || record.confidence === "low" ? "dashed" : record.edgeType === "compaction" ? "bold" : "solid";
			const color = record.edgeType === "compaction" ? "#eab308" : record.status === "contested" ? "#f97316" : record.status === "obsolete" ? "#ef4444" : agentColor(colors, edgeAgent);
			if (options.starts) {
				const stateId = `s_${shortHash(`${record.sourceSession}:${record.ts}:${record.id ?? type}`)}`;
				stateIds.push(stateId);
				const stateLabel = [`state @ ${record.ts.slice(0, 16)}`, eventLabel].join("\n");
				lines.push(`  ${stateId} [shape=diamond, label="${dotEscape(stateLabel)}", fillcolor="#78350f", color="#f59e0b"];`);
				lines.push(`  ${dotId(from.id)} -> ${stateId} [label="progression", style=dotted, color="#f59e0b"];`);
				if (previousState) lines.push(`  ${previousState} -> ${stateId} [label="later", style=dotted, color="#f59e0b"];`);
				lines.push(`  ${stateId} -> ${dotId(to.id)} [label="${dotEscape(label)}", style="${style}", color="${color}", fontcolor="${color}", tooltip="${dotEscape(`${record.sourceSession} -> ${record.destinationSession}`)}"];`);
				previousState = stateId;
			} else {
				lines.push(`  ${dotId(from.id)} -> ${dotId(to.id)} [label="${dotEscape(label)}", style="${style}", color="${color}", fontcolor="${color}", tooltip="${dotEscape(`${record.sourceSession} -> ${record.destinationSession}`)}"];`);
			}
		}
	}
	const nodesByAgent = new Map<string, SessionNode[]>();
	for (const node of graph.nodes.values()) {
		const agent = agentLabel(node) ?? propagatedAgent.get(node.path);
		if (!agent) continue;
		const list = nodesByAgent.get(agent) ?? [];
		list.push(node);
		nodesByAgent.set(agent, list);
	}
	for (const [agent, nodes] of nodesByAgent) {
		const ordered = nodes.sort((a, b) => {
			const aTime = incomingBySession.get(a.path)?.ts ?? a.timestamp ?? "";
			const bTime = incomingBySession.get(b.path)?.ts ?? b.timestamp ?? "";
			return aTime.localeCompare(bTime) || a.id.localeCompare(b.id);
		});
		for (let index = 1; index < ordered.length; index++) {
			lines.push(`  ${dotId(ordered[index - 1].id)} -> ${dotId(ordered[index].id)} [style=invis, weight=4, constraint=true, tooltip="${dotEscape(`${agent} chronological layout constraint`)}"];`);
		}
	}
	lines.push("  legend [shape=note, label=\"Graphviz lineage export\\nrepo clusters are containers\\norange boxes are sessions/visits\\nleft-to-right is edge + per-agent time constrained\\nagent names and movement edges share lineage color\\ndashed edge: inferred move\\nBranched label: fan-out from one session\", fillcolor=\"#0f172a\", color=\"#475569\"];");
	lines.push("}");
	return lines.join("\n");
}

function mermaid(graph: Graph, current?: string) {
	const lines = ["graph TD"];
	const lanes = new Map<string, SessionNode[]>();
	for (const node of graph.nodes.values()) {
		const key = laneKey(node, graph);
		const list = lanes.get(key) ?? [];
		list.push(node);
		lanes.set(key, list);
	}
	const sortedLanes = [...lanes.entries()].sort(([a], [b]) => a.localeCompare(b));
	for (const [index, [label, nodes]] of sortedLanes.entries()) {
		lines.push(`  subgraph LANE_${index}["${mermaidLabel(label)}"]`, "    direction TB");
		for (const node of nodes.sort((a, b) => a.id.localeCompare(b.id))) {
			lines.push(`    ${node.id}["${mermaidLabel(node.label)}<br/>${node.id}"]`);
		}
		lines.push("  end");
	}
	for (const record of graph.records) {
		const from = graph.nodes.get(record.sourceSession);
		const to = graph.nodes.get(record.destinationSession);
		if (!from || !to) continue;
		const style = edgeStyle(record);
		const edgeLabel = [record.ts.slice(0, 10), record.displayLabel ?? record.lineageKind ?? record.edgeType, record.confidence].filter(Boolean).join(" / ");
		lines.push(`  ${from.id} ${style}|${mermaidLabel(edgeLabel)}| ${to.id}`);
	}
	lines.push("", "  subgraph LEGEND[Legend]", "    LEG_EXPLICIT[explicit/authoritative] --> LEG_TARGET[continuation]", "    LEG_INFERRED[inferred/derived/overlay] -.-> LEG_TARGET", "    LEG_COMPACTION[compaction/checkpoint] ==> LEG_TARGET", "    LEG_LANES[lane boxes group cwd/repo rows]", "    LEG_LABEL[edge label: date / type / confidence]", "  end");
	return lines.join("\n");
}

function timestamp() {
	return new Date().toISOString().replace(/[:.]/g, "-");
}

function titleFromType(type: string) {
	return type.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

function escapeHtml(value: unknown) {
	return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]!));
}

function graphExportData(graph: Graph) {
	return {
		nodes: [...graph.nodes.values()].map((node) => ({ id: node.id, path: node.path, cwd: node.cwd, repoLabel: repoLabelForNode(node, graph), label: node.label, displayName: node.displayName, pinnedLineageName: node.pinnedLineageName, provider: node.provider, type: node.type ?? "session", status: node.status, confidence: node.confidence, provenance: node.provenance, scope: node.scope, timestamp: node.timestamp, evidence: node.evidence, metadata: node.metadata, compactionCount: node.compactionCount ?? 0, lineCount: node.lineCount })),
		edges: graph.records.flatMap((record, index) => {
			const from = graph.nodes.get(record.sourceSession);
			const to = graph.nodes.get(record.destinationSession);
			if (!from || !to) return [];
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

async function writeHtmlViewer(cwd: string, graph: Graph, options: { title?: string; outputPath?: string } = {}) {
	const dir = options.outputPath ? undefined : join(cwd, "session-graph");
	if (dir) await mkdir(dir, { recursive: true });
	const stamp = timestamp();
	const title = options.title ?? "Pi Session Graph Viewer";
	const exportData = graphExportData(graph);
	const data = JSON.stringify(exportData).replace(/</g, "\\u003c");
	const staticLanes = [...new Set(exportData.nodes.map((node) => node.repoLabel || node.label || "(unlabeled)").filter(Boolean))].sort().slice(0, 80);
	const staticHtml = [`<div class="lane"><h3>Static fallback</h3><p class="muted">If this does not become interactive, JavaScript failed or was blocked. Leave the search box empty to see all nodes; use it only to filter by label, cwd, provider, or session id.</p><p>${exportData.nodes.length} nodes, ${exportData.edges.length} edges embedded in this file.</p></div>`, ...staticLanes.map((lane) => `<div class="lane"><h3>${escapeHtml(lane)}</h3>${exportData.nodes.filter((node) => (node.repoLabel || node.label || "(unlabeled)") === lane).slice(0, 60).map((node) => `<button class="node" type="button">${escapeHtml(node.repoLabel || node.label || "(unlabeled)")} · ${escapeHtml(node.id)}${node.compactionCount ? ` · compact x${node.compactionCount}` : ""}</button>`).join("")}</div>`), `<div class="lane"><h3>Edges preview</h3>${exportData.edges.slice(0, 250).map((edge) => `<div class="edge ${escapeHtml(edge.confidence)}">${escapeHtml(edge.label || edge.type || "edge")} · ${escapeHtml(edge.from)} → ${escapeHtml(edge.to)}</div>`).join("")}</div>`].join("\n");
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
<select id="metricConfidence"><option value="">all metric confidence</option></select>
<label><input type="checkbox" id="hasEvidence" /> has evidence</label>
<label><input type="checkbox" id="hasMetrics" /> has metrics</label>
<label><input type="checkbox" id="lowTimestampCoverage" /> low timestamp coverage</label>
<label><input type="checkbox" id="relations" /> contradictions/supersessions</label>
<span class="muted" id="counts">${exportData.nodes.length} nodes, ${exportData.edges.length} edges</span>
<div class="muted" style="margin-top:6px">Search is optional. Leave it blank to show everything; type a repo/cwd/provider/session fragment only to filter.</div>
</header>
<main><section id="graph">${staticHtml}</section><aside><h2>Details</h2><div class="actions"><button id="hop1">1-hop</button><button id="hop2">2-hop</button><button id="resetView">reset</button><button id="exportSubgraph">export JSON</button><button id="exportMermaid">export Mermaid</button></div><div id="details" class="code">Select a node or edge.</div></aside></main>
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
function metricConf(x){return x&&x.metadata&&((x.metadata.activeTime&&x.metadata.activeTime.confidence)||(x.metadata.visitRowMetrics&&x.metadata.visitRowMetrics.confidence)||(x.metadata.rowMetrics&&x.metadata.rowMetrics.confidence)||(x.metadata.timestampCoverage&&x.metadata.timestampCoverage.confidence))}
for(const c of uniq(DATA.nodes.map(metricConf).concat(DATA.edges.map(metricConf)))) $('metricConfidence').append(new Option(c,c));
function hasMetrics(x){return !!(x&&x.metadata&&(x.metadata.activeTime||x.metadata.visitRowMetrics||x.metadata.rowMetrics||x.metadata.timestampCoverage))}
function lowTs(x){const c=x&&x.metadata&&x.metadata.timestampCoverage&&x.metadata.timestampCoverage.coverage;return typeof c==='number'&&c<0.5}
function metricSummary(x){const m=x&&x.metadata||{},a=m.activeTime,v=m.visitRowMetrics,r=m.rowMetrics,t=m.timestampCoverage,b=[];if(a&&a.activeHours)b.push('active '+a.activeHours+'h');if(v&&v.visitRows!=null)b.push('visit rows +'+v.visitRows);if(r&&r.sourceRowAtMove!=null)b.push('row '+r.sourceRowAtMove);if(t&&t.coverage!=null)b.push('ts '+Math.round(t.coverage*100)+'%');return b.join(' · ')}
function matchText(obj,q){return !q || JSON.stringify(obj).toLowerCase().includes(q)}
function neighborhood(id,hops){let ids=new Set([id]);for(let i=0;i<hops;i++)for(const e of DATA.edges)if(ids.has(e.from)||ids.has(e.to)){ids.add(e.from);ids.add(e.to)}return ids}
function isRelation(e){return ['contradicts','supersedes','obsolete','contested'].includes(e.type)||['obsolete','contested'].includes(e.status)}
function hasEv(x){return x.evidence||(x.metadata&&x.metadata.evidence)}
function currentData(){const q=$('search').value.toLowerCase(), c=$('confidence').value, p=$('provider').value, nt=$('nodeType').value, t=$('edgeType').value, op=$('operationType').value, tool=$('tool').value, prov=$('provenance').value, st=$('status').value, mc=$('metricConfidence').value, ev=$('hasEvidence').checked, hm=$('hasMetrics').checked, low=$('lowTimestampCoverage').checked, rel=$('relations').checked;let edges=DATA.edges.filter(e=>(!c||e.confidence===c)&&(!p||e.provider===p)&&(!t||e.type===t)&&(!op||e.operationType===op)&&(!tool||e.tool===tool)&&(!prov||e.provenance===prov)&&(!st||e.status===st)&&(!mc||metricConf(e)===mc)&&(!ev||hasEv(e))&&(!hm||hasMetrics(e))&&(!low||lowTs(e))&&(!rel||isRelation(e))&&matchText(e,q));let ids=new Set(edges.flatMap(e=>[e.from,e.to]));let nodes=DATA.nodes.filter(n=>(!p||n.provider===p)&&(!nt||n.type===nt)&&(!prov||n.provenance===prov)&&(!st||n.status===st)&&(!mc||metricConf(n)===mc)&&(!ev||hasEv(n))&&(!hm||hasMetrics(n))&&(!low||lowTs(n))&&(!q||matchText(n,q)||ids.has(n.id)));if(focus){nodes=nodes.filter(n=>focus.has(n.id));const keep=new Set(nodes.map(n=>n.id));edges=edges.filter(e=>keep.has(e.from)&&keep.has(e.to))}return {nodes,edges}}
function show(kind,obj){selected={kind,...obj};const rows=[['kind',kind],['id',obj.id],['type',obj.type],['operation',obj.operationType],['tool',obj.tool],['mode',obj.mode],['repo/project',obj.repoLabel],['source repo',obj.sourceRepo],['target repo',obj.targetRepo],['label',obj.label],['metrics',metricSummary(obj)],['metric confidence',metricConf(obj)],['confidence',obj.confidence],['provenance',obj.provenance],['timestamp',obj.timestamp],['provider',obj.provider],['path',obj.path],['source',obj.sourceSession],['destination',obj.destinationSession]].filter(([,v])=>v!=null&&v!=='').map(([k,v])=>'<div class="field"><b>'+esc(k)+':</b> '+esc(v)+'</div>').join('');details.innerHTML=rows+'<h3>Metadata / evidence</h3><pre class="code">'+esc(JSON.stringify(obj.metadata??obj,null,2))+'</pre>';render()}
function render(){try{const {nodes,edges}=currentData();graph.innerHTML='';for(const lane of uniq(nodes.map(n=>n.label||'(unlabeled)'))){const box=document.createElement('div');box.className='lane';const h=document.createElement('h3');h.textContent=lane;box.append(h);for(const n of nodes.filter(n=>(n.label||'(unlabeled)')===lane)){const el=document.createElement('button');el.className='node '+(selected&&selected.id===n.id?'selected':'');el.textContent=(n.repoLabel||n.label||'(unlabeled)')+' · '+n.id+(metricSummary(n)?' · '+metricSummary(n):'')+(n.compactionCount?' · compact x'+n.compactionCount:'');el.onclick=()=>show('node',n);box.append(el)}graph.append(box)}const edgeBox=document.createElement('div');edgeBox.className='lane';const eh=document.createElement('h3');eh.textContent='Edges';edgeBox.append(eh);for(const e of edges){const el=document.createElement('div');el.className='edge '+(e.confidence||'unknown')+(selected&&selected.id===e.id?' selected':'');el.textContent=(e.label||e.type||'edge')+(metricSummary(e)?' · '+metricSummary(e):'')+' · '+e.from+' → '+e.to;el.onclick=()=>show('edge',e);edgeBox.append(el)}graph.append(edgeBox);$('counts').textContent=nodes.length+' nodes, '+edges.length+' edges'+(focus?' · focused':'')}catch(err){graph.innerHTML='<div class="lane"><h3>Render error</h3><pre class="code">'+esc(err&&err.stack||err)+'</pre></div>';throw err}}
$('hop1').onclick=()=>{if(selected&&selected.kind==='node'){focus=neighborhood(selected.id,1);render()}};$('hop2').onclick=()=>{if(selected&&selected.kind==='node'){focus=neighborhood(selected.id,2);render()}};$('resetView').onclick=()=>{focus=null;render()};$('exportSubgraph').onclick=()=>{details.textContent=JSON.stringify(currentData(),null,2)};$('exportMermaid').onclick=()=>{const {nodes,edges}=currentData(),ids=new Map(nodes.map(n=>[n.id,n]));details.textContent=['graph TD',...nodes.map(n=>'  '+n.id+'["'+String(n.label||n.id).replace(/"/g,'&quot;')+'"]'),...edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).map(e=>'  '+e.from+' -->|'+(e.type||'edge')+'| '+e.to)].join('\\n')};
for(const id of ['search','confidence','provider','nodeType','edgeType','operationType','tool','provenance','status','metricConfidence','hasEvidence','hasMetrics','lowTimestampCoverage','relations']) $(id).addEventListener('input',render); render();</script>
</body></html>`;
	const htmlPath = options.outputPath ?? join(dir!, `session_graph_viewer_${stamp}.html`);
	await writeFile(htmlPath, html, { encoding: "utf8", flag: "wx" });
	return htmlPath;
}

async function writeTemporalHtml(cwd: string, graph: Graph, outputPath?: string, title = "Pi Session Temporal View", defaultGroup: "label" | "provider" | "sessionId" = "label") {
	const dir = outputPath ? undefined : join(cwd, "session-graph");
	if (dir) await mkdir(dir, { recursive: true });
	const spans = (graph.temporalActivitySpans ?? []).map((span) => ({ ...span, label: displayProjectLabel(repoIdentityDisplay(graph, span.repoIdentityId) ?? span.cwd ?? span.label ?? span.provider ?? "unknown") }));
	const bursts = graph.workBursts ?? [];
	const metrics = (graph.activityMetrics ?? []).map((metric) => ({ ...metric, cwd: displayProjectLabel(metric.cwd) }));
	const compactions = graph.compactionEvents ?? [];
	const data = JSON.stringify({ spans, bursts, metrics, compactions }).replace(/</g, "\\u003c");
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${title}</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;background:#111827;color:#e5e7eb}header{position:sticky;top:0;z-index:2;background:#0f172a;border-bottom:1px solid #334155;padding:12px 16px}.legend{margin-top:8px;padding:8px;border:1px solid #334155;border-radius:8px;background:#172033}button,input,select{background:#1f2937;color:#e5e7eb;border:1px solid #475569;border-radius:6px;padding:4px 6px;margin-right:8px}main{display:grid;grid-template-columns:1fr 360px;height:calc(100vh - 112px)}#timeline{overflow:auto;padding:16px}.lane{margin:0 0 10px}.lane h3{font-size:13px;margin:0 0 4px;color:#cbd5e1}.bar{height:18px;border-radius:4px;background:#60a5fa;margin:2px 0;position:relative;cursor:pointer}.bar.pi{background:#22c55e}.bar.codex{background:#a78bfa}.bar.claude{background:#f59e0b}.burst{height:8px;background:#f97316;border-radius:4px;margin-top:2px}.compact{display:inline-block;background:#eab308;color:#111827;border-radius:10px;padding:1px 6px;margin-left:4px;font-size:11px}.gap{position:absolute;height:100%;border-left:1px dashed #facc15;color:#facc15;font-size:11px;writing-mode:vertical-rl;top:0}aside{border-left:1px solid #334155;padding:16px;background:#0f172a;overflow:auto}.muted{color:#94a3b8}.hidden{display:none}</style></head><body><header><strong>${title}</strong> <input id="search" placeholder="filter provider/cwd/label" size="34"/><select id="group"><option value="label"${defaultGroup === "label" ? " selected" : ""}>project/cwd lane</option><option value="provider"${defaultGroup === "provider" ? " selected" : ""}>provider</option><option value="sessionId"${defaultGroup === "sessionId" ? " selected" : ""}>session</option></select><select id="axis"><option value="compressed">compressed time</option><option value="real">real time</option></select><button id="toggleLegend">toggle legend</button><span id="counts" class="muted"></span><div id="legend" class="legend">Renders prepared <code>graph-export.json</code> temporalActivitySpans, workBursts, activityMetrics, and compactionEvents. Bars show real session timestamps/durations in details. Compressed time collapses inactive gaps over 7 days into labeled breaks; real time is proportional. Orange ticks are store-derived work bursts. Yellow badges are compaction/checkpoint counts. Accrued effort metrics are provider/cwd aggregates exported by agent-session-store.</div></header><main><section id="timeline"></section><aside><h2>Details</h2><pre id="details">Select a span, burst, or metric.</pre></aside></main><script>const DATA=${data};const $=id=>document.getElementById(id),timeline=$('timeline'),details=$('details');
function time(x){const t=Date.parse(x||'');return Number.isFinite(t)?t:0}function esc(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}function keyOf(s,g){return s[g]||s.label||s.cwd||s.provider||'unknown'}function compactCount(s){return DATA.compactions.filter(c=>c.sessionId&&c.sessionId===s.sessionId).reduce((n,c)=>n+(c.eventCount||c.summaryEventCount||1),0)}
function axis(spans){const times=spans.flatMap(s=>[time(s.start),time(s.end)||time(s.start)]).filter(Boolean).sort((a,b)=>a-b);const min=times[0]||0,max0=times.at(-1)||min;const day=86400000,threshold=7*day,keep=day;let removed=0,gaps=[];for(let i=1;i<times.length;i++){const gap=times[i]-times[i-1];if(gap>threshold){removed+=gap-keep;gaps.push({at:times[i]-removed,label:'gap: '+Math.round(gap/day)+' days'})}}return {min,max:max0-removed,gaps,project(t){if($('axis').value==='real')return t;let r=0;for(let i=1;i<times.length;i++){const gap=times[i]-times[i-1];if(gap>threshold&&t>=times[i])r+=gap-keep}return t-r}}}
$('toggleLegend').onclick=()=>$('legend').classList.toggle('hidden');function render(){const q=$('search').value.toLowerCase(),g=$('group').value;const spans=DATA.spans.filter(s=>!q||JSON.stringify(s).toLowerCase().includes(q));const ax=axis(spans);const width=Math.max(900, timeline.clientWidth-40);timeline.innerHTML='';const wrap=document.createElement('div');wrap.style.position='relative';wrap.style.minHeight='24px';if($('axis').value==='compressed')for(const gap of ax.gaps){const ge=document.createElement('div');ge.className='gap';ge.style.left=((gap.at-ax.min)/(ax.max-ax.min))*width+'px';ge.textContent=gap.label;wrap.append(ge)}timeline.append(wrap);const groups=[...new Set(spans.map(s=>keyOf(s,g)))].sort();for(const lane of groups){const box=document.createElement('div');box.className='lane';box.innerHTML='<h3>'+esc(lane)+'</h3>';for(const s of spans.filter(s=>keyOf(s,g)===lane)){const left=ax.max>ax.min?((ax.project(time(s.start))-ax.min)/(ax.max-ax.min))*width:0;const right=ax.max>ax.min?((ax.project(time(s.end)||time(s.start))-ax.min)/(ax.max-ax.min))*width:left+6;const bar=document.createElement('div');bar.className='bar '+esc(s.provider);bar.style.marginLeft=Math.max(0,left)+'px';bar.style.width=Math.max(6,right-left)+'px';bar.textContent=(s.provider||'')+' '+(compactCount(s)?' compact x'+compactCount(s):'');bar.onclick=()=>details.textContent=JSON.stringify({...s,compactionCount:compactCount(s)},null,2);box.append(bar)}timeline.append(box)}const b=document.createElement('div');b.className='lane';b.innerHTML='<h3>Work bursts / accrued effort</h3>';for(const burst of DATA.bursts){const el=document.createElement('div');el.className='burst';el.title=JSON.stringify(burst);el.onclick=()=>details.textContent=JSON.stringify(burst,null,2);b.append(el)}for(const metric of DATA.metrics.slice(0,80)){const el=document.createElement('button');el.textContent=(metric.provider||'provider')+' '+(metric.cwd||'')+' sessions='+metric.sessionCount+' lines='+(metric.lineCount||0);el.onclick=()=>details.textContent=JSON.stringify(metric,null,2);b.append(el)}timeline.append(b);$('counts').textContent=spans.length+' spans, '+DATA.bursts.length+' bursts, '+DATA.compactions.length+' compactions'}for(const id of ['search','group','axis'])$(id).addEventListener('input',render);render();</script></body></html>`;
	const htmlPath = outputPath ?? join(dir!, `temporal_graph_${timestamp()}.html`);
	await writeFile(htmlPath, html, { encoding: "utf8", flag: "wx" });
	return htmlPath;
}

async function temporalWriteLines(cwd: string, graph: Graph, outputPath?: string) {
	const htmlPath = await writeTemporalHtml(cwd, graph, outputPath);
	return ["Canonical temporal HTML", "", `Source: ${graph.source}`, `Spans: ${graph.temporalActivitySpans?.length ?? 0}`, `Work bursts: ${graph.workBursts?.length ?? 0}`, `Activity metrics: ${graph.activityMetrics?.length ?? 0}`, `Compactions: ${graph.compactionEvents?.length ?? 0}`, "", "Wrote:", shortPath(htmlPath)];
}

async function dotWriteLines(cwd: string, graph: Graph, current?: string, options: { svg?: boolean; starts?: boolean } = {}) {
	const result = await writeDotFiles(cwd, graph, current, options);
	return [
		"Graphviz lineage export",
		"",
		`Source: ${graph.source}`,
		`Sessions: ${graph.nodes.size}`,
		`Edges: ${graph.records.length}`,
		"",
		"Wrote:",
		shortPath(result.dotPath),
		...(result.svgPath ? [shortPath(result.svgPath)] : []),
		...(result.svgError ? ["", `SVG skipped: ${result.svgError}`, "If this says `spawn dot ENOENT`, install Graphviz and ensure `dot` is on PATH. Otherwise DOT was written but Graphviz failed to render this graph."] : []),
	];
}

async function writeDotFiles(cwd: string, graph: Graph, current?: string, options: { svg?: boolean; starts?: boolean; basename?: string } = {}) {
	const dir = join(cwd, "session-graphs");
	await mkdir(dir, { recursive: true });
	const stamp = timestamp();
	const dot = dotGraph(graph, current, { starts: options.starts });
	const name = options.basename ?? `session_graph_${stamp}`;
	const dotPath = join(dir, `${name}.dot`);
	await writeFile(dotPath, dot + "\n", { encoding: "utf8", flag: "wx" });
	let svgPath: string | undefined;
	let svgError: string | undefined;
	if (options.svg) {
		svgPath = join(dir, `${name}.svg`);
		try {
			await execFileAsync("dot", ["-Gnewrank=true", "-Tsvg", dotPath, "-o", svgPath]);
		} catch (error) {
			svgPath = undefined;
			svgError = error instanceof Error ? error.message : String(error);
		}
	}
	return { dotPath, svgPath, svgError };
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

async function graphWriteLines(cwd: string, graph: Graph, current: string | undefined, all: boolean, filters: GraphFilters) {
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
	for (const [index, record] of graph.records.slice(-10).entries()) lines.push(...formatHop(record, graph.records.length - Math.min(10, graph.records.length) + index + 1, current, false));
	return lines;
}

function graphTime(node: SessionNode, records: RelocationRecord[]) {
	const candidates = [node.timestamp, ...records.flatMap((record) => record.sourceSession === node.path || record.destinationSession === node.path ? [record.ts] : [])]
		.map((ts) => Date.parse(ts ?? ""))
		.filter(Number.isFinite);
	return candidates.length ? Math.min(...candidates) : 0;
}

function lineageSvgHtml(graph: Graph, type: "lineage-full" | "lineage-focused", stamp: string) {
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
	const positions = new Map<string, { x: number; y: number }>();
	nodes.forEach((node, index) => positions.set(node.path, { x: 120 + index * 170, y: laneY.get(node.label || node.cwd || "unknown") ?? 120 }));
	const lines = [
		`<svg id="graph-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`,
		`<style>.edge{stroke:#60a5fa;stroke-width:1.5;fill:none;opacity:.65}.node{fill:#1e293b;stroke:#93c5fd;stroke-width:1.2}.label{font:12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#e5e7eb}.small{font:10px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#94a3b8}.lane{stroke:#334155;stroke-width:1;stroke-dasharray:4 4}</style>`,
		...lanes.map((lane) => `<text class="small" x="12" y="${(laneY.get(lane) ?? 100) - 32}">${escapeHtml(lane)}</text><line class="lane" x1="0" y1="${(laneY.get(lane) ?? 100) - 25}" x2="${width}" y2="${(laneY.get(lane) ?? 100) - 25}"/>`),
	];
	for (const edge of edges) {
		const from = positions.get(edge.sourceSession), to = positions.get(edge.destinationSession);
		if (!from || !to) continue;
		const mid = Math.max(25, Math.abs(to.x - from.x) / 2);
		lines.push(`<path class="edge" d="M ${from.x + 130} ${from.y + 22} C ${from.x + mid} ${from.y - 35}, ${to.x - mid} ${to.y - 35}, ${to.x} ${to.y + 22}"><title>${escapeHtml(`${edge.ts} ${edge.displayLabel ?? edge.lineageKind ?? edge.edgeType ?? "edge"}`)}</title></path>`);
	}
	for (const node of nodes) {
		const pos = positions.get(node.path)!;
		lines.push(`<g><rect class="node" x="${pos.x}" y="${pos.y}" rx="8" width="138" height="50"><title>${escapeHtml(node.path)}</title></rect><text class="label" x="${pos.x + 8}" y="${pos.y + 20}">${escapeHtml(node.label).slice(0, 22)}</text><text class="small" x="${pos.x + 8}" y="${pos.y + 38}">${escapeHtml(node.id)}</text></g>`);
	}
	lines.push(`</svg>`);
	return htmlShell(title, `<p>${type === "lineage-full" ? "All known session graph nodes with available edges." : "Only sessions participating in relocation/session-move/repo-move/overlay edges."} No Mermaid is used.</p><div class="wrap">${lines.join("\n")}</div><h2>Edges</h2><ol>${edges.map((edge) => `<li>${escapeHtml(edge.ts)} — ${escapeHtml(pathLabel(edge.fromCwd, edge.sourceSession))} → ${escapeHtml(pathLabel(edge.toCwd, edge.destinationSession))}</li>`).join("\n")}</ol>`);
}

function timelineHtml(graph: Graph, type: "timeline-projects" | "timeline-sessions", stamp: string) {
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
	const x = (ts: string) => left + ((Date.parse(ts) - min) / Math.max(1, max - min)) * (width - left - 80);
	const svg = [`<svg id="timeline-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`, `<style>.row{font:12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#e5e7eb}.grid{stroke:#334155}.event{fill:#fbbf24;stroke:#d97706}.edge{stroke:#22c55e;fill:none;opacity:.75}.small{font:10px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#94a3b8}</style>`];
	for (const group of groups) { const y = rowY.get(group)!; svg.push(`<text class="row" x="10" y="${y + 4}">${escapeHtml(shortPath(group)).slice(0, 45)}</text><line class="grid" x1="0" y1="${y + 14}" x2="${width}" y2="${y + 14}"/>`); }
	for (const event of events) {
		const source = groupBySession ? event.sourceSession : pathLabel(event.fromCwd, event.sourceSession);
		const dest = groupBySession ? event.destinationSession : pathLabel(event.toCwd, event.destinationSession);
		const sx = x(event.ts), sy = rowY.get(source), dy = rowY.get(dest);
		if (sy == null || dy == null) continue;
		svg.push(`<circle class="event" cx="${sx.toFixed(1)}" cy="${sy}" r="5"><title>${escapeHtml(`${event.ts} ${source} -> ${dest}`)}</title></circle><path class="edge" d="M ${sx.toFixed(1)} ${sy} C ${(sx + 35).toFixed(1)} ${sy}, ${(sx + 35).toFixed(1)} ${dy}, ${sx.toFixed(1)} ${dy}"><title>${escapeHtml(event.displayLabel ?? event.lineageKind ?? event.edgeType ?? "edge")}</title></path>`);
	}
	svg.push(`</svg>`);
	return htmlShell(title, `<p>${groupBySession ? "Timeline grouped by individual session file." : "Timeline grouped by project/folder label."} Yellow dots are source events; green curves connect destination rows at the same timestamp.</p><div class="wrap">${svg.join("\n")}</div>`);
}

function htmlShell(title: string, body: string) {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#111827;color:#e5e7eb;margin:2rem;line-height:1.4}.wrap{height:82vh;overflow:auto;border:1px solid #334155;border-radius:10px;background:#0f172a}svg{width:100%;height:100%}a{color:#93c5fd}ol{max-height:40vh;overflow:auto}.muted{color:#94a3b8}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>\n`;
}

function isFocusedLineageRecord(record: RelocationRecord) {
	if (record.sourceSession === record.destinationSession) return false;
	const type = recordType(record);
	return record.overlay || record.operationType === "repo_move" || record.operationType === "session_relocation" || record.operationType === "bucket_relocation" || ["relocation", "repo_move", "branch", "diverge"].includes(type);
}


type ReportArtifact = { title: string; path: string; description: string };

function graphCloneWithRecords(graph: Graph, records: RelocationRecord[]) {
	return rebuildGraph(graph, records);
}

async function renderDotSvg(dotPath: string) {
	const svgPath = dotPath.replace(/\.dot$/, ".svg");
	try {
		await execFileAsync("dot", ["-Gnewrank=true", "-Tsvg", dotPath, "-o", svgPath]);
		return { svgPath };
	} catch (error) {
		return { svgPath: undefined, error: error instanceof Error ? error.message : String(error) };
	}
}

async function writeDotPair(dir: string, name: string, dot: string, svg = true) {
	await mkdir(dir, { recursive: true });
	const dotPath = join(dir, `${name}.dot`);
	await writeFile(dotPath, dot + "\n");
	const rendered = svg ? await renderDotSvg(dotPath) : { svgPath: undefined as string | undefined, error: undefined as string | undefined };
	return { dotPath, svgPath: rendered.svgPath, svgError: rendered.error };
}

function repoKeyForPath(graph: Graph, path: string, cwd?: string) {
	const node = graph.nodes.get(path);
	if (node) return repoLabelForNode(node, graph);
	return pathLabel(cwd, path);
}

function repoJumpStats(graph: Graph) {
	const nodeSessions = new Map<string, Set<string>>();
	const jumps = new Map<string, { from: string; to: string; weight: number }>();
	for (const node of graph.nodes.values()) {
		const key = repoKeyForPath(graph, node.path, node.cwd);
		const set = nodeSessions.get(key) ?? new Set<string>();
		set.add(node.path);
		nodeSessions.set(key, set);
	}
	for (const record of graph.records) {
		if (record.sourceSession === record.destinationSession) continue;
		const from = repoKeyForPath(graph, record.sourceSession, record.fromCwd);
		const to = repoKeyForPath(graph, record.destinationSession, record.toCwd);
		if (!from || !to || from === to) continue;
		const key = `${from}\u0000${to}`;
		const current = jumps.get(key) ?? { from, to, weight: 0 };
		current.weight++;
		jumps.set(key, current);
	}
	return { nodeSessions, jumps: [...jumps.values()].sort((a, b) => b.weight - a.weight || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)) };
}

function repoJumpDot(graph: Graph, minWeight = 2) {
	const { nodeSessions, jumps } = repoJumpStats(graph);
	const used = new Set<string>();
	for (const jump of jumps) if (jump.weight >= minWeight) { used.add(jump.from); used.add(jump.to); }
	const lines = [
		"digraph RepoJumpMap {",
		"  graph [rankdir=LR, bgcolor=\"#111827\", pad=0.35, nodesep=0.55, ranksep=0.9, splines=true, overlap=false];",
		"  node [shape=box, style=\"rounded,filled\", fontname=\"Helvetica\", fontsize=11, color=\"#64748b\", fillcolor=\"#1e293b\", fontcolor=\"#e5e7eb\"];",
		"  edge [fontname=\"Helvetica\", fontsize=10, color=\"#60a5fa\", fontcolor=\"#cbd5e1\", arrowsize=0.8];",
	];
	for (const repo of [...used].sort()) lines.push(`  ${dotId(repo)} [label="${dotEscape(`${repo}\\nsessions: ${nodeSessions.get(repo)?.size ?? 0}`)}", tooltip="${dotEscape(repo)}"];`);
	for (const jump of jumps.filter((jump) => jump.weight >= minWeight)) {
		const penwidth = Math.min(8, 1 + Math.log2(jump.weight));
		lines.push(`  ${dotId(jump.from)} -> ${dotId(jump.to)} [label="${jump.weight} jumps", penwidth=${penwidth.toFixed(1)}, tooltip="${dotEscape(`${jump.from} -> ${jump.to}: ${jump.weight}`)}"];`);
	}
	lines.push("}");
	return lines.join("\n");
}

function meaningfulLineageGraph(graph: Graph) {
	const degree = new Map<string, number>();
	for (const record of graph.records) {
		degree.set(record.sourceSession, (degree.get(record.sourceSession) ?? 0) + 1);
		degree.set(record.destinationSession, (degree.get(record.destinationSession) ?? 0) + 1);
	}
	const records = graph.records.filter((record) => {
		if (record.sourceSession === record.destinationSession) return false;
		const from = graph.nodes.get(record.sourceSession), to = graph.nodes.get(record.destinationSession);
		if (!from || !to) return false;
		if ((from.lineCount ?? 1) === 0 && (degree.get(from.path) ?? 0) <= 1) return false;
		if ((to.lineCount ?? 1) === 0 && (degree.get(to.path) ?? 0) <= 1) return false;
		return true;
	});
	return graphCloneWithRecords(graph, records);
}

function graphSummary(graph: Graph) {
	const { nodeSessions, jumps } = repoJumpStats(graph);
	const out = new Map<string, { repo: string; sessions: number; lines: number; in: number; out: number; restarts: number }>();
	for (const [repo, sessions] of nodeSessions) out.set(repo, { repo, sessions: sessions.size, lines: 0, in: 0, out: 0, restarts: 0 });
	for (const node of graph.nodes.values()) {
		const repo = repoKeyForPath(graph, node.path, node.cwd);
		const item = out.get(repo) ?? { repo, sessions: 0, lines: 0, in: 0, out: 0, restarts: 0 };
		item.lines += node.lineCount ?? 0;
		out.set(repo, item);
	}
	for (const jump of jumps) {
		const from = out.get(jump.from); if (from) from.out += jump.weight;
		const to = out.get(jump.to); if (to) to.in += jump.weight;
	}
	for (const record of graph.records) {
		const repo = repoKeyForPath(graph, record.destinationSession, record.toCwd);
		const item = out.get(repo); if (item) item.restarts++;
	}
	const leavesSet = new Set(leaves(graph).map((node) => node.path));
	const falseStarts = [...graph.nodes.values()]
		.filter((node) => (node.lineCount ?? 0) < 50 && leavesSet.has(node.path))
		.sort((a, b) => (a.lineCount ?? 0) - (b.lineCount ?? 0) || a.label.localeCompare(b.label));
	const repeatedStarts = [...graph.nodes.values()]
		.filter((node) => node.timestamp)
		.sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""))
		.flatMap((node, index, arr) => {
			const next = arr[index + 1];
			if (!next || repoKeyForPath(graph, next.path, next.cwd) !== repoKeyForPath(graph, node.path, node.cwd)) return [];
			const hours = (Date.parse(next.timestamp!) - Date.parse(node.timestamp!)) / 3600000;
			return hours >= 0 && hours <= 6 ? [{ repo: repoKeyForPath(graph, node.path, node.cwd), first: node.timestamp!, second: next.timestamp!, hours }] : [];
		});
	return { repos: [...out.values()], jumps, falseStarts, repeatedStarts };
}

function tableHtml(headers: string[], rows: unknown[][]) {
	return `<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("\n")}</tbody></table>`;
}

function reportShell(title: string, body: string) {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#111827;color:#e5e7eb;margin:2rem;line-height:1.45}a{color:#93c5fd}.card{background:#172033;border:1px solid #334155;border-radius:10px;padding:1rem;margin:1rem 0}table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{border:1px solid #334155;padding:.4rem;text-align:left;vertical-align:top}th{background:#0f172a}.muted{color:#94a3b8}code{background:#0f172a;padding:.1rem .25rem;border-radius:4px}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>\n`;
}

function formatHours(minutes?: number, hours?: number) {
	const value = hours ?? (minutes != null ? minutes / 60 : undefined);
	return value == null ? "" : `${value.toFixed(value >= 10 ? 1 : 2)}h`;
}

function timeValue(value?: string) {
	const t = Date.parse(value ?? "");
	return Number.isFinite(t) ? t : undefined;
}

function displayProjectLabel(value?: string) {
	if (!value) return "unknown";
	if (value.startsWith("/") || value.includes("/")) return cwdLabel(value);
	return value;
}

function projectLabelForMetric(graph: Graph, metric: { displayName?: string; repoIdentityId?: string; project?: string }) {
	return displayProjectLabel(metric.displayName ?? repoIdentityDisplay(graph, metric.repoIdentityId) ?? metric.project ?? "unknown");
}

function derivedActiveTimeMetrics(graph: Graph) {
	const byProject = new Map<string, { project: string; displayName: string; activeMinutes: number; workBlockCount: number; sessionCount: number; providers: Set<string>; contributingPaths: Set<string>; confidence: string }>();
	for (const node of graph.nodes.values()) {
		const active = metricObject(node.metadata?.activeTime);
		const minutes = metricNumber(active?.activeMinutes) ?? 0;
		if (!minutes) continue;
		const displayName = repoLabelForNode(node, graph);
		const item = byProject.get(displayName) ?? { project: displayName, displayName, activeMinutes: 0, workBlockCount: 0, sessionCount: 0, providers: new Set<string>(), contributingPaths: new Set<string>(), confidence: String(active?.confidence ?? "derived") };
		item.activeMinutes += minutes;
		item.workBlockCount += metricNumber(active?.workBlockCount) ?? 0;
		item.sessionCount++;
		if (node.provider) item.providers.add(node.provider);
		if (node.cwd && !node.cwd.startsWith("(")) item.contributingPaths.add(node.cwd);
		byProject.set(displayName, item);
	}
	return [...byProject.values()].map((item) => ({ ...item, repoIdentityId: undefined as string | undefined, activeHours: +(item.activeMinutes / 60).toFixed(2), providers: [...item.providers].sort(), contributingPaths: [...item.contributingPaths].sort() }));
}

async function writeActiveHoursReport(reportDir: string, graph: Graph, stamp: string) {
	const metrics = [...((graph.activeTimeMetrics?.length ? graph.activeTimeMetrics : derivedActiveTimeMetrics(graph)) ?? [])].sort((a, b) => (b.activeMinutes ?? 0) - (a.activeMinutes ?? 0));
	const byAgent = new Map<string, { agent: string; activeMinutes: number; sessions: number; providers: Set<string> }>();
	for (const node of graph.nodes.values()) {
		const active = metricObject(node.metadata?.activeTime);
		const minutes = metricNumber(active?.activeMinutes) ?? 0;
		if (!minutes) continue;
		const agent = agentLabel(node) ?? node.provider ?? "unknown";
		const item = byAgent.get(agent) ?? { agent, activeMinutes: 0, sessions: 0, providers: new Set<string>() };
		item.activeMinutes += minutes;
		item.sessions++;
		if (node.provider) item.providers.add(node.provider);
		byAgent.set(agent, item);
	}
	const agentRows = [...byAgent.values()].sort((a, b) => b.activeMinutes - a.activeMinutes).slice(0, 50);
	const path = join(reportDir, "04-active-hours.html");
	await writeFile(path, reportShell(`${stamp} — Active Hours`, `<p>Estimated active work time from event timestamp gaps, bounded by reconstructed visit rows when available. This is not calendar span. Idle threshold is exported by the store, usually 30 minutes. No transcript content is included.</p><div class="card"><h2>Top projects by active time</h2>${tableHtml(["project","active","blocks","sessions","providers","confidence","aliases / contributing paths"], metrics.slice(0, 100).map((m) => [m.displayName ?? repoIdentityDisplay(graph, m.repoIdentityId) ?? m.project ?? "unknown", formatHours(m.activeMinutes, m.activeHours), m.workBlockCount ?? "", m.sessionCount ?? "", (m.providers ?? []).join(", "), m.confidence ?? "", (m.contributingPaths ?? []).map(shortPath).join("; ")]))}</div><div class="card"><h2>Top agents/lineages by active time</h2>${tableHtml(["agent/lineage","active","sessions","providers"], agentRows.map((row) => [row.agent, formatHours(row.activeMinutes), row.sessions, [...row.providers].sort().join(", ")]))}</div>`));
	return { title: "Active hours: top projects and agents", path, description: "Estimated active work time from timestamp gaps." } satisfies ReportArtifact;
}

async function writeHotspotReports(reportDir: string, graph: Graph, stamp: string) {
	const stats = graphSummary(graph);
	const hotspotsPath = join(reportDir, "01-hotspots.html");
	const falseStartsPath = join(reportDir, "03-false-starts.html");
	const topSessions = [...stats.repos].sort((a, b) => b.sessions - a.sessions).slice(0, 25);
	const topJumps = [...stats.repos].sort((a, b) => (b.in + b.out) - (a.in + a.out)).slice(0, 25);
	await writeFile(hotspotsPath, reportShell(`${stamp} — Hotspots`, `<p>Ranked operational signals: busiest repos/projects, jump-heavy repos, and repeated starts. No transcript content is included.</p><div class="card"><h2>Top repos by sessions</h2>${tableHtml(["repo/project","sessions","lines","jumps in","jumps out","restarts"], topSessions.map((r) => [r.repo, r.sessions, r.lines, r.in, r.out, r.restarts]))}</div><div class="card"><h2>Top repos by jumps in/out</h2>${tableHtml(["repo/project","sessions","jumps in","jumps out","total jumps"], topJumps.map((r) => [r.repo, r.sessions, r.in, r.out, r.in + r.out]))}</div><div class="card"><h2>Top jump pairs</h2>${tableHtml(["from","to","jumps"], stats.jumps.slice(0, 25).map((j) => [j.from, j.to, j.weight]))}</div><div class="card"><h2>Repeated starts within 6 hours</h2>${tableHtml(["repo/project","first","second","hours"], stats.repeatedStarts.slice(0, 50).map((r) => [r.repo, r.first, r.second, r.hours.toFixed(1)]))}</div>`));
	await writeFile(falseStartsPath, reportShell(`${stamp} — False Starts`, `<p>Short leaf sessions under 50 lines with no descendants. These are likely abandoned starts or very small completed interactions; inspect before deleting anything.</p>${tableHtml(["repo/project","session label","lines","start","path"], stats.falseStarts.slice(0, 250).map((n) => [repoKeyForPath(graph, n.path, n.cwd), n.label, n.lineCount ?? 0, n.timestamp ?? "", shortPath(n.path)]))}`));
	return [
		{ title: "Hotspots: ranked repos, jumps, repeated starts", path: hotspotsPath, description: "What should I notice first?" },
		{ title: "False starts: short leaf sessions", path: falseStartsPath, description: "Likely abandoned or low-value sessions." },
	] satisfies ReportArtifact[];
}



function filteredProjectGraph(graph: Graph, repo: string) {
	const records = graph.records.filter((record) => repoKeyForPath(graph, record.sourceSession, record.fromCwd) === repo || repoKeyForPath(graph, record.destinationSession, record.toCwd) === repo);
	return graphCloneWithRecords(graph, records);
}

function neighborhoodGraph(graph: Graph, sessionPath: string, hops = 2) {
	const keep = new Set([sessionPath]);
	for (let i = 0; i < hops; i++) {
		for (const record of graph.records) if (keep.has(record.sourceSession) || keep.has(record.destinationSession)) { keep.add(record.sourceSession); keep.add(record.destinationSession); }
	}
	return graphCloneWithRecords(graph, graph.records.filter((record) => keep.has(record.sourceSession) && keep.has(record.destinationSession)));
}

async function writeFocusReports(reportDir: string, graph: Graph, stamp: string) {
	const stats = graphSummary(graph);
	const topRepos = [...stats.repos].sort((a, b) => b.sessions - a.sessions || b.lines - a.lines).slice(0, 5);
	const artifacts: ReportArtifact[] = [];
	const links: string[] = [];
	for (const [index, repo] of topRepos.entries()) {
		const safe = shortHash(repo.repo);
		const g = filteredProjectGraph(graph, repo.repo);
		const htmlPath = join(reportDir, `09-project-${index + 1}-${safe}-timeline.html`);
		await writeTemporalHtml(reportDir, g, htmlPath, `${stamp} — Project Timeline — ${repo.repo}`, "label");
		artifacts.push({ title: `Project timeline: ${repo.repo}`, path: htmlPath, description: "One project at a time with related jumps as context." });
		links.push(`<li><a href="${escapeHtml(basename(htmlPath))}">${escapeHtml(repo.repo)}</a> — ${repo.sessions} sessions, ${repo.lines} lines</li>`);
	}
	const largest = [...graph.nodes.values()].sort((a, b) => (b.lineCount ?? 0) - (a.lineCount ?? 0))[0];
	if (largest) {
		const ng = neighborhoodGraph(graph, largest.path, 2);
		const written = await writeDotPair(reportDir, `10-session-neighborhood-${shortHash(largest.path)}`, dotGraph(ng), true);
		artifacts.push({ title: `Session neighborhood: ${largest.label}`, path: written.dotPath, description: "Two-hop ancestor/descendant/nearby jump subgraph for the largest session." });
		if (written.svgPath) artifacts.push({ title: `Session neighborhood SVG: ${largest.label}`, path: written.svgPath, description: "Two-hop focused subgraph." });
	}
	const indexPath = join(reportDir, "09-project-focus-index.html");
	await writeFile(indexPath, reportShell(`${stamp} — Project Focus Index`, `<p>Focused timelines for top projects. Use these after hotspots identify a suspicious repo/project.</p><ol>${links.join("\n")}</ol>`));
	artifacts.unshift({ title: "Project focus index", path: indexPath, description: "Top project timelines and focused drilldowns." });
	return artifacts;
}

function projectTimelineRows(graph: Graph) {
	const rows: { project: string; start: string; end: string; activeHours: number; provider: string; sessionId: string; contributingPath?: string; confidence?: string }[] = [];
	for (const span of graph.temporalActivitySpans ?? []) {
		const start = span.start ?? "";
		const end = span.end ?? span.start ?? "";
		if (!start || !timeValue(start)) continue;
		const project = displayProjectLabel(repoIdentityDisplay(graph, (span as { repoIdentityId?: string }).repoIdentityId) ?? span.cwd ?? span.label ?? span.provider ?? "unknown");
		rows.push({
			project,
			start,
			end: timeValue(end) ? end : start,
			activeHours: +(span.activeHours ?? ((span.activeMinutes ?? 0) / 60)).toFixed(2),
			provider: span.provider ?? "unknown",
			sessionId: span.sessionId ?? span.id,
			contributingPath: span.cwd,
			confidence: span.metricConfidence ?? span.confidence ?? "derived",
		});
	}
	if (rows.length) return rows;
	for (const node of graph.nodes.values()) {
		const active = metricObject(node.metadata?.activeTime);
		const minutes = metricNumber(active?.activeMinutes);
		const start = String(active?.firstWorkedAt ?? node.metadata?.startTimestamp ?? node.timestamp ?? "");
		const end = String(active?.lastWorkedAt ?? node.metadata?.endTimestamp ?? node.timestamp ?? start);
		if (!start || !timeValue(start)) continue;
		rows.push({ project: displayProjectLabel(repoLabelForNode(node, graph)), start, end: timeValue(end) ? end : start, activeHours: minutes != null ? +(minutes / 60).toFixed(2) : 0, provider: node.provider ?? "unknown", sessionId: node.id, contributingPath: node.cwd, confidence: String(active?.confidence ?? node.confidence ?? "derived") });
	}
	return rows;
}

function collapsedProjectTimelineRows(graph: Graph) {
	const rows = projectTimelineRows(graph).filter((row) => row.activeHours > 0).sort((a, b) => a.project.localeCompare(b.project) || a.start.localeCompare(b.start));
	const collapsed: typeof rows = [];
	for (const row of rows) {
		const previous = collapsed[collapsed.length - 1];
		if (previous && previous.project === row.project && (timeValue(row.start) ?? 0) <= (timeValue(previous.end) ?? 0)) {
			if ((timeValue(row.end) ?? 0) > (timeValue(previous.end) ?? 0)) previous.end = row.end;
			previous.activeHours = Math.max(previous.activeHours, row.activeHours);
			previous.contributingPath = [...new Set([previous.contributingPath, row.contributingPath].filter(Boolean))].join("; ");
			previous.confidence = previous.confidence === row.confidence ? previous.confidence : "mixed";
		} else {
			collapsed.push({ ...row });
		}
	}
	return collapsed;
}

function weeklyProjectRows(graph: Graph) {
	const totals = new Map<string, Map<string, number>>();
	for (const row of collapsedProjectTimelineRows(graph)) {
		const d = new Date(row.start);
		const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))).toISOString().slice(0, 10);
		const project = row.project;
		const byWeek = totals.get(project) ?? new Map<string, number>();
		byWeek.set(weekStart, (byWeek.get(weekStart) ?? 0) + row.activeHours);
		totals.set(project, byWeek);
	}
	return [...totals.entries()].flatMap(([project, byWeek]) => [...byWeek.entries()].map(([week, hours]) => ({ project, week, hours: +hours.toFixed(2) })));
}

async function writeProjectVisualizations(reportDir: string, graph: Graph, stamp: string) {
	const timelineRows = collapsedProjectTimelineRows(graph).sort((a, b) => a.start.localeCompare(b.start));
	const metricTotals = new Map<string, { name: string; value: number; paths: Set<string>; providers: Set<string>; confidence: Set<string> }>();
	for (const row of timelineRows) {
		const item = metricTotals.get(row.project) ?? { name: row.project, value: 0, paths: new Set<string>(), providers: new Set<string>(), confidence: new Set<string>() };
		item.value += row.activeHours;
		if (row.contributingPath) for (const p of row.contributingPath.split("; ").filter(Boolean)) item.paths.add(p);
		if (row.provider) item.providers.add(row.provider);
		if (row.confidence) item.confidence.add(row.confidence);
		metricTotals.set(row.project, item);
	}
	const metricRows = [...metricTotals.values()].map((item) => ({ name: item.name, value: +item.value.toFixed(2), paths: [...item.paths].sort(), providers: [...item.providers].sort(), confidence: [...item.confidence].sort().join(", ") })).sort((a, b) => b.value - a.value);
	const ganttPath = join(reportDir, "13-project-gantt.html");
	const areaPath = join(reportDir, "14-weekly-project-area.html");
	const treemapPath = join(reportDir, "15-project-treemap.html");
	const ganttData = JSON.stringify(timelineRows).replace(/</g, "\\u003c");
	const weekly = weeklyProjectRows(graph);
	const weeklyData = JSON.stringify(weekly).replace(/</g, "\\u003c");
	const treemapData = JSON.stringify(metricRows).replace(/</g, "\\u003c");
	await writeFile(ganttPath, `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(stamp)} — Project Gantt</title><script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#e5e7eb;margin:0}header{padding:1rem;background:#0f172a;border-bottom:1px solid #334155}.muted{color:#94a3b8}#chart{height:92vh}</style></head><body><header><h1>${escapeHtml(stamp)} — Project Gantt</h1><p class="muted">Canonical projects on rows, time on the x-axis, bar width by session span, tooltip includes active hours and contributing path. Active-hour totals are from imported timestamp metadata only; projects with missing external/archive event timing are undercounted.</p></header><div id="chart"></div><script>const raw=${ganttData};const cats=[...new Set(raw.map(r=>r.project))].sort((a,b)=>raw.filter(x=>x.project===b).reduce((n,x)=>n+x.activeHours,0)-raw.filter(x=>x.project===a).reduce((n,x)=>n+x.activeHours,0));const chart=echarts.init(document.getElementById('chart'));chart.setOption({backgroundColor:'#111827',tooltip:{formatter:p=>{const r=raw[p.dataIndex];return r.project+'<br>'+r.start+' → '+r.end+'<br>active: '+r.activeHours+'h<br>provider: '+r.provider+'<br>'+ (r.contributingPath||'')}},dataZoom:[{type:'slider',xAxisIndex:0},{type:'inside',xAxisIndex:0},{type:'slider',yAxisIndex:0},{type:'inside',yAxisIndex:0}],grid:{left:220,right:40,top:30,bottom:80},xAxis:{type:'time',axisLabel:{color:'#cbd5e1'}},yAxis:{type:'category',data:cats,axisLabel:{color:'#cbd5e1'}},series:[{type:'custom',renderItem:(params,api)=>{const cat=api.value(2);const start=api.coord([api.value(0),cat]);const end=api.coord([api.value(1),cat]);const h=12;return {type:'rect',shape:{x:start[0],y:start[1]-h/2,width:Math.max(3,end[0]-start[0]),height:h},style:{fill:'#60a5fa'}}},encode:{x:[0,1],y:2},data:raw.map(r=>[r.start,r.end,r.project])}]});window.addEventListener('resize',()=>chart.resize());</script></body></html>`);
	await writeFile(areaPath, `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(stamp)} — Weekly Project Area</title><script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#e5e7eb;margin:0}header{padding:1rem;background:#0f172a;border-bottom:1px solid #334155}.muted{color:#94a3b8}#chart{height:92vh}</style></head><body><header><h1>${escapeHtml(stamp)} — Weekly Project Area</h1><p class="muted">Weekly available active hours by canonical project. Useful for seeing which projects dominated each period, but undercounts projects whose historical external/archive events lack usable timestamps.</p></header><div id="chart"></div><script>const raw=${weeklyData};const weeks=[...new Set(raw.map(r=>r.week))].sort();const projects=[...new Set(raw.map(r=>r.project))].sort((a,b)=>raw.filter(x=>x.project===b).reduce((n,x)=>n+x.hours,0)-raw.filter(x=>x.project===a).reduce((n,x)=>n+x.hours,0)).slice(0,12);const series=projects.map(name=>({name,type:'line',stack:'hours',areaStyle:{},smooth:true,data:weeks.map(w=>{const row=raw.find(r=>r.project===name&&r.week===w);return row?row.hours:0})}));const chart=echarts.init(document.getElementById('chart'));chart.setOption({backgroundColor:'#111827',tooltip:{trigger:'axis'},legend:{top:8,textStyle:{color:'#cbd5e1'}},grid:{left:60,right:40,top:60,bottom:80},xAxis:{type:'category',data:weeks,axisLabel:{color:'#cbd5e1',rotate:45}},yAxis:{type:'value',axisLabel:{color:'#cbd5e1',formatter:v=>v+'h'}},series});window.addEventListener('resize',()=>chart.resize());</script></body></html>`);
	await writeFile(treemapPath, `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(stamp)} — Project Treemap</title><script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#e5e7eb;margin:0}header{padding:1rem;background:#0f172a;border-bottom:1px solid #334155}.muted{color:#94a3b8}#chart{height:92vh}</style></head><body><header><h1>${escapeHtml(stamp)} — Project Treemap</h1><p class="muted">Overall allocation of available active hours. Size shows imported timestamp-backed effort, not guaranteed lifetime effort; projects with missing external/archive event timing are undercounted.</p></header><div id="chart"></div><script>const raw=${treemapData};const chart=echarts.init(document.getElementById('chart'));chart.setOption({backgroundColor:'#111827',tooltip:{formatter:p=>{const d=p.data;return d.name+'<br>active: '+d.value+'h<br>providers: '+(d.providers||[]).join(', ')+'<br>'+((d.paths||[]).join('<br>'))}},series:[{type:'treemap',roam:false,breadcrumb:{show:false},label:{color:'#e5e7eb'},itemStyle:{borderColor:'#111827'},data:raw}]});window.addEventListener('resize',()=>chart.resize());</script></body></html>`);
	return [
		{ title: "Project Gantt", path: ganttPath, description: "Canonical projects across time with session spans and active hours." },
		{ title: "Weekly Project Area", path: areaPath, description: "Weekly active-hour dominance by canonical project." },
		{ title: "Project Treemap", path: treemapPath, description: "Overall allocation of active hours by project." },
	] satisfies ReportArtifact[];
}

async function writeChartTimelineReports(reportDir: string, graph: Graph, stamp: string) {
	const make = async (path: string, title: string, group: "label" | "sessionId") => {
		const spans = graph.temporalActivitySpans ?? [];
		const data = spans.map((span) => ({ name: group === "sessionId" ? span.sessionId ?? span.id : displayProjectLabel(repoIdentityDisplay(graph, span.repoIdentityId) ?? span.cwd ?? span.label ?? span.provider ?? "unknown"), value: [span.start, span.end ?? span.start, span.provider ?? "unknown", span.lineCount ?? 0, span.cwd ?? ""] })).filter((row) => row.value[0]);
		const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#111827;color:#e5e7eb;margin:0}#chart{height:92vh}header{padding:1rem;background:#0f172a;border-bottom:1px solid #334155}.muted{color:#94a3b8}</style></head><body><header><h1>${escapeHtml(title)}</h1><p class="muted">Chart-library timeline using Apache ECharts from CDN. Bars show session/activity spans; zoom and pan are enabled. No transcript content is included.</p></header><div id="chart"></div><script>const raw=${JSON.stringify(data).replace(/</g,"\\u003c")};const cats=[...new Set(raw.map(r=>r.name))].sort();const chart=echarts.init(document.getElementById('chart'));chart.setOption({backgroundColor:'#111827',tooltip:{formatter:p=>{const r=raw[p.dataIndex];return r.name+'<br>'+r.value[0]+' → '+r.value[1]+'<br>provider: '+r.value[2]+'<br>lines: '+r.value[3]+'<br>'+r.value[4]}},dataZoom:[{type:'slider',xAxisIndex:0},{type:'inside',xAxisIndex:0},{type:'slider',yAxisIndex:0},{type:'inside',yAxisIndex:0}],grid:{left:260,right:40,top:30,bottom:80},xAxis:{type:'time',axisLabel:{color:'#cbd5e1'}},yAxis:{type:'category',data:cats,axisLabel:{color:'#cbd5e1',width:240,overflow:'truncate'}},series:[{type:'custom',renderItem:(params,api)=>{const cat=api.value(2);const start=api.coord([api.value(0),cat]);const end=api.coord([api.value(1),cat]);const h=12;return {type:'rect',shape:{x:start[0],y:start[1]-h/2,width:Math.max(3,end[0]-start[0]),height:h},style:{fill:'#60a5fa'}}},dimensions:['start','end','cat'],encode:{x:[0,1],y:2},data:raw.map(r=>[r.value[0],r.value[1],r.name])}]});window.addEventListener('resize',()=>chart.resize());</script></body></html>`;
		await writeFile(path, html);
	};
	const projects = join(reportDir, "16-chart-timeline-projects.html");
	const sessions = join(reportDir, "17-chart-timeline-sessions.html");
	await make(projects, `${stamp} — Chart Timeline Projects`, "label");
	await make(sessions, `${stamp} — Chart Timeline Sessions`, "sessionId");
	return [
		{ title: "Chart timeline projects", path: projects, description: "Apache ECharts timeline grouped by project/cwd." },
		{ title: "Chart timeline sessions", path: sessions, description: "Apache ECharts timeline grouped by session." },
	] satisfies ReportArtifact[];
}

async function writeReportPack(graph: Graph, current?: string) {
	const stamp = timestamp();
	const root = join(desktopOutputRoot(), "session-graphs", stamp);
	const archiveDir = join(root, "archive");
	const reportDir = join(root, "reports");
	await mkdir(archiveDir, { recursive: true });
	await mkdir(reportDir, { recursive: true });
	const artifacts: ReportArtifact[] = [];
	const addDot = async (title: string, description: string, dir: string, name: string, dot: string) => {
		const written = await writeDotPair(dir, name, dot, true);
		artifacts.push({ title: `${title} DOT`, path: written.dotPath, description });
		if (written.svgPath) artifacts.push({ title: `${title} SVG`, path: written.svgPath, description });
		else if (written.svgError) artifacts.push({ title: `${title} SVG skipped`, path: written.dotPath, description: `${description} SVG failed: ${written.svgError}` });
	};
	await addDot("Full archive graph", "Complete preservation graph without artificial start nodes.", archiveDir, "full-session-graph", dotGraph(graph, current));
	await addDot("Full archive graph with starts", "Forensic archive graph with explicit start/state nodes.", archiveDir, "full-session-graph-with-starts", dotGraph(graph, current, { starts: true }));
	await writeFile(join(archiveDir, "raw-graph-data.json"), JSON.stringify(graphExportData(graph), null, 2) + "\n");
	artifacts.push({ title: "Raw graph data JSON", path: join(archiveDir, "raw-graph-data.json"), description: "Metadata-only graph snapshot used by the reports." });
	await addDot("Repo jump map", "Weighted repo/project transition graph; edges with weight 2+ only.", reportDir, "02-repo-jump-map", repoJumpDot(graph, 2));
	artifacts.push(await writeActiveHoursReport(reportDir, graph, stamp));
	await addDot("Meaningful lineage forest", "Connected meaningful chains; isolated and zero-line dead-end noise filtered.", reportDir, "05-meaningful-lineage-forest", dotGraph(meaningfulLineageGraph(graph), current));
	const focusedGraph = rebuildGraph(graph, graph.records.filter(isFocusedLineageRecord));
	const lineageFullPath = join(reportDir, "06-lineage-full-interactive.html");
	const lineageFocusedPath = join(reportDir, "07-lineage-focused-interactive.html");
	const timelineProjectsPath = join(reportDir, "08-timeline-projects.html");
	const timelineSessionsPath = join(reportDir, "09-timeline-sessions.html");
	await writeHtmlViewer(reportDir, graph, { title: `${stamp} — Lineage Full Interactive`, outputPath: lineageFullPath });
	await writeHtmlViewer(reportDir, focusedGraph, { title: `${stamp} — Lineage Focused Interactive`, outputPath: lineageFocusedPath });
	await writeTemporalHtml(reportDir, graph, timelineProjectsPath, `${stamp} — Timeline Projects`, "label");
	await writeTemporalHtml(reportDir, graph, timelineSessionsPath, `${stamp} — Timeline Sessions`, "sessionId");
	artifacts.push(
		{ title: "Lineage Full Interactive", path: lineageFullPath, description: "Inventory-style interactive full lineage." },
		{ title: "Lineage Focused Interactive", path: lineageFocusedPath, description: "Interactive graph limited to sessions with meaningful edges." },
		{ title: "Timeline Projects", path: timelineProjectsPath, description: "Timeline grouped by project/cwd." },
		{ title: "Timeline Sessions", path: timelineSessionsPath, description: "Timeline grouped by individual session." },
	);
	artifacts.push(...await writeHotspotReports(reportDir, graph, stamp));
	artifacts.push(...await writeFocusReports(reportDir, graph, stamp));
	artifacts.push(...await writeProjectVisualizations(reportDir, graph, stamp));
	artifacts.push(...await writeChartTimelineReports(reportDir, graph, stamp));
	const rel = (path: string) => path.startsWith(root) ? path.slice(root.length + 1) : path;
	const indexPath = join(root, "index.html");
	const readmePath = join(root, "README.md");
	const sortedArtifacts = [...artifacts].sort((a, b) => rel(a.path).localeCompare(rel(b.path), undefined, { numeric: true }));
	const artifactStem = (relativePath: string) => relativePath.replace(/\.[^.\/]+$/, "");
	const artifactList = (section: "reports" | "archive") => {
		const sectionArtifacts = sortedArtifacts.filter((artifact) => rel(artifact.path).startsWith(`${section}/`));
		const groups = new Map<string, ReportArtifact[]>();
		for (const artifact of sectionArtifacts) {
			const key = artifactStem(rel(artifact.path));
			const list = groups.get(key) ?? [];
			list.push(artifact);
			groups.set(key, list);
		}
		const items = [...groups.entries()]
			.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
			.flatMap(([, group], groupIndex) => {
				const sortedGroup = group.sort((a, b) => rel(a.path).localeCompare(rel(b.path), undefined, { numeric: true }));
				return sortedGroup.map((artifact, variantIndex) => {
					const number = sortedGroup.length > 1 ? `${groupIndex + 1}${String.fromCharCode(97 + variantIndex)}` : `${groupIndex + 1}`;
					return `<li value="${groupIndex + 1}"><span class="muted">${number}.</span> <a href="${escapeHtml(rel(artifact.path))}">${escapeHtml(rel(artifact.path))}</a> — ${escapeHtml(artifact.title)}<br/><span class="muted">${escapeHtml(artifact.description)}</span></li>`;
				});
			});
		return items.join("\n") || `<li class="muted">No ${section} artifacts.</li>`;
	};
	const indexBody = `<p class="muted">Generated ${new Date().toISOString()} from ${graph.source}. Reports explain what to notice; archive preserves raw graph artifacts for reconstruction.</p><div class="card"><h2>Summary</h2><ul><li>Sessions: ${graph.nodes.size}</li><li>Edges: ${graph.records.length}</li><li>Roots: ${roots(graph).length}</li><li>Leaves: ${leaves(graph).length}</li></ul></div><div class="card"><h2>Archive</h2><ol>${artifactList("archive")}</ol></div><div class="card"><h2>Reports</h2><ol>${artifactList("reports")}</ol></div>`;
	await writeFile(indexPath, reportShell(`${stamp} — Session Graph Report Index`, indexBody));
	await writeFile(readmePath, [`# Session graph report pack`, ``, `Generated: ${new Date().toISOString()}`, ``, `Open index.html first.`, ``, `Recommended reading order:`, `1. reports/01-hotspots.html`, `2. reports/02-repo-jump-map.svg`, `3. reports/03-false-starts.html`, `4. reports/04-active-hours.html`, `5. reports/05-meaningful-lineage-forest.svg`, `6. reports/06-lineage-full-interactive.html and later files`, `7. reports/09-project-focus-index.html`, `8. reports/13-project-gantt.html`, `9. reports/14-weekly-project-area.html`, `10. reports/15-project-treemap.html`, `11. reports/16-chart-timeline-projects.html`, `12. archive/ only for archaeology/reconstruction`, ``, `Archive preserves what happened. Reports explain what to notice.`, ``].join("\n"));
	return { root, indexPath, readmePath, artifacts };
}

async function writeNamedInteractiveViewers(graph: Graph) {
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

async function sessionGraphsWriteLines(_graph: Graph, current?: string) {
	const refreshLines = await refreshStoreExport();
	const graph = await buildGraph();
	const pack = await writeReportPack(graph, current);
	return [
		"Session graph report pack",
		"",
		...refreshLines,
		"",
		`Report folder: ${shortPath(pack.root)}`,
		`Open first: ${shortPath(pack.indexPath)}`,
		`README: ${shortPath(pack.readmePath)}`,
		`Artifacts: ${pack.artifacts.length}`,
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
		"  dot [--svg]         Write Graphviz DOT, optionally SVG if dot is installed",
		"  graphs              Rebuild/export and write graph HTML artifacts",
		"",
		"Options:",
		"  --input <path>      Read a specific graph export JSON",
		"  -h, --help          Show this help",
		"  -V, --version       Show version",
	].join("\n");
}

async function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
	const subcommand = argv[0];
	if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") return cliUsage();
	if (subcommand === "--version" || subcommand === "-V" || subcommand === "-v" || subcommand === "version") return packageVersion;
	const rest = argv.slice(1);
	const flags = new Set(rest);
	const inputPath = optionValue(rest, "--input");
	const graph = await buildGraph(inputPath);
	const current = process.env.PI_SESSION_FILE;
	if (subcommand === "status") return statusLines(graph, current, cwd).join("\n");
	if (subcommand === "lineage") return lineageLines(graph, current, flags.has("--files")).join("\n");
	if (subcommand === "leaves") return leavesLines(graph, current, flags.has("--all")).join("\n");
	if (subcommand === "repos") return reposLines(graph).join("\n");
	if (subcommand === "dot" || subcommand === "graphviz") return (await dotWriteLines(cwd, graph, current, { svg: flags.has("--svg") })).join("\n");
	if (subcommand === "graphs") return (await sessionGraphsWriteLines(graph, current)).join("\n");
	return cliUsage();
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


	pi.registerCommand("session-graphs", {
		description: "Generate session graph artifacts. Use --dot for Graphviz DOT/SVG output.",
		handler: async (args, ctx) => {
			const flags = parseFlags(args);
			const parsed = parseArgs(args);
			const graph = await buildGraph();
			const current = currentSession(ctx);
			const lines = flags.has("--dot") || parsed.includes("dot") || parsed.includes("graphviz")
				? await dotWriteLines(ctx.cwd, graph, current, { svg: flags.has("--svg") })
				: await sessionGraphsWriteLines(graph, current);
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}

export { buildGraph, leaves, lineageFor, listSessionFiles, mermaid, roots, runCli, sessionId };
