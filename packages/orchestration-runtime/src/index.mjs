import { digest } from "../../contracts/src/index.mjs";

function resolve(value, results) {
  if (Array.isArray(value)) return value.map((item) => resolve(item, results));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item, results)]));
  if (typeof value !== "string" || !value.startsWith("$steps.")) return value;
  const [step, ...segments] = value.slice(7).split("."); let result = results[step];
  for (const segment of segments) result = result?.[segment];
  if (result === undefined) throw new Error(`Unknown plan reference ${value}`);
  return result;
}

export class OperationRegistry {
  constructor(operations) { this.operations = new Map(operations.map((operation) => [operation.name, Object.freeze(operation)])); }
  discover(query, allowed, limit = 8) {
    const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
    return [...this.operations.values()].filter((operation) => allowed.includes(operation.name)).map((operation) => ({ name: operation.name, description: operation.description, inputSchema: operation.inputSchema, score: terms.reduce((score, term) => score + (`${operation.name} ${operation.description}`.toLowerCase().includes(term) ? 1 : 0), 0) / Math.max(terms.length, 1) })).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name)).slice(0, Math.min(limit, 20));
  }
  async executePlan(plan, allowed) {
    if (!Array.isArray(plan.steps) || plan.steps.length === 0 || plan.steps.length > 8) throw new Error("Plan requires 1–8 steps");
    const results = {}; const receipts = [];
    for (const step of plan.steps) {
      if (!allowed.includes(step.operation)) throw new Error(`Operation not authorized: ${step.operation}`);
      const operation = this.operations.get(step.operation); if (!operation) throw new Error(`Unknown operation: ${step.operation}`);
      const input = resolve(step.input, results); const result = await operation.execute(structuredClone(input));
      results[step.id] = result; receipts.push({ stepId: step.id, operation: step.operation, inputDigest: digest(input), resultDigest: digest(result) });
    }
    const output = resolve(plan.output || results, results); return { output, receipts, planDigest: digest(plan), outputDigest: digest(output) };
  }
}

export const exampleRegistry = new OperationRegistry([
  { name: "numbers.filter", description: "Filter bounded numbers at or above a minimum.", inputSchema: { type: "object", required: ["values", "minimum"] }, execute: async ({ values, minimum }) => ({ values: values.filter((value) => value >= minimum) }) },
  { name: "numbers.summarize", description: "Summarize a bounded number list.", inputSchema: { type: "object", required: ["values"] }, execute: async ({ values }) => ({ count: values.length, sum: values.reduce((total, value) => total + value, 0) }) }
]);
