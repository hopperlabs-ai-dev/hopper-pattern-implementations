import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { qualifyManifest } from "../packages/conformance/src/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tests = spawnSync(process.execPath, ["--test", "test/contracts.test.mjs", "test/harness.test.mjs"], { cwd: root, encoding: "utf8" });
if (tests.status !== 0) throw new Error(`${tests.stdout}${tests.stderr}`);
for (const manifest of ["sources/code-as-agent-harness/implementation.source.json", "patterns/executable-stateful-harness/implementation.source.json"]) await qualifyManifest(root, manifest, { allowSelf: true });
const build = spawnSync(process.execPath, ["scripts/build-release.mjs"], { cwd: root, encoding: "utf8" });
if (build.status !== 0) throw new Error(`${build.stdout}${build.stderr}`);
const server = spawn(process.execPath, ["packages/demo-server/src/server.mjs"], { cwd: root, env: { ...process.env, HOPPER_PATTERN_DEMO_PORT: "47622" }, stdio: "ignore" });
try {
  let health;
  for (let attempt = 0; attempt < 80; attempt += 1) { try { const response = await fetch("http://127.0.0.1:47622/api/health"); if (response.ok) { health = await response.json(); break; } } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); }
  assert.equal(health?.ok, true);
  for (const mode of ["verified", "recoverable"]) {
    const response = await fetch("http://127.0.0.1:47622/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
    assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.status, mode);
  }
  for (const page of ["/subjects/source/code-as-agent-harness", "/subjects/pattern/executable-stateful-harness", "/diagrams/source/poc.svg", "/diagrams/pattern/production.svg"]) assert.equal((await fetch(`http://127.0.0.1:47622${page}`)).status, 200);
} finally { server.kill("SIGTERM"); }
const release = JSON.parse(await readFile(path.join(root, "releases/index.json"), "utf8"));
console.log(JSON.stringify({ ok: true, tests: 2, implementations: release.implementations.length, releaseDigest: release.digest }, null, 2));
