import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digest, validateManifest } from "../packages/contracts/src/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseSource = JSON.parse(await readFile(path.join(root, "releases/release.source.json"), "utf8"));
const commit = releaseSource.implementationCommit;
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Release source must pin one immutable implementation commit");
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
const sources = await sourceManifests();
const manifests = [];
for (const source of sources) {
  const record = JSON.parse(await readFile(path.join(root, source), "utf8"));
  const manifest = { ...record, schemaVersion: "hopper.pattern-implementation-release.v1", repository: { ...record.repository, commit } };
  validateManifest(manifest);
  manifests.push(manifest);
}
const release = { schemaVersion: "hopper.pattern-implementation-index.v1", productId: "hopper.pattern-implementations", version: releaseSource.version, commit, implementations: manifests };
release.digest = digest(release);
await mkdir(path.join(root, "releases"), { recursive: true });
await writeFile(path.join(root, "releases/index.json"), `${JSON.stringify(release, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, commit, implementations: manifests.length, digest: release.digest }));
