import test from "node:test";
import assert from "node:assert/strict";
import { runHarness } from "../packages/harness-runtime/src/index.mjs";

const fixture = { values: [2, 8, 13, 21], minimum: 8, expected: { count: 3, sum: 42 } };
test("harness produces verified state and an independently digestible receipt", async () => { const result = await runHarness({ task: "test", fixture }); assert.equal(result.status, "verified"); assert.equal(result.events.at(-1).payload.verified, true); assert.match(result.receipt.digest, /^sha256:/); });
test("harness exposes a recoverable checkpoint without claiming success", async () => { const result = await runHarness({ task: "test", fixture, failStep: "summarize" }); assert.equal(result.status, "recoverable"); assert.equal(result.state.phase, "executing"); assert.equal(result.events.at(-1).type, "checkpoint.saved"); });
