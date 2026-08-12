import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateManifest } from "../../contracts/src/index.mjs";

export async function qualifyManifest(root, manifestPath, options = {}) {
  const manifest = validateManifest(JSON.parse(await readFile(path.join(root, manifestPath), "utf8")), options);
  for (const artifact of Object.values(manifest.artifacts)) {
    const resolved = path.resolve(root, manifest.repository.subdirectory, artifact);
    if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error("Artifact escapes repository root");
    await readFile(resolved);
  }
  return manifest;
}
