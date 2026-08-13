import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateDeclaredScenarios, evaluateIdea, validateIdeaFixture } from "../packages/idea-reasoning-runtime/src/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = validateIdeaFixture(JSON.parse(await readFile(path.join(root, "ideas/value-migration-under-cheap-cognition/fixture.json"), "utf8")));

test("idea fixture pins the knowledge authority and covers every proposition", () => {
  assert.match(fixture.authority.commit, /^[a-f0-9]{40}$/u);
  assert.equal(fixture.argument.propositions.length, 19);
  assert.equal(fixture.program.rules.length, 19);
  assert.equal(fixture.thesis.reviewState, "review-required");
});

test("idea runtime blocks value migration when attention scarcity is rejected", () => {
  const run = evaluateIdea(fixture, { rejectedAssumptions: ["a3"] });
  assert.equal(run.queryResults.find((item) => item.propositionId === "c1-company-shaped-work").status, "derived");
  assert.equal(run.queryResults.find((item) => item.propositionId === "c2-value-migrates").status, "blocked");
  assert.match(run.receipt.outputDigest, /^sha256:/u);
  assert.match(run.interpretation, /does not establish empirical truth/u);
});

test("all declared adversarial scenarios produce deterministic passing receipts", () => {
  const first = evaluateDeclaredScenarios(fixture);
  const second = evaluateDeclaredScenarios(fixture);
  assert.equal(first.status, "passed");
  assert.equal(first.results.length, 5);
  assert.equal(first.digest, second.digest);
  assert.equal(first.reviewState, "review-required");
});
