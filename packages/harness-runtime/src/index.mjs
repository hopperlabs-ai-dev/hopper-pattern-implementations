import { digest } from "../../contracts/src/index.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));

export async function runHarness({ task, fixture, failStep = null }) {
  const state = { task, phase: "planned", values: clone(fixture.values), selected: [], summary: null };
  const events = [];
  const record = (type, payload) => events.push({ sequence: events.length + 1, type, payload, stateDigest: digest(state) });
  record("plan.created", { steps: ["filter", "summarize", "verify"] });
  state.phase = "executing";
  state.selected = state.values.filter((value) => value >= fixture.minimum);
  record("step.completed", { step: "filter", selected: state.selected });
  if (failStep === "summarize") {
    record("checkpoint.saved", { recoveryAt: "summarize" });
    return { status: "recoverable", state, events, receipt: receipt(state, events) };
  }
  state.summary = { count: state.selected.length, sum: state.selected.reduce((total, value) => total + value, 0) };
  record("step.completed", { step: "summarize", summary: state.summary });
  const expected = fixture.expected;
  const verified = state.summary.count === expected.count && state.summary.sum === expected.sum;
  state.phase = verified ? "verified" : "failed";
  record("verification.completed", { verified, expected, actual: state.summary });
  return { status: verified ? "verified" : "failed", state, events, receipt: receipt(state, events) };
}

function receipt(state, events) {
  const body = { stateDigest: digest(state), eventDigest: digest(events), eventCount: events.length };
  return { ...body, digest: digest(body) };
}
