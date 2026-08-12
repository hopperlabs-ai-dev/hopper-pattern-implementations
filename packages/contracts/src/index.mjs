import { createHash } from "node:crypto";

export const canonicalJson = (value) => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right))) : item);
export const digest = (value) => `sha256:${createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex")}`;

export function validateManifest(manifest, { allowSelf = false } = {}) {
  const required = ["schemaVersion", "implementationId", "name", "primarySubject", "level", "status", "repository", "entrypoints", "artifacts", "capabilities", "verification", "limitations"];
  for (const key of required) if (!(key in manifest)) throw new Error(`Implementation manifest missing ${key}`);
  if (manifest.schemaVersion !== "hopper.pattern-implementation-release.v1") throw new Error("Unsupported implementation manifest");
  if (!manifest.implementationId.startsWith("implementation:")) throw new Error("Invalid implementation ID");
  if (!new Set(["source", "pattern", "claim", "synthesis"]).has(manifest.primarySubject.kind)) throw new Error("Invalid primary subject kind");
  if (!manifest.primarySubject.id.startsWith(`${manifest.primarySubject.kind}:`)) throw new Error("Primary subject ID does not match its kind");
  if (manifest.repository.provider !== "github") throw new Error("Only GitHub repository bindings are currently admitted");
  if (!/^https:\/\/github\.com\//.test(manifest.repository.url)) throw new Error("Repository must be an HTTPS GitHub URL");
  if (!(allowSelf && manifest.repository.commit === "SELF") && !/^[a-f0-9]{40}$/.test(manifest.repository.commit)) throw new Error("Repository commit must be immutable");
  return manifest;
}
