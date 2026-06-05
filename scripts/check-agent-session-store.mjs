#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const localBin = join(cwd, "node_modules", ".bin", process.platform === "win32" ? "agent-session-store.cmd" : "agent-session-store");
const localDist = join(cwd, "node_modules", "agent-session-store", "dist", "bin", "agent-session-store.js");

if (existsSync(localBin) || existsSync(localDist) || process.env.AGENT_SESSION_STORE_BIN) {
	process.exit(0);
}

console.warn([
	"[pi-session-graph] agent-session-store was not found after install.",
	"",
	"Install dependencies in this repo:",
	"  npm install",
	"",
	"Or install the backend globally:",
	"  npm install -g agent-session-store@latest",
	"",
	"Or point pi-session-graph at an existing install:",
	"  export AGENT_SESSION_STORE_BIN=/path/to/agent-session-store",
].join("\n"));
