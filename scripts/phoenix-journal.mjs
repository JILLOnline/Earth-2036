#!/usr/bin/env node
// Phase 2: run AFTER original immutable as-of audit and retrospective source reconciliation.
// Adds only operational incident files. Caller commits in the same audited Git transaction.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assessPhoenix } from "./lib/phoenix-control-plane.mjs";
import { advanceIncidentMemory, appendOnlyEventLines } from "./lib/phoenix-incident-journal.mjs";

const root = "data/operations/phoenix";
const read = async (name, optional = false) => {
  try { return JSON.parse(await readFile(name, "utf8")); }
  catch (e) {
    if (optional && e.code === "ENOENT") return null;
    throw new Error("phoenix_journal_read_failed:" + name + ":" + e.message);
  }
};
const readText = async (name) => {
  try { return await readFile(name, "utf8"); }
  catch(e) { if (e.code === "ENOENT") return ""; throw e; }
};
const metrics = await read("data/runtime/workgraph/metrics.json");
const integrity = await read("data/runtime/intelligence-integrity.json");
const reconciliation = await read("data/operations/hourly-reconciliation/latest.json");
const system = await read("data/runtime/system-state.json");
const sourceHealth = await read("data/runtime/source-health.json");
const routing = {}, assists = {};
for (const role of ["earth-scout", "council-alpha", "council-beta", "deep-resolver"]) {
  routing[role] = await read("data/runtime/workgraph/worker-view/routing/" + role + ".json");
  assists[role] = await read("data/runtime/workgraph/worker-view/assist/" + role + ".json");
}
const report = assessPhoenix({ metrics, integrity, reconciliation, system, sourceHealth, routing, assists,
  // The audit receipt's verified as-of timestamp serves as the same-input identity on replays.
  now: reconciliation.checkedAt,
});
const prior = await read(root + "/current.json", true);
const existing = await readText(root + "/events.jsonl");
const next = advanceIncidentMemory(prior, report, { metrics, integrity, reconciliation });
const appended = appendOnlyEventLines(existing, next.appendEvents);
await mkdir(path.resolve(root), { recursive: true });
if (appended.appended) await writeFile(root + "/events.jsonl", appended.content, "utf8");
// Never bump a timestamp or create a new Git diff on a byte-identical replay.
const projection = JSON.stringify(next.projection, null, 2) + "\n";
const oldProjection = prior ? JSON.stringify(prior, null, 2) + "\n" : null;
if (projection !== oldProjection) await writeFile(root + "/current.json", projection, "utf8");
console.log(JSON.stringify({ status:"operational_only", persistentIncidents:next.projection.incidents.length,
  open: next.projection.openCount, resolved:next.projection.resolvedCount,
  appendedEvents:appended.appended, noCanonicalWrites:true }));
