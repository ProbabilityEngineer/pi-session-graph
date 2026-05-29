#!/usr/bin/env node
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(process.env.HOME ?? ".", ".pi", "agent");
const sessionsDir = join(agentDir, "sessions");
const outDir = join(agentDir, "session-graph");
const manifestPath = join(agentDir, "relocations.jsonl");

type RelocationRecord = {
  ts: string;
  fromCwd: string;
  toCwd: string;
  sourceSession: string;
  destinationSession: string;
  inferred?: boolean;
};

type SessionMeta = {
  path: string;
  bucket: string;
  filenameTs?: string;
  birthtime: string;
  ctime: string;
  mtime: string;
  size: number;
  lines: number;
  manifestRoles: string[];
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

function parseFilenameTimestamp(path: string): string | undefined {
  const name = basename(path);
  const relocated = [...name.matchAll(/_relocated_(?:.*?_)?(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/g)].at(-1)?.[1];
  const raw = relocated ?? name.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/)?.[1];
  return raw?.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z");
}

async function readManifest(): Promise<RelocationRecord[]> {
  try {
    const raw = await readFile(manifestPath, "utf8");
    return raw.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line) as RelocationRecord);
  } catch {
    return [];
  }
}

function short(path: string): string {
  const home = process.env.HOME;
  return home && path.startsWith(`${home}/`) ? `~/${path.slice(home.length + 1)}` : path;
}

function bucketName(path: string): string {
  return basename(dirname(path));
}

function deltaSeconds(a?: string, b?: string): number | undefined {
  if (!a || !b) return undefined;
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return undefined;
  return Math.round((left - right) / 1000);
}

async function lineCount(path: string): Promise<number> {
  const raw = await readFile(path, "utf8").catch(() => "");
  return raw.split("\n").filter(Boolean).length;
}

async function main() {
  const manifest = await readManifest();
  const roles = new Map<string, string[]>();
  for (const [index, record] of manifest.entries()) {
    roles.set(record.sourceSession, [...(roles.get(record.sourceSession) ?? []), `source#${index + 1}`]);
    roles.set(record.destinationSession, [...(roles.get(record.destinationSession) ?? []), `dest#${index + 1}`]);
  }

  const files = await walk(sessionsDir);
  const metas: SessionMeta[] = [];
  for (const path of files) {
    const st = await stat(path);
    metas.push({
      path,
      bucket: bucketName(path),
      filenameTs: parseFilenameTimestamp(path),
      birthtime: st.birthtime.toISOString(),
      ctime: st.ctime.toISOString(),
      mtime: st.mtime.toISOString(),
      size: st.size,
      lines: await lineCount(path),
      manifestRoles: roles.get(path) ?? [],
    });
  }
  metas.sort((a, b) => (Date.parse(a.filenameTs ?? a.birthtime) - Date.parse(b.filenameTs ?? b.birthtime)) || a.path.localeCompare(b.path));

  const metaByPath = new Map(metas.map((meta) => [meta.path, meta]));
  const timeline = [
    "# Session file timeline",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Sessions: ${metas.length}`,
    "",
    "| filename ts | birthtime | mtime | lines | roles | bucket | file |",
    "|---|---|---:|---:|---|---|---|",
    ...metas.map((m) => `| ${m.filenameTs ?? ""} | ${m.birthtime} | ${m.mtime} | ${m.lines} | ${m.manifestRoles.join(", ")} | ${m.bucket} | \`${short(m.path)}\` |`),
    "",
  ].join("\n");

  const validations = manifest.map((record, index) => {
    const source = metaByPath.get(record.sourceSession);
    const dest = metaByPath.get(record.destinationSession);
    const destNameDelta = deltaSeconds(record.ts, dest?.filenameTs);
    const destBirthDelta = deltaSeconds(record.ts, dest?.birthtime);
    const sourceBirthDelta = deltaSeconds(record.ts, source?.birthtime);
    const warnings: string[] = [];
    if (!source) warnings.push("missing source file");
    if (!dest) warnings.push("missing destination file");
    if (destNameDelta !== undefined && Math.abs(destNameDelta) > 300) warnings.push("manifest ts far from destination filename ts");
    if (destBirthDelta !== undefined && Math.abs(destBirthDelta) > 300) warnings.push("manifest ts far from destination birthtime");
    return { index: index + 1, record, source, dest, destNameDelta, destBirthDelta, sourceBirthDelta, warnings };
  });

  const validationMd = [
    "# Session edge validation",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Manifest records: ${manifest.length}`,
    "",
    "| # | kind | edge | manifest ts | dest filename Δs | dest birth Δs | warnings |",
    "|---:|---|---|---|---:|---:|---|",
    ...validations.map((v) => `| ${v.index} | ${v.record.inferred ? "inferred" : "explicit"} | ${v.record.fromCwd} → ${v.record.toCwd} | ${v.record.ts} | ${v.destNameDelta ?? ""} | ${v.destBirthDelta ?? ""} | ${v.warnings.join(", ")} |`),
    "",
  ].join("\n");

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "session-file-timeline.md"), timeline);
  await writeFile(join(outDir, "edge-validation.md"), validationMd);
  await writeFile(join(outDir, "session-file-timeline.json"), JSON.stringify({ generatedAt: new Date().toISOString(), sessions: metas, validations }, null, 2));
  console.log(`Wrote ${join(outDir, "session-file-timeline.md")}`);
  console.log(`Wrote ${join(outDir, "edge-validation.md")}`);
  console.log(`Wrote ${join(outDir, "session-file-timeline.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
