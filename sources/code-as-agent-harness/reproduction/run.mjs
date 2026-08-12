import { runHarness } from "../../../packages/harness-runtime/src/index.mjs";

const result = await runHarness({ task: "Paper-grounded executable, inspectable state demonstration", fixture: { values: [2, 8, 13, 21], minimum: 8, expected: { count: 3, sum: 42 } } });
console.log(JSON.stringify({
  fidelity: {
    supported: ["executable reasoning substrate", "inspectable state", "feedback through verification", "durable intermediate artifacts"],
    inferred: ["specific event envelope", "fixed numeric fixture", "receipt shape"],
    omitted: ["multi-agent coordination benchmark", "paper-wide empirical reproduction"]
  },
  result
}, null, 2));
