const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
let fixture;
let lastRun;
const byId = (id) => document.querySelector(id);

function controls(records, attribute) {
  return records.map((record) => `<label><input type="checkbox" ${attribute}="${esc(record.id)}"><span><b>${esc(record.id.toUpperCase())}</b>${esc(record.statement)}</span></label>`).join("");
}
function renderFlow(run) {
  const derived = new Set(run.derivedPropositions);
  const propositionById = new Map(fixture.argument.propositions.map((item) => [item.id, item]));
  const layers = [];
  const depth = new Map();
  function level(id) { if (depth.has(id)) return depth.get(id); const item = propositionById.get(id); const value = item.dependsOn.length ? 1 + Math.max(...item.dependsOn.map(level)) : 0; depth.set(id, value); return value; }
  for (const item of fixture.argument.propositions) { const index = level(item.id); if (!layers[index]) layers[index] = []; layers[index].push(item); }
  byId("#flow").innerHTML = layers.map((items, index) => `<section><small>${index === 0 ? "Premises" : `Inference layer ${index}`}</small><div>${items.map((item) => `<article class="node node--${esc(item.kind)} ${derived.has(item.id) ? "is-derived" : "is-blocked"}"><header><b>${esc(item.code)}</b><span>${derived.has(item.id) ? "derived" : "blocked"}</span></header><h3>${esc(item.title)}</h3><p>${esc(item.statement)}</p>${item.dependsOn.length ? `<small>Depends on ${esc(item.dependsOn.map((id) => propositionById.get(id).code).join(", "))}</small>` : ""}</article>`).join("")}</div></section>${index < layers.length - 1 ? '<i aria-hidden="true">↓</i>' : ""}`).join("");
}
function renderRun(run) {
  lastRun = run;
  byId("#queries").innerHTML = run.queryResults.map((query) => `<article class="query query--${esc(query.status)}"><span>${query.status === "derived" ? "✓" : "×"}</span><div><b>${esc(query.label)}</b><small>${esc(query.status)}</small></div></article>`).join("");
  renderFlow(run);
  byId("#trace").textContent = `${run.datalog}\n\nTRACE\n${run.trace.map((step) => `${step.step}. ${step.rule}`).join("\n")}\n\n${run.interpretation}`;
  byId("#receipt").textContent = `Receipt ${run.receipt.outputDigest}`;
}
async function run() {
  byId("#run").disabled = true;
  try {
    const scenario = {
      rejectedAssumptions: [...document.querySelectorAll("[data-assumption]:checked")].map((item) => item.dataset.assumption),
      triggeredFalsifiers: [...document.querySelectorAll("[data-falsifier]:checked")].map((item) => item.dataset.falsifier)
    };
    const response = await fetch("/api/ideas/value-migration/evaluate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(scenario) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || result.error);
    renderRun(result);
  } finally { byId("#run").disabled = false; }
}
function selectTab(name) {
  document.querySelectorAll("[data-tab]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.tab === name)));
  document.querySelectorAll(".tab-panel").forEach((panel) => { panel.hidden = panel.id !== name; });
}

fixture = await (await fetch("/api/ideas/value-migration/fixture")).json();
byId("#summary").textContent = fixture.thesis.summary;
byId("#assumptions").innerHTML = controls(fixture.argument.assumptions, "data-assumption");
byId("#falsifiers").innerHTML = controls(fixture.argument.falsifiers, "data-falsifier");
byId("#attacks").innerHTML = fixture.attacks.map((attack) => `<article><span>${esc(attack.severity)}</span><b>${esc(attack.id.replaceAll("-", " "))}</b><p>${esc(attack.challenge)}</p><small>Targets ${esc(attack.targets.join(", "))}</small></article>`).join("");
byId("#authority").href = `${fixture.authority.repository}/tree/${fixture.authority.commit}`;
byId("#run").addEventListener("click", run);
byId("#reset").addEventListener("click", () => { document.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = false; }); run(); });
document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.tab)));
await run();
