import http from "node:http";
import { runHarness } from "../../../packages/harness-runtime/src/index.mjs";

const port = Number(process.env.HOPPER_HARNESS_PORT || 47621);
const server = http.createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/run") { response.writeHead(404).end(); return; }
  const chunks = []; let bytes = 0;
  for await (const chunk of request) { bytes += chunk.length; if (bytes > 16_384) { response.writeHead(413).end(); return; } chunks.push(chunk); }
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const result = await runHarness({ task: String(input.task || "bounded task").slice(0, 300), fixture: { values: [2, 8, 13, 21], minimum: 8, expected: { count: 3, sum: 42 } }, failStep: input.failStep || null });
  response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(result));
});
server.listen(port, "127.0.0.1", () => console.log(`Harness reference http://127.0.0.1:${port}`));
