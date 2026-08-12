const output = document.querySelector("#output");
const events = document.querySelector("#events");
const status = document.querySelector("#status");
async function run(mode) {
  status.textContent = "Running real harness…";
  const response = await fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
  const result = await response.json();
  output.textContent = JSON.stringify({ status: result.status, state: result.state, receipt: result.receipt }, null, 2);
  events.textContent = result.events.map((event) => `${event.sequence}. ${event.type}\n${JSON.stringify(event.payload, null, 2)}\nstate ${event.stateDigest}`).join("\n\n");
  status.textContent = result.status === "verified" ? "Verified" : "Checkpoint retained";
  status.dataset.status = result.status;
}
document.querySelector("#run")?.addEventListener("click", () => run("verified"));
document.querySelector("#fail")?.addEventListener("click", () => run("recoverable"));
run("verified");
