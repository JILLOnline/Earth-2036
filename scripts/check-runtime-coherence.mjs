import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

async function readJson(relative) {
  return JSON.parse(await readFile(path.join(ROOT, relative), "utf8"));
}

const [graph, system, trajectory, bridgeHealth] = await Promise.all([
  readJson("data/runtime/workgraph/state.json"),
  readJson("data/runtime/system-state.json"),
  readJson("data/runtime/workgraph/shadow/trajectory.json"),
  readJson("data/runtime/workgraph/shadow/fundamentals-bridge-health.json"),
]);

const rows = Object.values(graph?.companies || {});
const canonical = rows.filter((row) => row?.state === "canonical").length;
const trajectoryRows = Array.isArray(trajectory?.rows) ? trajectory.rows : [];
const errors = [];

if (Number(system?.workgraphCanonicalCompanies) !== canonical) {
  errors.push(`system_workgraph_canonical_mismatch:${system?.workgraphCanonicalCompanies}/${canonical}`);
}
if (trajectoryRows.length !== canonical) {
  errors.push(`trajectory_canonical_mismatch:${trajectoryRows.length}/${canonical}`);
}
if (trajectory?.validation?.passed !== true || (trajectory?.validation?.errors || []).length !== 0) {
  errors.push("trajectory_validation_failed");
}
if (Number(trajectory?.truthCompleteRecords || 0) + Number(trajectory?.truthIncompleteRecords || 0) !== trajectoryRows.length) {
  errors.push("trajectory_truth_record_count_mismatch");
}
if (trajectory?.canonicalWriteAuthority !== false) {
  errors.push("trajectory_canonical_authority_invalid");
}
if (trajectory?.learningPolicy?.modelsEnabled !== false || trajectory?.learningPolicy?.forecastsEnabled !== false) {
  errors.push("trajectory_models_or_forecasts_enabled");
}
if (trajectory?.learningPolicy?.earthContextLearningEligible !== false) {
  errors.push("trajectory_earth_context_learning_enabled");
}

if (bridgeHealth?.status === "live-bootstrap-verified") {
  if (bridgeHealth?.canonicalWriteAuthority !== false || Number(bridgeHealth?.canonicalWrites || 0) !== 0) {
    errors.push("fundamentals_bridge_canonical_authority_leak");
  }
  if (Number(bridgeHealth?.invalid || 0) !== 0 ||
      Number(bridgeHealth?.cikMismatches || 0) !== 0 ||
      Number(bridgeHealth?.hashFailures || 0) !== 0 ||
      Number(bridgeHealth?.futureLeakage || 0) !== 0 ||
      Number(bridgeHealth?.projectionAuthority || 0) !== 0) {
    errors.push("fundamentals_bridge_health_invalid");
  }
  if (trajectory?.asOf !== bridgeHealth?.asOf) {
    errors.push(`trajectory_bridge_cutoff_mismatch:${trajectory?.asOf}/${bridgeHealth?.asOf}`);
  }
  const invalidFundamentals = trajectoryRows.filter((row) => row?.truthState?.fundamentals?.status === "invalid");
  if (invalidFundamentals.length) errors.push(`trajectory_invalid_fundamentals:${invalidFundamentals.length}`);
}

const report = {
  contract: "earth2036-runtime-coherence-smoke-v1",
  passed: errors.length === 0,
  canonical,
  systemCanonical: Number(system?.workgraphCanonicalCompanies),
  trajectoryRows: trajectoryRows.length,
  trajectoryAsOf: trajectory?.asOf || null,
  bridgeStatus: bridgeHealth?.status || null,
  bridgeAsOf: bridgeHealth?.asOf || null,
  modelsEnabled: trajectory?.learningPolicy?.modelsEnabled ?? null,
  forecastsEnabled: trajectory?.learningPolicy?.forecastsEnabled ?? null,
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
