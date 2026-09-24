import { readFile } from "node:fs/promises";
import path from "node:path";
import { verifyBridgeIndex } from "./lib/fundamentals-bridge-index.mjs";

const ROOT = process.cwd();
async function readJson(relative) {
  return JSON.parse(await readFile(path.join(ROOT, relative), "utf8"));
}

const [state, index, health, observations, registry, governance] = await Promise.all([
  readJson("data/runtime/system-state.json"),
  readJson("data/runtime/workgraph/shadow/fundamentals-bridge-index.json"),
  readJson("data/runtime/workgraph/shadow/fundamentals-bridge-health.json"),
  readJson("data/runtime/company-observations.json"),
  readJson("data/runtime/entity-registry.json"),
  readJson("config/fundamentals-trajectory-bridge-v1.json"),
]);

const tickers = (registry.candidates || []).map((row) => row?.ticker).filter(Boolean);
const verified = verifyBridgeIndex(index, {
  asOf: state.lastCycleAt,
  observations: observations.candidates || {},
  tickers,
});
const errors = [];
if (tickers.length !== 250 || new Set(tickers).size !== 250) errors.push("registry_not_exactly_250_unique");
if (index.asOf !== state.lastCycleAt) errors.push("index_not_exact_current_machine_cutoff");
if (index.system !== "shadow" || index.canonicalWriteAuthority !== false || index.trialEligible !== false) errors.push("index_authority_violation");
if (Object.keys(index.entries || {}).length !== 250) errors.push("index_population_not_250");
if (Object.keys(verified).length !== 250) errors.push("verified_population_not_250");
if (health.asOf !== state.lastCycleAt) errors.push("health_not_exact_current_machine_cutoff");
if (Number(health.companies) !== 250) errors.push("health_population_not_250");
if (Number(health.valid || 0) + Number(health.unknown || 0) + Number(health.invalid || 0) !== 250) errors.push("health_denominator_mismatch");
if (Number(health.invalid || 0) !== 0) errors.push("invalid_live_bridge_references");
if (Number(health.futureLeakage || 0) !== 0) errors.push("future_leakage_detected");
if (Number(health.cikMismatches || 0) !== 0) errors.push("cik_mismatch_detected");
if (Number(health.hashFailures || 0) !== 0) errors.push("hash_failure_detected");
if (Number(health.projectionAuthority || 0) !== 0) errors.push("projection_authority_violation");
if (Number(health.canonicalWrites || 0) !== 0 || health.canonicalWriteAuthority !== false) errors.push("canonical_authority_violation");
if (health.durableArchive !== true || !health.archiveTag || !health.archiveAsset || !/^[a-f0-9]{64}$/.test(String(health.archiveSha256 || ""))) errors.push("durable_archive_attestation_missing");
if (governance.canonicalWriteAuthority !== false || governance.mayChangeEarthScore !== false ||
    governance.mayChangeCanonicalRank !== false || governance.mayChangeWorkgraphState !== false ||
    governance.mayAffectTickQualification !== false || governance.mayGenerateForecasts !== false ||
    governance.mayTrainModels !== false) errors.push("governance_firewall_violation");

console.log(JSON.stringify({
  contract: "earth2036-live-fundamentals-bridge-publication-check-v1",
  passed: errors.length === 0,
  asOf: state.lastCycleAt,
  companies: health.companies,
  valid: health.valid,
  unknown: health.unknown,
  invalid: health.invalid,
  rawFactsReferenced: health.rawFactsReferenced,
  archiveTag: health.archiveTag || null,
  archiveSha256: health.archiveSha256 || null,
  errors,
}, null, 2));
if (errors.length) process.exitCode = 1;
