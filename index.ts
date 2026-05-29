import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";

const MANIFEST = "relocations.jsonl";

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
};

type SessionNode = {
	id: string;
	path: string;
	cwd: string;
	label: string;
};

type Graph = {
	records: RelocationRecord[];
	nodes: Map<string, SessionNode>;
	children: Map<string, RelocationRecord[]>;
	byDestination: Map<string, RelocationRecord>;
};

function agentDir() {
	return process.env.PI_CODING_AGENT_DIR ?? join(process.env.HOME ?? ".", ".pi", "agent");
}

function manifestFile() {
	return join(agentDir(), MANIFEST);
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
	return record.inferred ? "inferred" : "explicit";
}

function parseFlags(args: string) {
	const parts = args.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
	return new Set(parts.map((part) => part.replace(/^['"]|['"]$/g, "")));
}

async function readManifest(): Promise<RelocationRecord[]> {
	try {
		const raw = await readFile(manifestFile(), "utf8");
		return raw
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => JSON.parse(line) as RelocationRecord);
	} catch {
		return [];
	}
}

function addNode(nodes: Map<string, SessionNode>, path: string, cwd: string) {
	if (!path || path.startsWith("(")) return;
	if (!nodes.has(path)) nodes.set(path, { id: sessionId(path), path, cwd, label: cwdLabel(cwd) });
}

async function buildGraph(): Promise<Graph> {
	const records = await readManifest();
	const nodes = new Map<string, SessionNode>();
	const children = new Map<string, RelocationRecord[]>();
	const byDestination = new Map<string, RelocationRecord>();
	for (const record of records) {
		addNode(nodes, record.sourceSession, record.fromCwd);
		addNode(nodes, record.destinationSession, record.toCwd);
		const list = children.get(record.sourceSession) ?? [];
		list.push(record);
		children.set(record.sourceSession, list);
		byDestination.set(record.destinationSession, record);
	}
	return { records, nodes, children, byDestination };
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
	const lines = [`${index}. [${marker(record)}] ${cwdLabel(record.fromCwd)} -> ${cwdLabel(record.toCwd)}${currentMark}`, `   ${record.ts}`];
	if (files) {
		lines.push(`   source: ${shortPath(record.sourceSession)}`);
		lines.push(`   dest:   ${shortPath(record.destinationSession)}`);
	}
	return lines;
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
		lines.push(`  ${from.id} ${style}|${record.ts.slice(0, 10)}| ${to.id}`);
	}
	return lines.join("\n");
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
				`Records: ${graph.records.length}`,
				`Sessions: ${graph.nodes.size}`,
				`Roots: ${roots(graph).length}`,
				`Leaves: ${leaves(graph).length}`,
				`Fork points: ${forks(graph).length}`,
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
		description: "Show known graph leaves.",
		handler: async (_args, ctx) => {
			const graph = await buildGraph();
			const current = currentSession(ctx);
			const nodes = leaves(graph).sort((a, b) => a.label.localeCompare(b.label));
			const lines = ["Session leaves", ""];
			for (const node of nodes) lines.push(`- ${node.label}${node.path === current ? " current" : ""} (${node.id})`);
			if (!nodes.length) lines.push("(none)");
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerCommand("session-graph", {
		description: "Show session graph summary. Use --mermaid for Mermaid output.",
		handler: async (args, ctx) => {
			const flags = parseFlags(args);
			const graph = await buildGraph();
			const current = currentSession(ctx);
			if (flags.has("--mermaid")) {
				ctx.ui.notify(mermaid(graph, current), "info");
				return;
			}
			const lines = [
				"Session graph",
				"",
				`Manifest: ${shortPath(manifestFile())}`,
				`Records: ${graph.records.length}`,
				`Sessions: ${graph.nodes.size}`,
				`Roots: ${roots(graph).length}`,
				`Leaves: ${leaves(graph).length}`,
				`Fork points: ${forks(graph).length}`,
				"",
				"Recent edges:",
			];
			for (const [index, record] of graph.records.slice(-10).entries()) lines.push(...formatHop(record, graph.records.length - Math.min(10, graph.records.length) + index + 1, current, false));
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}

export { buildGraph, leaves, lineageFor, listSessionFiles, mermaid, roots, sessionId };
