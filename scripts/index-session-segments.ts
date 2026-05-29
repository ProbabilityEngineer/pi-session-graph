#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(process.env.HOME ?? ".", ".pi", "agent");
const sessionsDir = join(agentDir, "sessions");
const outDir = join(agentDir, "session-graph");
const manifestPath = join(agentDir, "relocations.jsonl");

type SegmentClass = "unique" | "duplicateHistorical";
type EdgeClass = "authoritativeManifest" | "uniqueSegmentEvidence" | "duplicatedSegmentEvidence" | "noisyCopiedEvidence";

type Segment = {
  id: string;
  session: string;
  segmentIndex: number;
  startLine: number;
  endLine: number;
  lineCount: number;
  hash: string;
  startTs?: string;
  endTs?: string;
  hasRelocateEvidence: boolean;
  destinations: string[];
  class?: SegmentClass;
  repeatedInFiles?: number;
  isTail?: boolean;
  isUniqueTail?: boolean;
};

type EdgeRank = {
  edge: SegmentEdge;
  score: number;
  reasons: string[];
  destinationExists: boolean;
  isSelfEdge: boolean;
  destinationBirthDeltaSeconds?: number;
};

type SegmentEdge = {
  fromSegment: string;
  toSession: string;
  kind: "relocated_to";
  evidenceSession: string;
  evidenceLine: number;
  destination: string;
  destinationsOnLine: number;
  destinationsInSegment: number;
  class?: EdgeClass;
  repeatedInFiles?: number;
  destinationExists?: boolean;
  isSelfEdge?: boolean;
  destinationBirthDeltaSeconds?: number;
};

type ManifestRecord = {
  sourceSession?: string;
  destinationSession?: string;
  fromCwd?: string;
  toCwd?: string;
  ts?: string;
  inferred?: boolean;
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

function hash(lines: string[]): string {
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

function shortHash(lines: string[]): string {
  return hash(lines).slice(0, 12);
}

function parseEntryTimestamp(line: string): string | undefined {
  try {
    const parsed = JSON.parse(line) as { timestamp?: number; ts?: string; message?: { timestamp?: number } };
    const value = parsed.timestamp ?? parsed.message?.timestamp;
    if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
    if (typeof parsed.ts === "string") return parsed.ts;
  } catch {
    // Ignore malformed or nonstandard session entries.
  }
  return undefined;
}

function isRelocateEvidence(line: string): boolean {
  return line.includes("/relocate") ||
    line.includes("Relocated session written") ||
    line.includes("Restart Pi with:") ||
    line.includes("pi --session");
}

function extractDestinations(raw: string): string[] {
  const matches = raw.match(/\/[^\s'"`]+\.jsonl/g) ?? [];
  return [...new Set(matches.filter((m) => m.includes("/.pi/agent/sessions/") && m.includes("_relocated_")))];
}

function segmentId(session: string, index: number, lines: string[]): string {
  return `seg_${createHash("sha256").update(`${session}\n${index}\n${shortHash(lines)}`).digest("hex").slice(0, 12)}`;
}

function buildSegments(session: string, lines: string[]): { segments: Segment[]; edges: SegmentEdge[] } {
  const boundaryEnds = new Set<number>();
  const destinationsByLine = new Map<number, string[]>();
  for (let i = 0; i < lines.length; i++) {
    if (!isRelocateEvidence(lines[i] ?? "")) continue;
    const window = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");
    const destinations = extractDestinations(window);
    if (destinations.length) destinationsByLine.set(i + 1, destinations);
    boundaryEnds.add(Math.min(lines.length, i + 8));
  }

  const sortedEnds = [...boundaryEnds].sort((a, b) => a - b).filter((end, idx, arr) => idx === 0 || end > arr[idx - 1]!);
  if (!sortedEnds.includes(lines.length)) sortedEnds.push(lines.length);

  const segments: Segment[] = [];
  const edges: SegmentEdge[] = [];
  let start = 1;
  for (const [segmentIndex, end] of sortedEnds.entries()) {
    if (end < start) continue;
    const segmentLines = lines.slice(start - 1, end);
    if (!segmentLines.length) continue;
    const id = segmentId(session, segmentIndex, segmentLines);
    const timestamps = segmentLines.map(parseEntryTimestamp).filter((ts): ts is string => Boolean(ts));
    const segmentDestinations = new Set<string>();
    for (const [line, destinations] of destinationsByLine.entries()) {
      if (line >= start && line <= end) for (const dest of destinations) segmentDestinations.add(dest);
    }
    segments.push({
      id,
      session,
      segmentIndex,
      startLine: start,
      endLine: end,
      lineCount: segmentLines.length,
      hash: hash(segmentLines),
      startTs: timestamps[0],
      endTs: timestamps.at(-1),
      hasRelocateEvidence: segmentDestinations.size > 0 || segmentLines.some(isRelocateEvidence),
      destinations: [...segmentDestinations],
    });
    for (const [line, destinations] of destinationsByLine.entries()) {
      if (line < start || line > end) continue;
      for (const destination of destinations) {
        edges.push({
          fromSegment: id,
          toSession: destination,
          kind: "relocated_to",
          evidenceSession: session,
          evidenceLine: line,
          destination,
          destinationsOnLine: destinations.length,
          destinationsInSegment: segmentDestinations.size,
        });
      }
    }
    start = end + 1;
  }
  return { segments, edges };
}

async function readManifest(): Promise<ManifestRecord[]> {
  const raw = await readFile(manifestPath, "utf8").catch(() => "");
  return raw.split("\n").map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line) as ManifestRecord]; } catch { return []; }
  });
}

function short(path: string): string {
  const home = process.env.HOME;
  return home && path.startsWith(`${home}/`) ? `~/${path.slice(home.length + 1)}` : path;
}

function edgeKey(source?: string, destination?: string): string {
  return `${source ?? ""}\n${destination ?? ""}`;
}

function isTruncatedPath(path: string): boolean {
  return path.includes("/sessions/...") || path.includes("..._relocated_");
}

async function exists(path: string): Promise<boolean> {
  if (isTruncatedPath(path)) return false;
  try { await stat(path); return true; } catch { return false; }
}

async function birthtime(path: string): Promise<string | undefined> {
  try { return (await stat(path)).birthtime.toISOString(); } catch { return undefined; }
}

function deltaSeconds(left?: string, right?: string): number | undefined {
  if (!left || !right) return undefined;
  const a = Date.parse(left);
  const b = Date.parse(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return Math.round((a - b) / 1000);
}

function fileTimestamp(date = new Date()): string {
  return date.toISOString().replaceAll(":", "-").replace(".", "-");
}

async function main() {
  const sessionFiles = await walk(sessionsDir);
  const manifest = await readManifest();
  const authoritativePairs = new Set(manifest.filter((r) => !r.inferred).map((r) => edgeKey(r.sourceSession, r.destinationSession)));
  const allSegments: Segment[] = [];
  const allEdges: SegmentEdge[] = [];
  for (const session of sessionFiles) {
    const raw = await readFile(session, "utf8").catch(() => "");
    const lines = raw.split("\n").filter(Boolean);
    const { segments, edges } = buildSegments(session, lines);
    allSegments.push(...segments);
    allEdges.push(...edges);
  }

  const duplicateGroups = new Map<string, Segment[]>();
  for (const segment of allSegments) {
    const group = duplicateGroups.get(segment.hash) ?? [];
    group.push(segment);
    duplicateGroups.set(segment.hash, group);
  }
  const duplicatedSegments = [...duplicateGroups.values()].filter((group) => group.length > 1);
  for (const group of duplicateGroups.values()) {
    const files = new Set(group.map((segment) => segment.session)).size;
    for (const segment of group) {
      segment.repeatedInFiles = files;
      segment.class = files > 1 ? "duplicateHistorical" : "unique";
    }
  }

  const bySession = new Map<string, Segment[]>();
  for (const segment of allSegments) bySession.set(segment.session, [...(bySession.get(segment.session) ?? []), segment]);
  const uniqueTails: Segment[] = [];
  for (const segments of bySession.values()) {
    segments.sort((a, b) => a.segmentIndex - b.segmentIndex);
    const tail = segments.at(-1);
    if (tail) tail.isTail = true;
    const uniqueTail = [...segments].reverse().find((segment) => segment.class === "unique") ?? tail;
    if (uniqueTail) {
      uniqueTail.isUniqueTail = true;
      uniqueTails.push(uniqueTail);
    }
  }

  const segmentById = new Map(allSegments.map((segment) => [segment.id, segment]));
  const destinationBirthtimes = new Map<string, string | undefined>();
  for (const destination of new Set(allEdges.map((edge) => edge.destination))) {
    destinationBirthtimes.set(destination, await birthtime(destination));
  }
  const rankedEdges: EdgeRank[] = [];
  for (const edge of allEdges) {
    const segment = segmentById.get(edge.fromSegment);
    edge.repeatedInFiles = segment?.repeatedInFiles;
    edge.destinationExists = await exists(edge.destination);
    edge.isSelfEdge = edge.evidenceSession === edge.destination;
    edge.destinationBirthDeltaSeconds = deltaSeconds(segment?.endTs, destinationBirthtimes.get(edge.destination));
    const explicit = authoritativePairs.has(edgeKey(edge.evidenceSession, edge.destination));
    if (explicit) edge.class = "authoritativeManifest";
    else if (!edge.destinationExists || edge.isSelfEdge || edge.destinationsOnLine > 2 || edge.destinationsInSegment > 3) edge.class = "noisyCopiedEvidence";
    else if (segment?.class === "unique") edge.class = "uniqueSegmentEvidence";
    else if ((segment?.repeatedInFiles ?? 0) > 3) edge.class = "noisyCopiedEvidence";
    else edge.class = "duplicatedSegmentEvidence";

    let score = 0;
    const reasons: string[] = [];
    if (explicit) { score += 100; reasons.push("manifest"); }
    if (edge.destinationExists) { score += 20; reasons.push("destination-exists"); } else { score -= 50; reasons.push("missing-or-truncated-destination"); }
    if (!edge.isSelfEdge) { score += 10; reasons.push("not-self"); } else { score -= 30; reasons.push("self-edge"); }
    if (segment?.class === "unique") { score += 10; reasons.push("unique-segment"); }
    if (edge.destinationsOnLine <= 1 && edge.destinationsInSegment <= 1) { score += 10; reasons.push("single-destination-evidence"); }
    if (edge.destinationBirthDeltaSeconds !== undefined && Math.abs(edge.destinationBirthDeltaSeconds) <= 300) { score += 10; reasons.push("near-destination-birthtime"); }
    rankedEdges.push({ edge, score, reasons, destinationExists: Boolean(edge.destinationExists), isSelfEdge: Boolean(edge.isSelfEdge), destinationBirthDeltaSeconds: edge.destinationBirthDeltaSeconds });
  }

  const usableEdges = allEdges.filter((edge) => edge.class === "authoritativeManifest" || edge.class === "uniqueSegmentEvidence");
  const suppressedEdges = allEdges.filter((edge) => edge.class === "duplicatedSegmentEvidence" || edge.class === "noisyCopiedEvidence");
  const bestByDestination = [...rankedEdges.reduce<Map<string, EdgeRank>>((acc, ranked) => {
    const current = acc.get(ranked.edge.destination);
    if (!current || ranked.score > current.score) acc.set(ranked.edge.destination, ranked);
    return acc;
  }, new Map()).values()].sort((a, b) => b.score - a.score);
  const manifestBackedSegmentEdges = rankedEdges.filter((ranked) => ranked.edge.class === "authoritativeManifest").sort((a, b) => b.score - a.score);
  const segmentOnlyCandidates = bestByDestination.filter((ranked) => ranked.edge.class === "uniqueSegmentEvidence");
  const classCounts = allEdges.reduce<Record<string, number>>((acc, edge) => {
    acc[edge.class ?? "unclassified"] = (acc[edge.class ?? "unclassified"] ?? 0) + 1;
    return acc;
  }, {});

  await mkdir(outDir, { recursive: true });
  const now = new Date();
  const generatedAt = now.toISOString();
  const stamp = fileTimestamp(now);
  const jsonPath = join(outDir, `segments_${stamp}.json`);
  const mdPath = join(outDir, `segments_${stamp}.md`);
  const latestJsonPath = join(outDir, "segments.json");
  const latestMdPath = join(outDir, "segments.md");
  const payload = { generatedAt, sessions: sessionFiles.length, segments: allSegments, edges: allEdges, rankedEdges, bestByDestination, manifestBackedSegmentEdges, segmentOnlyCandidates, usableEdges, suppressedEdges, duplicatedSegments, uniqueTails };
  const json = JSON.stringify(payload, null, 2);
  await writeFile(jsonPath, json);
  await writeFile(latestJsonPath, json);

  const report = [
    "# Session segment index",
    "",
    `Generated: ${generatedAt}`,
    `Sessions scanned: ${sessionFiles.length}`,
    `Segments: ${allSegments.length}`,
    `Relocation evidence edges: ${allEdges.length}`,
    `Usable edges: ${usableEdges.length}`,
    `Manifest-backed segment edges: ${manifestBackedSegmentEdges.length}`,
    `Segment-only best candidates: ${segmentOnlyCandidates.length}`,
    `Suppressed copied/duplicated edges: ${suppressedEdges.length}`,
    `Duplicate segment groups: ${duplicatedSegments.length}`,
    `Unique/session tail candidates: ${uniqueTails.length}`,
    "",
    "## Edge classes",
    ...Object.entries(classCounts).sort().map(([klass, count]) => `- ${klass}: ${count}`),
    "",
    "## Manifest-backed segment evidence",
    ...manifestBackedSegmentEdges.slice(0, 80).map((ranked) => `- score=${ranked.score} ${short(ranked.edge.evidenceSession)}:${ranked.edge.evidenceLine} → ${short(ranked.edge.destination)} (${ranked.reasons.join(", ")})`),
    manifestBackedSegmentEdges.length > 80 ? `- ... ${manifestBackedSegmentEdges.length - 80} more` : "",
    "",
    "## Segment-only best candidates",
    ...segmentOnlyCandidates.slice(0, 80).map((ranked) => `- score=${ranked.score} Δbirth=${ranked.destinationBirthDeltaSeconds ?? ""} ${short(ranked.edge.evidenceSession)}:${ranked.edge.evidenceLine} → ${short(ranked.edge.destination)} (${ranked.reasons.join(", ")})`),
    segmentOnlyCandidates.length > 80 ? `- ... ${segmentOnlyCandidates.length - 80} more` : "",
    "",
    "## Usable relocation evidence edges",
    ...usableEdges.slice(0, 120).map((edge) => `- [${edge.class}; exists=${edge.destinationExists}; self=${edge.isSelfEdge}; Δbirth=${edge.destinationBirthDeltaSeconds ?? ""}] ${short(edge.evidenceSession)}:${edge.evidenceLine} → ${short(edge.destination)}`),
    usableEdges.length > 120 ? `- ... ${usableEdges.length - 120} more` : "",
    "",
    "## Suppressed copied/duplicated evidence samples",
    ...suppressedEdges.slice(0, 40).map((edge) => `- [${edge.class}; repeatedInFiles=${edge.repeatedInFiles ?? "?"}; destinationsOnLine=${edge.destinationsOnLine}; destinationsInSegment=${edge.destinationsInSegment}] ${short(edge.evidenceSession)}:${edge.evidenceLine} → ${short(edge.destination)}`),
    suppressedEdges.length > 40 ? `- ... ${suppressedEdges.length - 40} more` : "",
    "",
    "## Unique tail candidates",
    ...uniqueTails.slice(0, 120).map((segment) => `- ${short(segment.session)}#${segment.segmentIndex} lines ${segment.startLine}-${segment.endLine} (${segment.lineCount} lines, ${segment.class}, repeatedInFiles=${segment.repeatedInFiles})`),
    uniqueTails.length > 120 ? `- ... ${uniqueTails.length - 120} more` : "",
    "",
    "Note: this is a non-destructive sidecar index. Session JSONLs are not modified.",
    "",
  ].join("\n");
  await writeFile(mdPath, report);
  await writeFile(latestMdPath, report);

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Updated ${latestJsonPath}`);
  console.log(`Updated ${latestMdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
