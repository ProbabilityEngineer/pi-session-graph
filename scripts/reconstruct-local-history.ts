#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(process.env.HOME ?? ".", ".pi", "agent");
const sessionsDir = join(agentDir, "sessions");
const outDir = join(agentDir, "session-graph");

type Edge = {
  sourceSession: string;
  destinationSession: string;
  evidenceSession: string;
  evidenceLine: number;
  confidence: "relocate-output" | "filename-chain";
};

type SessionInfo = {
  path: string;
  size: number;
  lines: number;
  firstLineHash?: string;
  first16Hash?: string;
};

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(path);
  }
  return out;
}

function hash(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

async function inspectSession(path: string): Promise<SessionInfo> {
  const raw = await readFile(path, "utf8").catch(() => "");
  const lines = raw.split("\n").filter(Boolean);
  const st = await stat(path);
  return {
    path,
    size: st.size,
    lines: lines.length,
    firstLineHash: lines[0] ? hash(lines[0]) : undefined,
    first16Hash: lines.length ? hash(lines.slice(0, 16).join("\n")) : undefined,
  };
}

function extractDestinations(raw: string): string[] {
  const matches = raw.match(/\/[^\s'"`]+\.jsonl/g) ?? [];
  return [...new Set(matches.filter((m) => m.includes("/.pi/agent/sessions/") && m.includes("_relocated_")))];
}

async function main() {
  const sessionFiles = await walk(sessionsDir);
  const sessions: SessionInfo[] = [];
  const edges = new Map<string, Edge>();
  for (const path of sessionFiles) {
    const raw = await readFile(path, "utf8").catch(() => "");
    sessions.push(await inspectSession(path));
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i]?.includes("Relocated session written") && !lines[i]?.includes("pi --session")) continue;
      const window = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");
      for (const dest of extractDestinations(window)) {
        const key = `${path}->${dest}`;
        if (!edges.has(key)) edges.set(key, { sourceSession: path, destinationSession: dest, evidenceSession: path, evidenceLine: i + 1, confidence: "relocate-output" });
      }
    }
  }

  await mkdir(outDir, { recursive: true });
  const graph = { generatedAt: new Date().toISOString(), sessions, edges: [...edges.values()] };
  await writeFile(join(outDir, "reconstruction.json"), JSON.stringify(graph, null, 2));

  const report = [
    "# Session graph reconstruction",
    "",
    `Generated: ${graph.generatedAt}`,
    `Sessions scanned: ${sessions.length}`,
    `Edges found from relocate outputs: ${edges.size}`,
    "",
    "## Edges",
    ...[...edges.values()].map((e) => `- ${e.sourceSession} -> ${e.destinationSession} (${e.confidence}, ${e.evidenceSession}:${e.evidenceLine})`),
    "",
  ].join("\n");
  await writeFile(join(outDir, "reconstruction.md"), report);
  console.log(`Wrote ${join(outDir, "reconstruction.json")}`);
  console.log(`Wrote ${join(outDir, "reconstruction.md")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
