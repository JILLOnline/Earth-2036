import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { REQUIRED_SCORE_COMPONENTS } from "../scripts/lib/runtime-gates.mjs";
import {
  buildTrajectoryFeatureRow,
  buildTrajectorySnapshot,
  trajectoryHash,
  validateTrajectorySnapshot,
} from "../scripts/lib/trajectory-engine.mjs";

async function json(relativePath) {
  return JSON.parse(await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8"));
}

function syntheticRecord(overrides = {}) {
  const components = Object.fromEntries(REQUIRED_SCORE_COMPONENTS.map((key, index) => [key, 60 + index]));
  return {
    ticker: "TEST",
    rank: 1,
    rankClass: "championship",
    earthScore: 77.7,
    risk: 31,
    dataConfidence: 88,
    methodologyVersion: "1.0.0",
    scoreBreakdown: {
      methodologyVersion: "1.0.0",
      rawWeightedScore: 82.4,
      confidenceMultiplier: 0.976,
      riskPenalty: 4.7,
    },
    scoreContract: { formulaHash: "formula-test" },
    ...components,
    ...overrides,
  };
}

test("Trajectory contract is exactly the T1000 shadow experiment and has no canonical authority", async () => {
  const contract = await json("config/trajectory-contract-v1.json");
  const methodology = await json("config/methodology-1.0.json");
  assert.equal(methodology.trialTicksRequired, 1000);
  assert.equal(contract.trial.qualifiedTicksRequired, methodology.trialTicksRequired);
  assert.equal(contract.canonicalWriteAuthority, false);
  assert.equal(contract.trial.missingTrajectoryCaptureChangesQualifiedTick, false);
  assert.equal(contract.forecastPolicy.placeholderForecastsAllowed, false);
  assert.deepEqual(contract.horizonsMonths, [12, 24, 36, 60]);
});

test("Trajectory captures the complete Methodology 1.0 numeric state without inventing forecasts", () => {
  const row = buildTrajectoryFeatureRow(syntheticRecord(), { filingFingerprint: "filing-1" });
  assert.equal(row.featureComplete, true);
  assert.equal(Object.keys(row.components).length, REQUIRED_SCORE_COMPONENTS.length);
  assert.equal(row.provenance.filingFingerprint, "filing-1");
  assert.ok(row.provenance.featureHash);
  assert.equal("forecast" in row, false);
  assert.equal("probabilities" in row, false);
});

test("Trajectory feature hashes are deterministic and evidence-state changes are detectable", () => {
  const a = buildTrajectoryFeatureRow(syntheticRecord());
  const b = buildTrajectoryFeatureRow(syntheticRecord());
  const c = buildTrajectoryFeatureRow(syntheticRecord({ pricingPower: 99 }));
  assert.equal(a.provenance.featureHash, b.provenance.featureHash);
  assert.notEqual(a.provenance.featureHash, c.provenance.featureHash);
  assert.equal(trajectoryHash({ b: 2, a: 1 }), trajectoryHash({ a: 1, b: 2 }));
});

test("Trajectory snapshot creates immutable 1/2/3/5-year outcome hooks", () => {
  const snapshot = buildTrajectorySnapshot({
    rankings: [syntheticRecord()],
    observations: { TEST: { filingFingerprint: "filing-1" } },
    asOf: "2026-09-22T18:00:00.000Z",
    generatedAt: "2026-09-22T18:01:00.000Z",
    methodologyVersion: "1.0.0",
    universeVersion: "u1-250",
    trialTickNumber: 1,
  });
  assert.equal(snapshot.canonicalWriteAuthority, false);
  assert.equal(snapshot.records, 1);
  assert.deepEqual(snapshot.horizons.map((row) => row.months), [12, 24, 36, 60]);
  assert.ok(snapshot.horizons.every((row) => Date.parse(row.targetAt) > Date.parse(snapshot.asOf)));
  assert.deepEqual(validateTrajectorySnapshot(snapshot), []);
});

test("Trajectory validator rejects future leakage and incomplete feature rows", () => {
  const snapshot = buildTrajectorySnapshot({
    rankings: [syntheticRecord({ pricingPower: null })],
    asOf: "2026-09-22T18:00:00.000Z",
    methodologyVersion: "1.0.0",
    universeVersion: "u1-250",
  });
  snapshot.sourceCutoff = "2026-09-23T18:00:00.000Z";
  const errors = validateTrajectorySnapshot(snapshot);
  assert.ok(errors.some((value) => value.includes("source cutoff exceeds")));
  assert.ok(errors.some((value) => value.includes("incomplete trajectory features")));
});

test("Current publishable ranking can be represented by the T1000 feature schema", async () => {
  const ranking = await json("data/runtime/current-ranking.json");
  const observations = await json("data/runtime/company-observations.json");
  const snapshot = buildTrajectorySnapshot({
    rankings: ranking.rankings,
    observations: observations.candidates,
    asOf: ranking.capturedAt,
    methodologyVersion: ranking.methodologyVersion,
    universeVersion: "u1-250",
  });
  assert.equal(snapshot.records, ranking.rankings.length);
  assert.equal(snapshot.completeRecords, ranking.rankings.length);
  assert.deepEqual(validateTrajectorySnapshot(snapshot), []);
});


test("Trajectory is wired into T0/T1000 capture but cannot become a qualification gate", async () => {
  const finalizer = await readFile(new URL("../scripts/finalize-qualified-tick.mjs", import.meta.url), "utf8");
  const sync = await readFile(new URL("../scripts/workgraph-sync.mjs", import.meta.url), "utf8");
  assert.ok(finalizer.includes("buildTrajectorySnapshot"));
  assert.ok(finalizer.includes('captureRole: "t0-origin"'));
  assert.ok(finalizer.includes('captureRole: "qualified-trial-tick"'));
  assert.ok(finalizer.includes("trajectoryValidationPassed"));
  assert.equal(finalizer.includes("if (trajectoryErrors"), false);
  assert.equal(finalizer.includes("if (t0TrajectoryErrors"), false);
  assert.ok(sync.includes('"trajectory.json"'));
  assert.ok(sync.includes('mode: "pre-t0-and-live-dry-run"'));
});
