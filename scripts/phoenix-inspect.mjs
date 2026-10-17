#!/usr/bin/env node
// Phoenix P1 flight recorder: reads committed snapshot, prints a truthful report.
// No network calls, source writes, task changes, scheduler dispatches, or score mutations.
import { readFile, appendFile } from "node:fs/promises";
import { assessPhoenix } from "./lib/phoenix-control-plane.mjs";

const readJson = async (file, optional = false) => {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) {
    if (optional && error?.code === "ENOENT") return null;
    throw new Error("phoenix_input_unavailable:" + file + ":" + error.message);
  }
};
const work = "data/runtime/workgraph/";
const roles = ["earth-scout", "council-alpha", "council-beta", "deep-resolver"];
const [system, metrics, integrity, sourceHealth, reconciliation] = await Promise.all([
  readJson("data/runtime/system-state.json"),
  readJson(work + "metrics.json"),
  readJson("data/runtime/intelligence-integrity.json"),
  readJson("data/runtime/source-health.json"),
  readJson("data/operations/hourly-reconciliation/latest.json", true),
]);
const routing = {}, assists = {};
for (const role of roles) {
  routing[role] = await readJson(work + "worker-view/routing/" + role + ".json", true);
  assists[role] = await readJson(work + "worker-view/assist/" + role + ".json", true);
}
const report = assessPhoenix({ system, metrics, integrity, sourceHealth, reconciliation, routing, assists });
console.log(JSON.stringify(report, null, 2));

const p = report.planes;
const lines = [
  "## Phoenix P1 — read-only operating picture",
  "",
  "| Plane | Status | Evidence |",
  "|---|---|---|",
  "| Execution | " + p.execution.status + " | " + p.execution.persisted + "/" + p.execution.slots + " real hourly observations; " + p.execution.missingWithoutRun + " absent scheduler runs |",
  "| Workforce | " + p.workforce.status + " | ChatGPT task enablement cannot be authenticated by GitHub alone |",
  "| Research | " + p.research.status + " | " + p.research.canonical + "/" + p.research.expected + " canonical; " + p.research.chiefReady + " chief_ready |",
  "| Integrity | " + p.truth.status + " | Last persisted source/score integrity verdict |",
  "",
  "### Root-cause fingerprints (not new incidents per run)",
  ...report.incidents.map(x => "- " + x.plane + "/" + x.code + " [" + x.id + "]: " + x.detail),
  "",
  "**Pilot boundary:** no restarts, recovery dispatches, canonical writes or backfilled observations. Repeated fingerprints identify the same failure class; durable incident lifecycle is a later phase.",
  "",
];
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n", "utf8");
}
