#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(process.env.HOME ?? ".", ".pi", "agent");
const sessionsDir = join(agentDir, "sessions");
const outDir = join(agentDir, "session-graph");
const manifestPath = join(agentDir, "relocations.jsonl");

type SessionInfo = {
  path: string;
  bucket: string;
  filename: string;
  sessionId?: string;
  filenameTs?: string;
  relocatedTs?: string;
  birthtime: string;
  mtime: string;
  lines: number;
  fullHash: string;
  rawLines: string[];
  lineHashes: string[];
  prefixHashes: string[];
};

type Divergence = {
  line: number;
  sourceType?: string;
  destinationType?: string;
  sourceTimestamp?: string;
  destinationTimestamp?: string;
  sourceMissing: boolean;
  destinationMissing: boolean;
};

type Candidate = {
  source: string;
  destination: string;
  sharedLines: number;
  sourceLines: number;
  destinationLines: number;
  destinationTailLines: number;
  firstDivergence?: Divergence;
  score: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
};

type ManifestLineageKind = "explicit-continuation" | "explicit-new-lineage" | "inferred-unresolved" | "inferred-prefix-candidate";

type ManifestRecord = {
  ts?: string;
  sourceSession?: string;
  destinationSession?: string;
  fromCwd?: string;
  toCwd?: string;
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

function canonicalLine(line: string): string {
  try {
    const parsed = JSON.parse(line) as { type?: string; cwd?: string } & Record<string, unknown>;
    // Relocated files intentionally rewrite the session cwd in the first session
    // metadata row. Treat that as container metadata, not transcript content.
    if (parsed.type === "session") delete parsed.cwd;
    return JSON.stringify(parsed);
  } catch {
    return line;
  }
}

function hashLines(lines: string[]): string {
  return createHash("sha256").update(lines.map(canonicalLine).join("\n")).digest("hex");
}

function lineHashes(lines: string[]): string[] {
  return lines.map((line) => createHash("sha256").update(canonicalLine(line)).digest("hex"));
}

function prefixHashes(lines: string[]): string[] {
  const out: string[] = [];
  const hash = createHash("sha256");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) hash.update("\n");
    hash.update(canonicalLine(lines[i] ?? ""));
    out.push(hash.copy().digest("hex"));
  }
  return out;
}

function parseIsoish(raw?: string): string | undefined {
  return raw?.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z");
}

function parseFilenameTimestamp(path: string): { filenameTs?: string; relocatedTs?: string } {
  const name = basename(path);
  const first = name.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/)?.[1];
  const relocated = [...name.matchAll(/_relocated_(?:.*?_)?(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/g)].at(-1)?.[1];
  return { filenameTs: parseIsoish(first), relocatedTs: parseIsoish(relocated) };
}

function parseSessionId(path: string): string | undefined {
  return basename(path).match(/^[^_]+_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)?.[1];
}

function bucket(path: string): string {
  return basename(dirname(path));
}

function short(path: string): string {
  const home = process.env.HOME;
  return home && path.startsWith(`${home}/`) ? `~/${path.slice(home.length + 1)}` : path;
}

function parseLineType(line?: string): string | undefined {
  if (!line) return undefined;
  try { return (JSON.parse(line) as { type?: string }).type; } catch { return undefined; }
}

function parseEntryTimestamp(line?: string): string | undefined {
  if (!line) return undefined;
  try { return (JSON.parse(line) as { timestamp?: string }).timestamp; } catch { return undefined; }
}

function deltaSeconds(a?: string, b?: string): number | undefined {
  if (!a || !b) return undefined;
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return undefined;
  return Math.round((left - right) / 1000);
}

async function loadSession(path: string): Promise<SessionInfo> {
  const raw = await readFile(path, "utf8").catch(() => "");
  const lines = raw.split("\n").filter(Boolean);
  const st = await stat(path);
  const timestamps = parseFilenameTimestamp(path);
  return {
    path,
    bucket: bucket(path),
    filename: basename(path),
    sessionId: parseSessionId(path),
    ...timestamps,
    birthtime: st.birthtime.toISOString(),
    mtime: st.mtime.toISOString(),
    lines: lines.length,
    fullHash: hashLines(lines),
    rawLines: lines,
    lineHashes: lineHashes(lines),
    prefixHashes: prefixHashes(lines),
  };
}

async function readManifest(): Promise<ManifestRecord[]> {
  const raw = await readFile(manifestPath, "utf8").catch(() => "");
  return raw.split("\n").map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line) as ManifestRecord]; } catch { return []; }
  });
}

function firstDivergence(source: SessionInfo, dest: SessionInfo, sharedLines: number): Divergence | undefined {
  if (sharedLines >= source.lines && sharedLines >= dest.lines) return undefined;
  const index = sharedLines;
  const sourceLine = source.rawLines[index];
  const destinationLine = dest.rawLines[index];
  return {
    line: index + 1,
    sourceType: parseLineType(sourceLine),
    destinationType: parseLineType(destinationLine),
    sourceTimestamp: parseEntryTimestamp(sourceLine),
    destinationTimestamp: parseEntryTimestamp(destinationLine),
    sourceMissing: sourceLine === undefined,
    destinationMissing: destinationLine === undefined,
  };
}

function commonPrefixLength(a: SessionInfo, b: SessionInfo): number {
  const max = Math.min(a.lineHashes.length, b.lineHashes.length);
  for (let i = 0; i < max; i++) if (a.lineHashes[i] !== b.lineHashes[i]) return i;
  return max;
}

function scoreCandidate(source: SessionInfo, dest: SessionInfo, manifestPairs: Set<string>, sharedLines = source.lines): Candidate {
  let score = 0;
  const reasons: string[] = [];
  if (source.lines === 0) { score -= 100; reasons.push("empty-source"); }
  const sourceCoverage = source.lines ? sharedLines / source.lines : 0;
  const destCoverage = dest.lines ? sharedLines / dest.lines : 0;
  if (source.lines === dest.lines && source.fullHash === dest.fullHash) { score -= 10; reasons.push("identical-file"); }
  if (sourceCoverage >= 0.95) { score += 25; reasons.push("source-nearly-prefix"); }
  else if (destCoverage >= 0.95) { score += 18; reasons.push("destination-nearly-prefix-of-source"); }
  else if (Math.min(sourceCoverage, destCoverage) >= 0.8) { score += 10; reasons.push("large-common-prefix"); }
  if (source.sessionId && source.sessionId === dest.sessionId) { score += 15; reasons.push("same-session-id"); }
  if (source.bucket !== dest.bucket) { score += 15; reasons.push("bucket-changed"); }
  if (dest.filename.includes("_relocated_")) { score += 15; reasons.push("destination-filename-relocated"); }
  const birthDelta = deltaSeconds(dest.birthtime, source.birthtime);
  if (birthDelta !== undefined && birthDelta >= 0) { score += 10; reasons.push("destination-created-after-source"); }
  const relocatedDelta = deltaSeconds(dest.birthtime, dest.relocatedTs);
  if (relocatedDelta !== undefined && Math.abs(relocatedDelta) <= 300) { score += 10; reasons.push("relocated-ts-near-birthtime"); }
  if (manifestPairs.has(`${source.path}\n${dest.path}`)) { score += 100; reasons.push("explicit-manifest"); }
  if (source.lines === dest.lines) score += 5;
  else score += Math.min(20, Math.floor(source.lines / 100));
  const confidence = score >= 140 ? "high" : score >= 55 ? "medium" : "low";
  return {
    source: source.path,
    destination: dest.path,
    sharedLines,
    sourceLines: source.lines,
    destinationLines: dest.lines,
    destinationTailLines: dest.lines - sharedLines,
    firstDivergence: firstDivergence(source, dest, sharedLines),
    score,
    confidence,
    reasons,
  };
}

function timestamp(date = new Date()): string {
  return date.toISOString().replaceAll(":", "-").replace(".", "-");
}

async function main() {
  const files = await walk(sessionsDir);
  const sessions = await Promise.all(files.map(loadSession));
  const manifest = await readManifest();
  const manifestPairs = new Set(manifest.filter((r) => !r.inferred && r.sourceSession && r.destinationSession).map((r) => `${r.sourceSession}\n${r.destinationSession}`));

  const candidatesByDestination = new Map<string, Candidate[]>();
  for (const dest of sessions) {
    for (const source of sessions) {
      if (source.path === dest.path) continue;
      if (Date.parse(source.birthtime) > Date.parse(dest.birthtime)) continue;
      if (source.sessionId && dest.sessionId && source.sessionId !== dest.sessionId && !manifestPairs.has(`${source.path}\n${dest.path}`)) continue;
      const sharedLines = commonPrefixLength(source, dest);
      if (sharedLines < 20) continue;
      const sourceCoverage = source.lines ? sharedLines / source.lines : 0;
      const destCoverage = dest.lines ? sharedLines / dest.lines : 0;
      const manifestBacked = manifestPairs.has(`${source.path}\n${dest.path}`);
      if (!manifestBacked && Math.max(sourceCoverage, destCoverage) < 0.95 && Math.min(sourceCoverage, destCoverage) < 0.8) continue;
      const candidate = scoreCandidate(source, dest, manifestPairs, sharedLines);
      candidatesByDestination.set(dest.path, [...(candidatesByDestination.get(dest.path) ?? []), candidate]);
    }
  }

  const bestCandidates = [...candidatesByDestination.entries()].map(([destination, candidates]) => {
    const sorted = candidates.sort((a, b) => b.score - a.score || b.sharedLines - a.sharedLines || a.source.localeCompare(b.source));
    const best = sorted[0];
    const ambiguous = sorted.length > 1 && sorted[1]?.sharedLines === best?.sharedLines && sorted[1]?.score === best?.score;
    return { destination, best, alternatives: sorted.slice(1, 8), ambiguous };
  }).filter((entry): entry is { destination: string; best: Candidate; alternatives: Candidate[]; ambiguous: boolean } => Boolean(entry.best));

  const forks = new Map<string, Candidate[]>();
  for (const entry of bestCandidates) forks.set(entry.best.source, [...(forks.get(entry.best.source) ?? []), entry.best]);
  const forkEntries = [...forks.entries()].filter(([, edges]) => edges.length > 1).sort((a, b) => b[1].length - a[1].length);
  const sessionByPath = new Map(sessions.map((session) => [session.path, session]));
  const manifestValidation = manifest.map((record, index) => {
    const source = record.sourceSession ? sessionByPath.get(record.sourceSession) : undefined;
    const destination = record.destinationSession ? sessionByPath.get(record.destinationSession) : undefined;
    const sharedLines = source && destination ? commonPrefixLength(source, destination) : undefined;
    const sourceCoverage = source && sharedLines !== undefined && source.lines ? sharedLines / source.lines : undefined;
    const destinationCoverage = destination && sharedLines !== undefined && destination.lines ? sharedLines / destination.lines : undefined;
    const match = record.sourceSession && record.destinationSession
      ? bestCandidates.find((entry) => entry.best.source === record.sourceSession && entry.best.destination === record.destinationSession)
      : undefined;
    const kind: ManifestLineageKind = record.inferred
      ? (match ? "inferred-prefix-candidate" : "inferred-unresolved")
      : (match ? "explicit-continuation" : "explicit-new-lineage");
    const recordConfidence = record.inferred ? (destination ? "medium" : "low") : (source && destination ? "high" : "medium");
    const continuationConfidence = match ? match.best.confidence : "low";
    return {
      index: index + 1,
      kind,
      inferred: Boolean(record.inferred),
      recordConfidence,
      continuationConfidence,
      fromCwd: record.fromCwd,
      toCwd: record.toCwd,
      source: record.sourceSession,
      destination: record.destinationSession,
      sourceExists: Boolean(source),
      destinationExists: Boolean(destination),
      sharedLines,
      sourceCoverage,
      destinationCoverage,
      prefixMatched: Boolean(match),
      candidate: match?.best,
    };
  });

  const now = new Date();
  const generatedAt = now.toISOString();
  const stamp = timestamp(now);
  await mkdir(outDir, { recursive: true });
  const payload = { generatedAt, sessions, bestCandidates, forkEntries, manifestValidation };
  const json = JSON.stringify(payload, null, 2);
  const jsonPath = join(outDir, `prefix-lineage_${stamp}.json`);
  const mdPath = join(outDir, `prefix-lineage_${stamp}.md`);
  await writeFile(jsonPath, json);
  await writeFile(join(outDir, "prefix-lineage.json"), json);

  const high = bestCandidates.filter((e) => e.best.confidence === "high");
  const medium = bestCandidates.filter((e) => e.best.confidence === "medium");
  const low = bestCandidates.filter((e) => e.best.confidence === "low");
  const matchedManifest = manifestValidation.filter((v) => v.prefixMatched).length;
  const manifestKindCounts = manifestValidation.reduce<Record<string, number>>((acc, record) => {
    acc[record.kind] = (acc[record.kind] ?? 0) + 1;
    return acc;
  }, {});
  const report = [
    "# Prefix-based session lineage reconstruction",
    "",
    `Generated: ${generatedAt}`,
    `Sessions scanned: ${sessions.length}`,
    `Destinations with prefix candidates: ${bestCandidates.length}`,
    `High confidence: ${high.length}`,
    `Medium confidence: ${medium.length}`,
    `Low confidence: ${low.length}`,
    `Fork sources: ${forkEntries.length}`,
    `Manifest records prefix-matched: ${matchedManifest}/${manifest.length}`,
    ...Object.entries(manifestKindCounts).sort().map(([kind, count]) => `Manifest ${kind}: ${count}`),
    "",
    "## Best candidates",
    "",
    "| confidence | score | shared | tail | source | destination | reasons |",
    "|---|---:|---:|---:|---|---|---|",
    ...bestCandidates.sort((a, b) => b.best.score - a.best.score || b.best.sharedLines - a.best.sharedLines).slice(0, 200).map((entry) => `| ${entry.best.confidence}${entry.ambiguous ? " ambiguous" : ""} | ${entry.best.score} | ${entry.best.sharedLines} | ${entry.best.destinationTailLines} | \`${short(entry.best.source)}\` | \`${short(entry.best.destination)}\` | ${entry.best.reasons.join(", ")} |`),
    bestCandidates.length > 200 ? `\n... ${bestCandidates.length - 200} more` : "",
    "",
    "## First divergence for best candidates",
    ...bestCandidates.sort((a, b) => b.best.score - a.best.score || b.best.sharedLines - a.best.sharedLines).slice(0, 80).map((entry) => {
      const d = entry.best.firstDivergence;
      return `- ${entry.best.confidence} score=${entry.best.score} line=${d?.line ?? "none"} sourceType=${d?.sourceType ?? "missing"} destType=${d?.destinationType ?? "missing"} sourceTs=${d?.sourceTimestamp ?? ""} destTs=${d?.destinationTimestamp ?? ""}: \`${short(entry.best.source)}\` → \`${short(entry.best.destination)}\``;
    }),
    "",
    "## Forks",
    ...forkEntries.slice(0, 80).map(([source, edges]) => `- \`${short(source)}\` → ${edges.length} destinations`),
    forkEntries.length > 80 ? `- ... ${forkEntries.length - 80} more` : "",
    "",
    "## Manifest validation",
    ...manifestValidation.map((v) => `- #${v.index} ${v.kind}: ${v.fromCwd ?? ""} → ${v.toCwd ?? ""} (recordConfidence=${v.recordConfidence}, continuationConfidence=${v.continuationConfidence}, shared=${v.sharedLines ?? ""}, sourceCoverage=${v.sourceCoverage === undefined ? "" : v.sourceCoverage.toFixed(2)}, destCoverage=${v.destinationCoverage === undefined ? "" : v.destinationCoverage.toFixed(2)}, sourceExists=${v.sourceExists}, destExists=${v.destinationExists})`),
    "",
    "Note: this uses exact source-file-as-prefix-of-destination-file matches and does not mutate session JSONLs or relocation manifests.",
    "",
  ].join("\n");
  await writeFile(mdPath, report);
  await writeFile(join(outDir, "prefix-lineage.md"), report);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Updated ${join(outDir, "prefix-lineage.json")}`);
  console.log(`Updated ${join(outDir, "prefix-lineage.md")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
