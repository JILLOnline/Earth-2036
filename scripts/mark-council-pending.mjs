import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const RUNTIME = path.join(ROOT, "data", "runtime");
const MANIFEST = path.join(ROOT, "data", "baselines", "earth2036-official-t0-2026-09-12", "manifest.json");

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const [state, health, manifest, workgraph] = await Promise.all([
  readJson(path.join(RUNTIME, "system-state.json"), null),
  readJson(path.join(RUNTIME, "source-health.json"), null),
  readJson(MANIFEST, null),
  readJson(path.join(RUNTIME, "workgraph", "state.json"), null),
]);

if (!state?.cycleKey || workgraph?.version !== 2) {
  console.log(JSON.stringify({ workgraphSupervision: "NOOP", reason: "missing_state_or_workgraph_v2" }));
  process.exit(0);
}

const rows = Object.values(workgraph.companies || {});
const expected = Number(state.companiesExpected || rows.length || 250);
const sourceFailures = new Set([
  "missing_specialist_perspective:source-integrity",
  "missing_specialist_perspective:company-underwriting",
  "missing_primary_source",
  "missing_data_confidence_evidence",
  "missing_source_lineage",
]);
const discoveryFailure = "missing_specialist_perspective:discovery-weak-signals";

function failures(row) {
  return Array.isArray(row?.preflight?.failures) ? row.preflight.failures : [];
}

function hasCompiledEvidence(row) {
  return ["packet_ready", "chief_ready", "canonical"].includes(row?.state) || row?.preflight != null;
}

const sourceCovered = rows.filter((row) => {
  if (!hasCompiledEvidence(row)) return false;
  return !failures(row).some((failure) => sourceFailures.has(failure));
}).length;

const discoveryCovered = rows.filter((row) => {
  if (!hasCompiledEvidence(row)) return false;
  return !failures(row).includes(discoveryFailure);
}).length;

const canonical = rows.filter((row) => row?.state === "canonical").length;
const blocked = rows.filter((row) => row?.state === "blocked").length;
const supervisorCoverage = expected > 0 ? sourceCovered / expected : 0;
const machineCoverage = Number(state.machineSourceCoverageRatio ?? health?.machineCoverageRatio ?? 0);
const combinedCoverage = Math.min(machineCoverage, supervisorCoverage);
const discoveryScanCompleted = Boolean(
  state.machineDiscoveryComplete === true &&
  expected > 0 &&
  discoveryCovered === expected
);
const workgraphApproved = expected > 0 && canonical === expected && blocked === 0;

const nextState = {
  ...state,
  supervisorSourceCoverageRatio: Math.round(supervisorCoverage * 10000) / 10000,
  combinedSourceCoverageRatio: Math.round(combinedCoverage * 10000) / 10000,
  discoveryScanCompleted,
  qualifiedTick: false,
  councilReviewStatus: workgraphApproved ? "approved_workgraph_v2" : "pending_workgraph_v2",
  reviewedSupervisorCycleKey: null,
  workgraphGeneratedAt: workgraph.generatedAt ?? null,
  workgraphCanonicalCompanies: canonical,
  workgraphBlockedCompanies: blocked,
};
await writeJson(path.join(RUNTIME, "system-state.json"), nextState);

if (health) {
  await writeJson(path.join(RUNTIME, "source-health.json"), {
    ...health,
    supervisorCoverageRatio: Math.round(supervisorCoverage * 10000) / 10000,
    combinedCoverageRatio: Math.round(combinedCoverage * 10000) / 10000,
    supervisorDiscoveryComplete: discoveryScanCompleted,
    supervisorCycleKey: null,
    supervisorSameCycle: null,
    workgraphGeneratedAt: workgraph.generatedAt ?? null,
    note: "Workgraph v2 cumulative evidence is authoritative; supervisor evidence is not invalidated by hourly machine cycle boundaries.",
  });
}

if (manifest && !manifest.published) {
  const checks = {
    ...(manifest.runtimeGate?.checks ?? {}),
    sourceCoverage: combinedCoverage >= 0.95,
    discovery: discoveryScanCompleted,
    council: workgraphApproved,
  };
  await writeJson(MANIFEST, {
    ...manifest,
    sourceCoverageRatio: Math.round(combinedCoverage * 10000) / 10000,
    discoveryScanCompleted,
    trialEligible: false,
    runtimeGate: { checks, passed: false },
  });
}

console.log(JSON.stringify({
  workgraphSupervision: "SYNCED",
  cycleKey: state.cycleKey,
  workgraphGeneratedAt: workgraph.generatedAt ?? null,
  sourceCovered,
  discoveryCovered,
  canonical,
  blocked,
  expected,
  supervisorCoverageRatio: Math.round(supervisorCoverage * 10000) / 10000,
  combinedCoverageRatio: Math.round(combinedCoverage * 10000) / 10000,
  discoveryScanCompleted,
  workgraphApproved,
}, null, 2));
