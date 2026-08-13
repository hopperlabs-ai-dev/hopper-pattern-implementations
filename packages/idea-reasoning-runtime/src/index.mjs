import { digest } from "../../contracts/src/index.mjs";

export function validateIdeaFixture(fixture) {
  if (fixture.schemaVersion !== "hopper.idea-demo-fixture.v1") throw new Error("Unsupported idea fixture");
  if (!/^[a-f0-9]{40}$/u.test(fixture.authority.commit)) throw new Error("Idea authority must be pinned to an immutable commit");
  const propositionIds = new Set(fixture.argument.propositions.map((item) => item.id));
  const assumptionIds = new Set(fixture.argument.assumptions.map((item) => item.id));
  const falsifierIds = new Set(fixture.argument.falsifiers.map((item) => item.id));
  if (propositionIds.size !== fixture.argument.propositions.length) throw new Error("Duplicate proposition");
  if (fixture.program.rules.length !== propositionIds.size) throw new Error("Every proposition requires one rule");
  if (new Set(fixture.program.rules.map((item) => item.conclusion)).size !== propositionIds.size) throw new Error("Every rule requires a unique conclusion");
  for (const rule of fixture.program.rules) {
    if (!propositionIds.has(rule.conclusion)) throw new Error(`Unknown rule conclusion ${rule.conclusion}`);
    for (const id of rule.antecedents) if (!propositionIds.has(id)) throw new Error(`Unknown rule antecedent ${id}`);
    for (const id of rule.requiredAssumptions) if (!assumptionIds.has(id)) throw new Error(`Unknown rule assumption ${id}`);
  }
  for (const falsifier of fixture.argument.falsifiers) for (const id of falsifier.challenges) if (!propositionIds.has(id)) throw new Error(`Unknown falsifier target ${id}`);
  for (const scenario of fixture.scenarios) {
    for (const id of scenario.input.rejectedAssumptions || []) if (!assumptionIds.has(id)) throw new Error(`Unknown scenario assumption ${id}`);
    for (const id of scenario.input.triggeredFalsifiers || []) if (!falsifierIds.has(id)) throw new Error(`Unknown scenario falsifier ${id}`);
  }
  return fixture;
}

function datalogRule(rule) {
  const body = [...rule.antecedents.map((id) => `holds(${id})`), ...rule.requiredAssumptions.map((id) => `assumed(${id})`), `not challenged(${rule.conclusion})`];
  return `holds(${rule.conclusion}) :- ${body.join(", ")}.`;
}

export function evaluateIdea(fixture, scenario = {}) {
  validateIdeaFixture(fixture);
  const rejected = new Set(scenario.rejectedAssumptions || []);
  const triggered = new Set(scenario.triggeredFalsifiers || []);
  const challenged = new Set(scenario.challengedPropositions || []);
  for (const id of triggered) {
    const falsifier = fixture.argument.falsifiers.find((item) => item.id === id);
    if (!falsifier) throw new Error(`Unknown falsifier ${id}`);
    falsifier.challenges.forEach((target) => challenged.add(target));
  }
  const derived = new Set();
  const trace = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of fixture.program.rules) {
      if (derived.has(rule.conclusion) || challenged.has(rule.conclusion)) continue;
      if (rule.requiredAssumptions.some((id) => rejected.has(id)) || rule.antecedents.some((id) => !derived.has(id))) continue;
      derived.add(rule.conclusion);
      trace.push({ step: trace.length + 1, conclusion: rule.conclusion, antecedents: rule.antecedents, assumptions: rule.requiredAssumptions, rule: datalogRule(rule) });
      changed = true;
    }
  }
  const queryResults = fixture.program.queries.map((query) => ({ ...query, status: derived.has(query.propositionId) ? "derived" : "blocked" }));
  const normalizedScenario = {
    rejectedAssumptions: [...rejected].sort(),
    triggeredFalsifiers: [...triggered].sort(),
    challengedPropositions: [...challenged].sort()
  };
  const body = {
    schemaVersion: "hopper.idea-demo-run.v1",
    thesisId: fixture.thesis.id,
    authority: fixture.authority,
    scenario: normalizedScenario,
    derivedPropositions: [...derived],
    queryResults,
    trace,
    datalog: fixture.program.rules.map(datalogRule).join("\n"),
    interpretation: "This run tests whether the declared inference path remains intact. It does not establish empirical truth.",
    reviewState: "review-required"
  };
  return { ...body, receipt: { fixtureDigest: digest(fixture), inputDigest: digest(normalizedScenario), outputDigest: digest(body) } };
}

export function evaluateDeclaredScenarios(fixture) {
  const results = fixture.scenarios.map((scenario) => {
    const run = evaluateIdea(fixture, scenario.input);
    const observed = Object.fromEntries(run.queryResults.map((item) => [item.propositionId, item.status]));
    return { scenarioId: scenario.id, title: scenario.title, expected: scenario.expectedQueries, observed, passed: Object.entries(scenario.expectedQueries).every(([id, status]) => observed[id] === status), receipt: run.receipt };
  });
  const body = {
    schemaVersion: "hopper.idea-demo-evaluation.v1",
    evaluationId: "evaluation:value-migration-argument-contract",
    status: results.every((item) => item.passed) ? "passed" : "failed",
    authority: fixture.authority,
    results,
    limitations: [
      "The evaluation tests declared inference behavior, not whether the economic thesis is true.",
      "The fixture is a pinned snapshot; the Key Pattern Library remains the knowledge authority.",
      "Scientific checks require external datasets and human review."
    ],
    reviewState: "review-required"
  };
  return { ...body, digest: digest(body) };
}
