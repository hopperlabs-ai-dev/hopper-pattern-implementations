#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
if (process.argv[2] !== "quickstart") throw new Error("Usage: pattern-implementations quickstart");
for (const script of ["sources/code-as-agent-harness/reproduction/run.mjs", "patterns/executable-stateful-harness/poc/run.mjs"]) {
  const run = spawnSync(process.execPath, [script], { cwd: root, stdio: "inherit" }); if (run.status !== 0) process.exit(run.status || 1);
}
console.log("\nQualified demos: npm run demo  # http://127.0.0.1:47620");
