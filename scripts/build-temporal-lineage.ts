import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

type RelocationRecord = {
	ts: string;
	fromCwd: string;
	toCwd: string;
	sourceSession: string;
	destinationSession: string;
	parent?: string;
	inferred?: boolean;
	confidence?: string;
	replacements?: number | null;
};

type OverlayRecord =
	| { kind: "root"; session: string; historicalCwd?: string; label?: string; confidence?: string; evidence?: string[]; notes?: string[] }
	| { kind: "edge"; source: string; destination: string; fromCwd?: string; toCwd?: string; ts?: string; confidence?: string; lineageKind?: string; evidence?: string[]; notes?: string[] }
	| { kind: "alias"; path: string; label: string; note?: string }
	| { kind: "classification"; manifestIndex: number; lineageKind?: string; recordConfidence?: string; continuationConfidence?: string };

type SessionStats = {
	path: string;
	exists: boolean;
	currentLines: number;
	startTimestamp?: string;
	firstTimestamp?: string;
	lastTimestamp?: string;
	bytes?: number;
};

type TemporalEdge = {
	id: string;
	kind: "manifest" | "overlay";
	manifestIndex?: number;
	lineageKind?: string;
	ts: string;
	fromCwd: string;
	toCwd: string;
	sourceSession: string;
	destinationSession: string;
	sourceLinesAtEvent?: number;
	sourceLastTimestampAtEvent?: string;
	sourceCurrentLines?: number;
	destinationCurrentLines?: number;
	confidence?: string;
	recordConfidence?: string;
	continuationConfidence?: string;
	replacements?: number | null;
	notes?: string[];
};

const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const outputDir = join(agentDir, "session-graph");
const manifestPath = join(agentDir, "relocations.jsonl");
const overlayPath = join(outputDir, "lineage-overlays.jsonl");
const sessionsDir = join(agentDir, "sessions");

function shortHash(value: string) {
	return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function homeShort(path: string) {
	return path.startsWith(`${home}/`) ? `~/${path.slice(home.length + 1)}` : path;
}

function sessionStartTimestamp(path: string) {
	const match = basename(path).match(/^(\d{4}-\d{2}-\d{2}T\d{2}[-:]\d{2}[-:]\d{2}[.-]\d{3}Z)/);
	return match?.[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z");
}

function label(cwd: string | undefined, session: string) {
	if (cwd && !cwd.startsWith("(")) return basename(cwd) || cwd;
	const bucket = session.match(/\/sessions\/--(.+?)--\//)?.[1];
	if (bucket) return bucket.replace(/^Users-sam-git-/, "").replaceAll("-", "/");
	return basename(session).slice(0, 32);
}

async function listSessionFiles(root = sessionsDir) {
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

async function readJsonl<T>(path: string): Promise<T[]> {
	try {
		const raw = await readFile(path, "utf8");
		return raw.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line) as T);
	} catch {
		return [];
	}
}

function rowTimestamp(row: unknown): string | undefined {
	if (!row || typeof row !== "object") return undefined;
	const obj = row as Record<string, unknown>;
	for (const key of ["timestamp", "ts", "createdAt", "time"]) {
		const value = obj[key];
		if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
	}
	const message = obj.message;
	if (message && typeof message === "object") {
		const value = (message as Record<string, unknown>).timestamp;
		if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
	}
	return undefined;
}

async function sessionStats(path: string): Promise<SessionStats> {
	try {
		const [raw, st] = await Promise.all([readFile(path, "utf8"), stat(path)]);
		let currentLines = 0;
		let firstTimestamp: string | undefined;
		let lastTimestamp: string | undefined;
		for (const line of raw.split("\n")) {
			if (!line.trim()) continue;
			currentLines++;
			try {
				const ts = rowTimestamp(JSON.parse(line));
				if (ts) {
					firstTimestamp ??= ts;
					lastTimestamp = ts;
				}
			} catch {
				// Ignore malformed forensic rows; preserve counts.
			}
		}
		return { path, exists: true, currentLines, startTimestamp: sessionStartTimestamp(path), firstTimestamp, lastTimestamp, bytes: st.size };
	} catch {
		return { path, exists: false, currentLines: 0 };
	}
}

async function linesAt(path: string, eventTs: string): Promise<{ lines?: number; lastTimestamp?: string }> {
	try {
		const raw = await readFile(path, "utf8");
		let lines = 0;
		let lastTimestamp: string | undefined;
		for (const line of raw.split("\n")) {
			if (!line.trim()) continue;
			try {
				const ts = rowTimestamp(JSON.parse(line));
				if (ts && ts > eventTs) break;
				lines++;
				if (ts) lastTimestamp = ts;
			} catch {
				lines++;
			}
		}
		return { lines, lastTimestamp };
	} catch {
		return {};
	}
}

function manifestClassifications(overlays: OverlayRecord[]) {
	const byIndex = new Map<number, Extract<OverlayRecord, { kind: "classification" }>>();
	for (const record of overlays) if (record.kind === "classification") byIndex.set(record.manifestIndex, record);
	return byIndex;
}

async function build() {
	const manifest = await readJsonl<RelocationRecord>(manifestPath);
	const overlays = await readJsonl<OverlayRecord>(overlayPath);
	const discoveredSessions = await listSessionFiles();
	const classifications = manifestClassifications(overlays);
	const overlayEdges = overlays.filter((record): record is Extract<OverlayRecord, { kind: "edge" }> => record.kind === "edge");
	const sessions = new Set<string>();
	for (const record of manifest) {
		sessions.add(record.sourceSession);
		sessions.add(record.destinationSession);
	}
	for (const record of overlayEdges) {
		sessions.add(record.source);
		sessions.add(record.destination);
	}
	for (const record of overlays) if (record.kind === "root") sessions.add(record.session);
	for (const session of discoveredSessions) sessions.add(session);

	const statsEntries = await Promise.all([...sessions].map(async (path) => [path, await sessionStats(path)] as const));
	const stats = new Map(statsEntries);
	const edges: TemporalEdge[] = [];

	for (const [index, record] of manifest.entries()) {
		const cls = classifications.get(index + 1);
		const at = await linesAt(record.sourceSession, record.ts);
		edges.push({
			id: `manifest-${index + 1}`,
			kind: "manifest",
			manifestIndex: index + 1,
			lineageKind: cls?.lineageKind ?? (record.inferred ? "manifest-inferred" : "manifest-explicit"),
			ts: record.ts,
			fromCwd: record.fromCwd,
			toCwd: record.toCwd,
			sourceSession: record.sourceSession,
			destinationSession: record.destinationSession,
			sourceLinesAtEvent: at.lines,
			sourceLastTimestampAtEvent: at.lastTimestamp,
			sourceCurrentLines: stats.get(record.sourceSession)?.currentLines,
			destinationCurrentLines: stats.get(record.destinationSession)?.currentLines,
			confidence: record.confidence,
			recordConfidence: cls?.recordConfidence,
			continuationConfidence: cls?.continuationConfidence,
			replacements: record.replacements,
		});
	}

	for (const [index, record] of overlayEdges.entries()) {
		const ts = record.ts ?? "0000-00-00T00:00:00.000Z";
		const at = await linesAt(record.source, ts);
		edges.push({
			id: `overlay-${index + 1}`,
			kind: "overlay",
			lineageKind: record.lineageKind ?? "overlay-edge",
			ts,
			fromCwd: record.fromCwd ?? "(overlay/unknown)",
			toCwd: record.toCwd ?? "(overlay/unknown)",
			sourceSession: record.source,
			destinationSession: record.destination,
			sourceLinesAtEvent: at.lines,
			sourceLastTimestampAtEvent: at.lastTimestamp,
			sourceCurrentLines: stats.get(record.source)?.currentLines,
			destinationCurrentLines: stats.get(record.destination)?.currentLines,
			confidence: record.confidence,
			notes: record.notes,
		});
	}

	edges.sort((a, b) => a.ts.localeCompare(b.ts));
	const sessionStarts = [...stats.values()]
		.filter((record) => record.startTimestamp)
		.map((record) => ({ path: record.path, ts: record.startTimestamp!, label: label(undefined, record.path), currentLines: record.currentLines, exists: record.exists }))
		.sort((a, b) => a.ts.localeCompare(b.ts));
	return { generatedAt: new Date().toISOString(), inputs: { manifestPath, overlayPath, sessionsDir }, sessionStats: Object.fromEntries(stats), sessionStarts, edges };
}

function mermaid(report: Awaited<ReturnType<typeof build>>, options: { allStarts?: boolean } = {}) {
	const lines = ["flowchart LR"];
	const connectedSessions = new Set<string>();
	for (const edge of report.edges) {
		connectedSessions.add(edge.sourceSession);
		connectedSessions.add(edge.destinationSession);
	}
	const sessionIds = new Map<string, string>();
	function sessionNode(path: string, cwd: string | undefined, currentLines: number | undefined) {
		const existing = sessionIds.get(path);
		if (existing) return existing;
		const id = `n_${shortHash(path)}`;
		sessionIds.set(path, id);
		lines.push(`  ${id}["${label(cwd, path)}<br/>session<br/>current lines: ${currentLines ?? "?"}"]`);
		return id;
	}
	const starts = options.allStarts ? report.sessionStarts : report.sessionStarts.filter((start) => connectedSessions.has(start.path));
	for (const start of starts) {
		const nodeId = sessionNode(start.path, undefined, start.currentLines);
		const startId = `start_${shortHash(start.path)}`;
		lines.push(`  ${startId}(("start<br/>${start.ts.slice(0, 16)}"))`);
		lines.push(`  ${startId} --> ${nodeId}`);
	}
	const edgesBySource = new Map<string, TemporalEdge[]>();
	for (const edge of report.edges) {
		const list = edgesBySource.get(edge.sourceSession) ?? [];
		list.push(edge);
		edgesBySource.set(edge.sourceSession, list);
		sessionNode(edge.sourceSession, edge.fromCwd, edge.sourceCurrentLines);
		sessionNode(edge.destinationSession, edge.toCwd, edge.destinationCurrentLines);
	}
	for (const [source, sourceEdges] of edgesBySource) {
		sourceEdges.sort((a, b) => a.ts.localeCompare(b.ts));
		const sourceId = sessionIds.get(source)!;
		let previousState: string | undefined;
		for (const edge of sourceEdges) {
			const stateId = `s_${shortHash(`${edge.sourceSession}:${edge.ts}:${edge.id}`)}`;
			const destId = sessionIds.get(edge.destinationSession)!;
			const edgeLabel = `${edge.kind}${edge.manifestIndex ? ` #${edge.manifestIndex}` : ""}<br/>${edge.ts.slice(0, 16)}<br/>${edge.lineageKind ?? ""}`;
			const stateLabel = `state @ ${edge.ts.slice(0, 16)}<br/>lines≤ts: ${edge.sourceLinesAtEvent ?? "?"}`;
			lines.push(`  ${sourceId} -. progression .-> ${stateId}{{"${stateLabel}"}}`);
			if (previousState) lines.push(`  ${previousState} -. later .-> ${stateId}`);
			lines.push(`  ${stateId} -->|"${edgeLabel}"| ${destId}`);
			previousState = stateId;
		}
	}
	lines.push("  classDef start fill:#e0e7ff,stroke:#4f46e5;");
	lines.push("  classDef session fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px;");
	lines.push("  classDef state fill:#fef3c7,stroke:#d97706;");
	for (const start of starts) lines.push(`  class start_${shortHash(start.path)} start;`);
	for (const id of sessionIds.values()) lines.push(`  class ${id} session;`);
	for (const edge of report.edges) lines.push(`  class s_${shortHash(`${edge.sourceSession}:${edge.ts}:${edge.id}`)} state;`);
	return lines.join("\n");
}

function html(report: Awaited<ReturnType<typeof build>>, mmd: string) {
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Temporal session lineage</title>
<script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs'; mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' });</script>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:2rem;line-height:1.4}.legend{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem}.mermaid{border:1px solid #e5e7eb;border-radius:8px;padding:1rem;overflow:auto}code{background:#f3f4f6;padding:0.1rem 0.25rem;border-radius:4px}</style>
</head>
<body>
<h1>Temporal session lineage</h1>
<p>Generated: ${report.generatedAt}</p>
<div class="legend">
<ul>
<li><strong>Purple circles</strong>: session starts from JSONL filename timestamps. By default the diagram shows starts only for sessions connected to relocation/overlay edges, to avoid Mermaid browser size limits. The JSON/Markdown event data still includes all discovered starts.</li>
<li><strong>Blue boxes</strong>: session files/topology nodes.</li>
<li><strong>Yellow diamonds</strong>: source-session states at specific relocation times.</li>
<li><strong>Dotted arrows</strong>: progression inside the same append-only session file.</li>
<li><strong>Solid arrows</strong>: relocation/fork edges to destination sessions.</li>
<li><code>lines≤ts</code>: accumulated JSONL rows in the source session up to that relocation timestamp.</li>
</ul>
</div>
<div class="mermaid">${mmd}</div>
</body>
</html>
`;
}

function markdown(report: Awaited<ReturnType<typeof build>>, mmd: string) {
	const lines = [
		"# Temporal session lineage",
		"",
		`Generated: ${report.generatedAt}`,
		"",
		"This report models both topology and progression. Purple circles are session starts from JSONL filename timestamps; the Mermaid diagram shows starts for relocation-connected sessions by default to avoid browser size limits, while JSON data includes all discovered starts. Blue boxes are session files. Yellow diamonds are time-indexed states of a source session at a relocation timestamp. Dotted arrows show progression within a session file; solid arrows show relocation/fork edges to destination sessions. It does not include transcript content.",
		"",
		`Manifest: ${homeShort(report.inputs.manifestPath)}`,
		`Overlay: ${homeShort(report.inputs.overlayPath)}`,
		`Session starts: ${report.sessionStarts.length}`,
		`Edges: ${report.edges.length}`,
		`Sessions: ${Object.keys(report.sessionStats).length}`,
		"",
		"```mermaid",
		mmd,
		"```",
		"",
		"## Events",
		"",
	];
	for (const edge of report.edges) {
		lines.push(`- ${edge.ts} ${edge.kind}${edge.manifestIndex ? ` #${edge.manifestIndex}` : ""}: ${label(edge.fromCwd, edge.sourceSession)} -> ${label(edge.toCwd, edge.destinationSession)} (${edge.lineageKind ?? "unclassified"})`);
		lines.push(`  - source lines at event: ${edge.sourceLinesAtEvent ?? "unknown"}; source current lines: ${edge.sourceCurrentLines ?? "unknown"}; destination current lines: ${edge.destinationCurrentLines ?? "unknown"}`);
	}
	lines.push("");
	return lines.join("\n");
}

async function main() {
	const snapshot = process.argv.includes("--snapshot");
	const allStarts = process.argv.includes("--all-starts");
	await mkdir(outputDir, { recursive: true });
	const report = await build();
	const mmd = mermaid(report, { allStarts });
	const md = markdown(report, mmd);
	const htmlDoc = html(report, mmd);
	const latestFiles = [
		["temporal-lineage.json", JSON.stringify(report, null, 2) + "\n"],
		["temporal-lineage.mmd", mmd + "\n"],
		["temporal-lineage.md", md],
		["temporal-lineage.html", htmlDoc],
	] as const;
	for (const [name, content] of latestFiles) await writeFile(join(outputDir, name), content);
	let snapshotDir: string | undefined;
	if (snapshot) {
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		snapshotDir = join(outputDir, "snapshots", "temporal-lineage");
		await mkdir(snapshotDir, { recursive: true });
		for (const [name, content] of latestFiles) await writeFile(join(snapshotDir, name.replace("temporal-lineage", `temporal-lineage_${stamp}`)), content);
	}
	console.log(`Wrote temporal lineage with ${report.edges.length} edges to ${outputDir}`);
	if (snapshotDir) console.log(`Wrote timestamped snapshot to ${snapshotDir}`);
}

await main();
