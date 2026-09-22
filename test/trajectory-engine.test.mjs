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
    factorEvidence: {
      thesisQuality: { value: 75, sourceIds: ["issuer:test:q1"], note: "test" }
    },
    primarySourceUrls: ["https://example.com/primary"],
    independentSourceUrls: ["https://example.com/independent"],
    ...components,
    ...overrides,
  };
}

function syntheticObservation(overrides = {}) {
  return {
    ticker: "TEST",
    observedAt: "2026-09-22T18:00:00.000Z",
    cik: "0000000001",
    secName: "Test Corp",
    sic: "3674",
    fiscalYearEnd: "1231",
    filingFingerprint: "filing-1",
    filings: [
      {
        accessionNumber: "0000000001-26-000001",
        filingDate: "2026-09-20",
        reportDate: "2026-09-19",
        form: "8-K",
        primaryDocument: "test.htm",
      }
    ],
    sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
    ...overrides,
  };
}

test("Trajectory contract makes observed truth—not human success labels—the learning authority", async () => {
  const contract = await json("config/trajectory-contract-v1.json");
  const methodology = await json("config/methodology-1.0.json");
  assert.equal(methodology.trialTicksRequired, 1000);
  assert.equal(contract.trial.qualifiedTicksRequired, methodology.trialTicksRequired);
  assert.equal(contract.canonicalWriteAuthority, false);
  assert.equal(contract.learningPolicy.primaryTrainingInput, "truthState");
  assert.equal(contract.learningPolicy.primaryTrainingTargets, "observedOutcomeChannels");
  assert.equal(contract.learningPolicy.subjectiveSuccessLabelsAllowed, false);
  assert.ok(contract.learningPolicy.forbiddenAsGroundTruth.includes("earthScore"));
  assert.ok(contract.learningPolicy.forbiddenAsGroundTruth.includes("methodologyComponentScores"));
  assert.ok(contract.learningPolicy.forbiddenAsGroundTruth.includes("assistant-generated success/failure labels"));
  assert.equal(contract.forecastPolicy.placeholderForecastsAllowed, false);
  assert.deepEqual(contract.horizonsMonths, [12, 24, 36, 60]);
  assert.equal("targets" in contract, false);
});

test("Earth scores and factor judgments cannot change the learner truth-state hash", () => {
  const observation = syntheticObservation();
  const a = buildTrajectoryFeatureRow(syntheticRecord(), observation);
  const b = buildTrajectoryFeatureRow(syntheticRecord({
    earthScore: 12.3,
    rank: 92,
    pricingPower: 5,
    thesisQuality: 15,
  }), observation);

  assert.equal(a.truthComplete, true);
  assert.equal(a.provenance.truthStateHash, b.provenance.truthStateHash);
  assert.notEqual(a.provenance.earthContextHash, b.provenance.earthContextHash);
  assert.equal(a.earthContext.learningEligible, false);
  assert.equal(b.earthContext.learningEligible, false);
});

test("Observed filing-state changes do change the learner truth-state hash", () => {
  const a = buildTrajectoryFeatureRow(syntheticRecord(), syntheticObservation());
  const b = buildTrajectoryFeatureRow(
    syntheticRecord(),
    syntheticObservation({
      filingFingerprint: "filing-2",
      filings: [
        ...syntheticObservation().filings,
        {
          accessionNumber: "0000000001-26-000002",
          filingDate: "2026-09-22",
          reportDate: "2026-09-21",
          form: "10-Q",
          primaryDocument: "q.htm",
        }
      ],
    })
  );
  assert.notEqual(a.provenance.truthStateHash, b.provenance.truthStateHash);
  assert.notEqual(a.truthState.sec.filingSequenceHash, b.truthState.sec.filingSequenceHash);
});

test("Trajectory stores Earth methodology only as non-learning audit context", () => {
  const row = buildTrajectoryFeatureRow(syntheticRecord(), syntheticObservation(), {
    ticker: "TEST",
    workId: "t0:TEST",
    state: "canonical",
    evidencePath: "data/baseline-evidence/TEST.json",
    updatedAt: "2026-09-22T18:00:00.000Z",
  });
  assert.equal(row.earthContext.learningEligible, false);
  assert.equal(row.earthContext.purpose, "audit-and-methodology-comparison-only");
  assert.equal(row.provenance.workId, "t0:TEST");
  assert.equal(row.provenance.workgraphEvidencePath, "data/baseline-evidence/TEST.json");
  assert.ok(row.provenance.selectedEvidenceRefsHash);
});

test("Trajectory snapshot creates immutable 1/2/3/5-year observed-outcome hooks", () => {
  const snapshot = buildTrajectorySnapshot({
    rankings: [syntheticRecord()],
    observations: { TEST: syntheticObservation() },
    asOf: "2026-09-22T18:00:00.000Z",
    generatedAt: "2026-09-22T18:01:00.000Z",
    methodologyVersion: "1.0.0",
    universeVersion: "u1-250",
    trialTickNumber: 1,
  });
  assert.equal(snapshot.canonicalWriteAuthority, false);
  assert.equal(snapshot.learningPolicy.primaryTrainingInput, "truthState");
  assert.equal(snapshot.learningPolicy.earthContextLearningEligible, false);
  assert.equal(snapshot.records, 1);
  assert.equal(snapshot.truthCompleteRecords, 1);
  assert.deepEqual(snapshot.horizons.map((row) => row.months), [12, 24, 36, 60]);
  assert.ok(snapshot.horizons.every((row) => Date.parse(row.targetAt) > Date.parse(snapshot.asOf)));
  assert.deepEqual(validateTrajectorySnapshot(snapshot), []);
});

test("Trajectory validator rejects future leakage, missing observed truth and learning-eligible Earth context", () => {
  const snapshot = buildTrajectorySnapshot({
    rankings: [syntheticRecord()],
    observations: { TEST: syntheticObservation({ filingFingerprint: null }) },
    asOf: "2026-09-22T18:00:00.000Z",
    methodologyVersion: "1.0.0",
    universeVersion: "u1-250",
  });
  snapshot.sourceCutoff = "2026-09-23T18:00:00.000Z";
  snapshot.rows[0].earthContext.learningEligible = true;
  const errors = validateTrajectorySnapshot(snapshot);
  assert.ok(errors.some((value) => value.includes("source cutoff exceeds")));
  assert.ok(errors.some((value) => value.includes("incomplete trajectory truth")));
  assert.ok(errors.some((value) => value.includes("Earth context became learning-eligible")));
});

test("Current publishable ranking can be represented by the truth-first T1000 schema", async () => {
  const ranking = await json("data/runtime/current-ranking.json");
  const observations = await json("data/runtime/company-observations.json");
  const workgraph = await json("data/runtime/workgraph/state.json");
  const snapshot = buildTrajectorySnapshot({
    rankings: ranking.rankings,
    observations: observations.candidates,
    workgraphCompanies: workgraph.companies,
    asOf: ranking.capturedAt,
    methodologyVersion: ranking.methodologyVersion,
    universeVersion: "u1-250",
  });
  assert.equal(snapshot.records, ranking.rankings.length);
  assert.equal(snapshot.truthCompleteRecords, ranking.rankings.length);
  assert.deepEqual(validateTrajectorySnapshot(snapshot), []);
});

test("Truth-state hashes are deterministic", () => {
  assert.equal(trajectoryHash({ b: 2, a: 1 }), trajectoryHash({ a: 1, b: 2 }));
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
