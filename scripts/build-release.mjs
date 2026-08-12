import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digest, validateManifest } from "../packages/contracts/src/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const sources = ["sources/code-as-agent-harness/implementation.source.json", "patterns/executable-stateful-harness/implementation.source.json"];
const manifests = [];
for (const source of sources) {
  const record = JSON.parse(await readFile(path.join(root, source), "utf8"));
  const manifest = { ...record, schemaVersion: "hopper.pattern-implementation-release.v1", repository: { ...record.repository, commit } };
  validateManifest(manifest);
  manifests.push(manifest);
}
const release = { schemaVersion: "hopper.pattern-implementation-index.v1", productId: "hopper.pattern-implementations", version: "0.1.0", commit, implementations: manifests };
release.digest = digest(release);
await mkdir(path.join(root, "releases"), { recursive: true });
await writeFile(path.join(root, "releases/index.json"), `${JSON.stringify(release, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, commit, implementations: manifests.length, digest: release.digest }));
