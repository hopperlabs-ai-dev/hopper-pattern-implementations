import { exampleRegistry } from "../../../packages/orchestration-runtime/src/index.mjs";
const allowed = ["numbers.filter", "numbers.summarize"];
const plan = { steps: [{ id: "filtered", operation: "numbers.filter", input: { values: [2, 8, 13, 21], minimum: 8 } }, { id: "summary", operation: "numbers.summarize", input: { values: "$steps.filtered.values" } }], output: { selected: "$steps.filtered.values", summary: "$steps.summary" } };
console.log(JSON.stringify({ discovered: exampleRegistry.discover("filter summarize numbers", allowed), result: await exampleRegistry.executePlan(plan, allowed) }, null, 2));
