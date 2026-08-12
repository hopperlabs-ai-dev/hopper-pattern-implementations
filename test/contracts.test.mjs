import test from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../packages/contracts/src/index.mjs";

test("release manifests require immutable commits", () => {
  const manifest = { schemaVersion: "hopper.pattern-implementation-release.v1", implementationId: "implementation:test", name: "Test implementation", primarySubject: { kind: "pattern", id: "pattern:test" }, relatedSubjects: [], level: "poc", status: "qualified", repository: { provider: "github", url: "https://github.com/example/test", commit: "SELF", subdirectory: "patterns/test", license: "Apache-2.0" }, entrypoints: {}, artifacts: {}, capabilities: [], verification: [], limitations: [] };
  assert.throws(() => validateManifest(manifest), /immutable/);
  assert.doesNotThrow(() => validateManifest(manifest, { allowSelf: true }));
});
