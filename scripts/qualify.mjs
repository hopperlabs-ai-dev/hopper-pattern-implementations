import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { qualifyManifest } from "../packages/conformance/src/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tests = spawnSync(process.execPath, ["--test", "test/contracts.test.mjs", "test/harness.test.mjs"], { cwd: root, encoding: "utf8" });
if (tests.status !== 0) throw new Error(`${tests.stdout}${tests.stderr}`);
async function sourceManifests(directory = root) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "releases"].includes(entry.name)) continue;
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await sourceManifests(resolved));
    else if (entry.name.endsWith("implementation.source.json")) output.push(path.relative(root, resolved));
  }
  return output.sort();
}
for (const manifest of await sourceManifests()) await qualifyManifest(root, manifest, { allowSelf: true });
const build = spawnSync(process.execPath, ["scripts/build-release.mjs"], { cwd: root, encoding: "utf8" });
if (build.status !== 0) throw new Error(`${build.stdout}${build.stderr}`);
const ideaEvaluation = spawnSync(process.execPath, ["ideas/value-migration-under-cheap-cognition/eval/run.mjs"], { cwd: root, encoding: "utf8" });
if (ideaEvaluation.status !== 0) throw new Error(`${ideaEvaluation.stdout}${ideaEvaluation.stderr}`);
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
  assert.equal((await fetch("http://127.0.0.1:47622/subjects/thesis/value-migration-under-cheap-cognition")).status, 200);
  const idea = await fetch("http://127.0.0.1:47622/api/ideas/value-migration/evaluate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rejectedAssumptions: ["a3"] }) });
  assert.equal(idea.status, 200);
  const ideaRun = await idea.json();
  assert.equal(ideaRun.queryResults.find((item) => item.propositionId === "c2-value-migrates").status, "blocked");
} finally { server.kill("SIGTERM"); }
const release = JSON.parse(await readFile(path.join(root, "releases/index.json"), "utf8"));
console.log(JSON.stringify({ ok: true, tests: 3, implementations: release.implementations.length, releaseDigest: release.digest, ideaEvaluation: JSON.parse(ideaEvaluation.stdout).digest }, null, 2));
