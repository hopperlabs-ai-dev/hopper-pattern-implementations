import { runHarness } from "../../../packages/harness-runtime/src/index.mjs";

const result = await runHarness({ task: "Filter and summarize admitted values", fixture: { values: [2, 8, 13, 21], minimum: 8, expected: { count: 3, sum: 42 } } });
console.log(JSON.stringify(result, null, 2));
