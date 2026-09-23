import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = new URL("../", import.meta.url);

export function validatePinnedBridgeHistory(report, baseline) {
  const errors = [];
  if (baseline?.contract !== "earth2036-fundamentals-bridge-historical-baseline-v1" ||
      baseline?.historicalOnly !== true || baseline?.trialEligible !== false) {
    return ["invalid_historical_baseline_contract"];
  }
  if (report?.contract !== "earth2036-fundamentals-trajectory-bridge-v1" ||
      report?.historical !== true || report?.trialEligible !== false) {
    errors.push("historical_canary_claimed_trial_or_wrong_contract");
  }
  if (report?.invalid !== 0 || report?.unknown !== 0) errors.push("historical_samples_invalid_or_unknown");
  const expected = baseline.samples ?? [];
  const actual = report?.canaries ?? [];
  const indexed = new Map();
  for (const sample of actual) {
    const key = sample.ticker + "@" + sample.asOf;
    if (indexed.has(key)) errors.push("duplicate_historical_sample:" + key);
    indexed.set(key, sample);
  }
  if (indexed.size !== expected.length) errors.push("historical_sample_count_mismatch");
  for (const original of expected) {
    const key = original.ticker + "@" + original.asOf;
    const latest = indexed.get(key);
    if (!latest || latest.status !== "valid" || latest.reconstructed !== true) {
      errors.push("historical_truth_unrecoverable:" + key);
      continue;
    }
    // Only raw PIT truth is pinned: metric-map convenience projections are not ground truth.
    if (latest.truthHash !== original.truthHash) errors.push("historical_raw_truth_drift:" + key);
    if (latest.rawFactCount !== original.rawFactCount) errors.push("historical_raw_fact_count_drift:" + key);
  }
  const periods = [...new Set(expected.map((v) => v.asOf))].sort();
  const found = new Map((report?.indexes ?? []).map((r) => [r.asOf, r]));
  if (found.size !== periods.length) errors.push("historical_period_count_mismatch");
  for (const period of periods) {
    const index = found.get(period);
    if (!index || index.valid !== expected.filter((v) => v.asOf === period).length ||
        index.invalid !== 0 || index.unknown !== 0 || index.canonicalWrites !== 0 ||
        index.projectionAuthority !== 0) errors.push("historical_index_qualification_failure:" + period);
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const reportFile = process.argv[2] ?? "bridge-historical.json";
  const baseline = JSON.parse(await readFile(new URL("config/fundamentals-bridge-historical-baseline-v1.json", ROOT), "utf8"));
  const report = JSON.parse(await readFile(reportFile, "utf8"));
  const errors = validatePinnedBridgeHistory(report, baseline);
  console.log(JSON.stringify({ contract:"earth2036-fundamentals-bridge-pinned-history-audit-v1",
    status: errors.length ? "historical_truth_unrecoverable" : "verified",
    expectedSamples: baseline.samples.length, receivedSamples: report?.canaries?.length ?? 0,
    baselineObservedAt: baseline.observedAt, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}
