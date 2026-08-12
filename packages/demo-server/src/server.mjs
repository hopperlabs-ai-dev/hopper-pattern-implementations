import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHarness } from "../../harness-runtime/src/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const port = Number(process.env.HOPPER_PATTERN_DEMO_PORT || 47620);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid demo port");
const assets = new Map([
  ["/", ["packages/demo-server/src/index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["packages/demo-server/src/app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["packages/demo-server/src/styles.css", "text/css; charset=utf-8"]],
  ["/subjects/source/code-as-agent-harness", ["sources/code-as-agent-harness/demo/index.html", "text/html; charset=utf-8"]],
  ["/subjects/pattern/executable-stateful-harness", ["patterns/executable-stateful-harness/demo/index.html", "text/html; charset=utf-8"]],
  ["/diagrams/source/poc.svg", ["sources/code-as-agent-harness/diagrams/poc.svg", "image/svg+xml"]],
  ["/diagrams/source/production.svg", ["sources/code-as-agent-harness/diagrams/production.svg", "image/svg+xml"]],
  ["/diagrams/pattern/poc.svg", ["patterns/executable-stateful-harness/diagrams/poc.svg", "image/svg+xml"]],
  ["/diagrams/pattern/production.svg", ["patterns/executable-stateful-harness/diagrams/production.svg", "image/svg+xml"]]
]);

function headers(type) {
  return {
    "content-type": type,
    "cache-control": type.startsWith("application/json") ? "no-store" : "public, max-age=60",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'self' http://127.0.0.1:*",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  };
}
function send(response, status, body, type = "application/json; charset=utf-8") { response.writeHead(status, headers(type)); response.end(body); }

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    if (request.method === "GET" && url.pathname === "/api/health") return send(response, 200, JSON.stringify({ ok: true, productId: "hopper.pattern-implementations", networkMode: "loopback-only" }));
    if (request.method === "POST" && url.pathname === "/api/run") {
      const chunks = []; let bytes = 0;
      for await (const chunk of request) { bytes += chunk.length; if (bytes > 4096) return send(response, 413, JSON.stringify({ error: "input-too-large" })); chunks.push(chunk); }
      const input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      const failStep = input.mode === "recoverable" ? "summarize" : null;
      const result = await runHarness({ task: "Filter and summarize admitted values", fixture: { values: [2, 8, 13, 21], minimum: 8, expected: { count: 3, sum: 42 } }, failStep });
      return send(response, 200, JSON.stringify(result));
    }
    if (request.method !== "GET") return send(response, 405, JSON.stringify({ error: "method-not-allowed" }));
    const asset = assets.get(url.pathname);
    if (!asset) return send(response, 404, JSON.stringify({ error: "not-found" }));
    return send(response, 200, await readFile(path.join(root, asset[0])), asset[1]);
  } catch (error) { return send(response, 500, JSON.stringify({ error: "internal-error", message: error.message })); }
});
server.listen(port, "127.0.0.1", () => console.log(`Pattern implementation demos http://127.0.0.1:${port}`));
