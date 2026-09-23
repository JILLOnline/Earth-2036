import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildFundamentalsTruth, validateFundamentalsTruth } from "../scripts/lib/sec-fundamentals-truth.mjs";
import {
  bridgeFundamentalsTruth, unknownFundamentalsBridge, invalidFundamentalsBridge,
  validateFundamentalsBridgeDescriptor, reconstructFundamentalsBridge, fundamentalsBridgeHealth,
} from "../scripts/lib/fundamentals-trajectory-bridge.mjs";
import { createBridgeIndex, verifyBridgeIndex } from "../scripts/lib/fundamentals-bridge-index.mjs";
import { buildTrajectoryFeatureRow, buildTrajectorySnapshot, validateTrajectorySnapshot } from "../scripts/lib/trajectory-engine.mjs";

const CIK = "0001551182";
const TICKER = "TEST";
const CUTOFF = "2026-04-01T00:00:00.000Z";
const PRIOR = "2026-02-15T00:00:00.000Z";
const obs = { ticker: TICKER, cik: CIK, observedAt: CUTOFF, filingFingerprint: "filings-test", filings: [
  { accessionNumber: "A1", filingDate: "2026-02-01", form: "10-K" },
]};
const fact = (val, filed, accn, form = "10-K", unit = "USD", start = "2025-01-01", end = "2025-12-31") => ({
  val, filed, accn, form, start, end, fy: 2025, fp: "FY",
});
function payload(extra = {}) {
  return {
    cik: 1551182, entityName: "Bridge Test Corp",
    facts: {
      "us-gaap": {
        RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [
          fact(100, "2026-02-01", "A1"),
          fact(105, "2026-03-01", "A2", "10-K/A"),
        ]}},
        ResearchAndDevelopmentExpense: { units: { USD: [fact(20, "2026-02-01", "A1")] } },
      },
    },
    ...extra,
  };
}
function truth(source = payload(), options = {}) {
  return buildFundamentalsTruth(source, {
    ticker: TICKER, cik: CIK, asOf: CUTOFF, retrievedAt: "2026-04-02T00:00:00.000Z",
    ...options,
  });
}
const reference = (record = truth(), observation = obs, asOf = CUTOFF) =>
  bridgeFundamentalsTruth({ ticker: TICKER, asOf, observation, fundamentalsTruth: record });
const snapshot = (refs = {}) => buildTrajectorySnapshot({
  rankings: [{ ticker: TICKER, earthScore: 90, rank: 1 }],
  observations: { [TICKER]: obs }, fundamentalsByTicker: refs, asOf: CUTOFF,
});
const clone = (v) => structuredClone(v);
const validRef = reference();

test("01 contract freezes every canonical, forecast and training authority", async () => {
  const c = JSON.parse(await readFile(new URL("../config/fundamentals-trajectory-bridge-v1.json", import.meta.url), "utf8"));
  assert.equal(c.system, "shadow");
  for (const p of ["canonicalWriteAuthority", "mayChangeEarthScore", "mayChangeCanonicalRank",
    "mayChangeWorkgraphState", "mayAffectTickQualification", "mayGenerateForecasts", "mayTrainModels"])
    assert.equal(c[p], false, p);
});
test("02 valid audited raw PIT truth bridges successfully", () => {
  assert.equal(validRef.status, "valid");
  assert.equal(validRef.learningEligible, true);
  assert.deepEqual(validateFundamentalsBridgeDescriptor(validRef, { ticker: TICKER, cik: CIK, asOf: CUTOFF }), []);
});
test("03 wrong CIK fails closed", () => {
  const b = reference(truth(), { ...obs, cik: "0000000001" });
  assert.equal(b.status, "invalid");
  assert.ok(b.reason.includes("cik_mismatch"));
});
test("04 ticker mismatch fails closed", () => {
  const b = bridgeFundamentalsTruth({ ticker: "WRONG", asOf: CUTOFF, observation: obs, fundamentalsTruth: truth() });
  assert.equal(b.status, "invalid");
});
test("05 asOf must match exact snapshot time", () => {
  assert.equal(reference(truth(), obs, PRIOR).status, "invalid");
});
test("06 future raw fact cannot enter learner", () => {
  const t = clone(truth());
  t.rawTruth.facts[0].filed = "2026-08-01";
  assert.equal(reference(t).status, "invalid");
});
test("07 future source cutoff fails closed", () => {
  const t = clone(truth());
  t.sourceCutoff = "2026-04-02T00:00:00.000Z";
  assert.ok(reference(t).reason.some((r) => r.includes("future_source_cutoff")));
});
test("08 future amendment cannot rewrite past truth", () => {
  const before = payload();
  before.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.pop();
  const earlier = truth(before, { asOf: PRIOR });
  const later = truth(payload(), { asOf: PRIOR });
  assert.equal(earlier.truthHash, later.truthHash);
  assert.equal(earlier.rawTruth.factsHash, later.rawTruth.factsHash);
});
test("09 same-day conflicts remain raw and normalized ambiguous", () => {
  const p = payload();
  p.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(
    fact(109, "2026-03-01", "A3", "10-K/A"));
  const t = truth(p);
  const period = t.normalizedProjection.metrics.revenue.latest.annual;
  assert.equal(period.status, "ambiguous_concepts");
  assert.equal(period.selected, null);
  assert.equal(reference(t).status, "valid");
});
for (const [number, field, action] of [
  ["10", "rawFact", (t) => { t.rawTruth.facts[0].val = 999; }],
  ["11", "truthHash", (t) => { t.truthHash = "0".repeat(64); }],
  ["12", "projectionHash", (t) => { t.projectionHash = "0".repeat(64); }],
  ["13", "sourcePayloadHash", (t) => { t.sourcePayloadHash = "0".repeat(64); }],
  ["14", "contextViewHash", (t) => { t.rawTruth.contextViewHash = "0".repeat(64); }],
  ["15", "recordHash", (t) => { t.recordHash = "0".repeat(64); }],
]) test(number + " " + field + " tampering independently invalidates bridge", () => {
  const t = clone(truth()); action(t);
  assert.equal(reference(t).status, "invalid");
});
test("16 changing Earth Score leaves raw bridge identity untouched", () => {
  const a = buildTrajectoryFeatureRow({ ticker: TICKER, earthScore: 91 }, obs, null, validRef, CUTOFF);
  const b = buildTrajectoryFeatureRow({ ticker: TICKER, earthScore: 2 }, obs, null, validRef, CUTOFF);
  assert.equal(a.truthState.fundamentals.truthHash, b.truthState.fundamentals.truthHash);
  assert.equal(a.provenance.truthStateHash, b.provenance.truthStateHash);
});
test("17 changing rank cannot change bridge", () => {
  const a = buildTrajectoryFeatureRow({ ticker: TICKER, rank: 1 }, obs, null, validRef, CUTOFF);
  const b = buildTrajectoryFeatureRow({ ticker: TICKER, rank: 249 }, obs, null, validRef, CUTOFF);
  assert.equal(a.provenance.truthStateHash, b.provenance.truthStateHash);
});
test("18 methodology component changes remain Earth context only", () => {
  const a = buildTrajectoryFeatureRow({ ticker: TICKER, thesisQuality: 10 }, obs, null, validRef, CUTOFF);
  const b = buildTrajectoryFeatureRow({ ticker: TICKER, thesisQuality: 100 }, obs, null, validRef, CUTOFF);
  assert.equal(a.provenance.truthStateHash, b.provenance.truthStateHash);
});
test("19 metric projections cannot mutate raw identity; tampering invalidates record separately", () => {
  const t = clone(truth());
  const pitHash = t.truthHash;
  t.normalizedProjection.metrics.revenue.status = "missing";
  assert.equal(t.truthHash, pitHash);
  assert.equal(reference(t).status, "invalid");
});
test("20 missing named metrics are unknown, raw unusual facts remain eligible", () => {
  const p = payload();
  p.facts = { "us-gaap": { UnmappedBankMetric: { units: { USD: [fact(25,"2026-02-01","B1")] } } } };
  const t = truth(p);
  assert.equal(t.normalizedProjection.metrics.revenue.status, "missing");
  assert.equal(reference(t).status, "valid");
});
test("21 entirely absent Company Facts remains unknown, never zero", () => {
  const x = bridgeFundamentalsTruth({ ticker: TICKER, asOf: CUTOFF, observation: obs, fundamentalsTruth: null });
  assert.equal(x.status, "unknown");
  assert.equal(x.rawFactCount, null);
});
test("22 SEC zero eligible facts remains unknown", () => {
  const t = truth({ cik: 1551182, facts: {} });
  assert.equal(reference(t).status, "unknown");
});
for (const [number, name, taxonomy, tag] of [
  ["23", "IFRS foreign issuer", "ifrs-full", "Revenue"],
  ["24", "US GAAP industrial", "us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax"],
  ["25", "bank without mapped revenue", "us-gaap", "LoansAndLeasesReceivableNetReportedAmount"],
  ["26", "insurance without mapped revenue", "us-gaap", "InsuranceReserves"],
  ["27", "REIT unmapped disclosures", "us-gaap", "InvestmentPropertyNet"],
]) test(number + " " + name + " raw XBRL survives regardless of metric coverage", () => {
  const t = truth({ cik: 1551182, facts: { [taxonomy]: { [tag]: { units: { USD: [fact(40,"2026-02-01","SECTOR")] } } } } });
  assert.equal(reference(t).status, "valid");
  assert.ok(reference(t).sourceTaxonomies.includes(taxonomy));
});
test("28 53-week fiscal year survives raw and normalized annual", () => {
  const p = payload();
  p.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD =
    [fact(123, "2026-03-01", "FY53", "10-K", "USD", "2024-12-29", "2026-01-03")];
  const t = truth(p);
  assert.equal(t.normalizedProjection.metrics.revenue.latest.annual.status, "resolved");
  assert.equal(reference(t).status, "valid");
});
test("29 10-KT and 10-QT remain transition rather than annual/quarter", () => {
  for (const form of ["10-KT", "10-QT"]) {
    const p = payload();
    p.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD =
      [fact(20, "2026-03-01", "TRANS", form, "USD", "2025-07-01", "2025-12-31")];
    assert.equal(truth(p).normalizedProjection.metrics.revenue.latest.transition.status, "resolved");
  }
});
test("30 multiple units remain distinct raw facts", () => {
  const p = payload();
  p.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.EUR =
    [fact(90, "2026-02-01", "A1", "10-K", "EUR")];
  const t = truth(p);
  assert.ok(t.rawTruth.facts.some((r) => r.unit === "EUR"));
  assert.ok(t.rawTruth.facts.some((r) => r.unit === "USD"));
  assert.equal(reference(t).status, "valid");
});
test("31 currencies never silently converted by the bridge", () => {
  const p = payload();
  p.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.EUR =
    [fact(90, "2026-02-01", "A1", "10-K", "EUR")];
  const t = truth(p);
  assert.equal(t.normalizedProjection.metrics.revenue.latest.annual.status, "ambiguous_periods");
  assert.equal(reference(t).status, "valid");
});
test("32 foreign issuer 6-K remains raw-only", () => {
  const p = { cik: 1551182, facts: { "ifrs-full": { Revenue: {
    units: { EUR: [fact(100, "2026-03-01", "FOREIGN", "6-K", "EUR")] },
  } } } };
  const t = truth(p);
  assert.equal(t.rawTruth.facts[0].form, "6-K");
  assert.equal(t.normalizedProjection.metrics.revenue.status, "missing");
  assert.equal(reference(t).status, "valid");
});
test("33 historical amendment replay compares exact past hashes", () => {
  const p = payload();
  const old = truth(p, { asOf: PRIOR });
  const b = reference(old, obs, PRIOR);
  assert.equal(reconstructFundamentalsBridge(b, p).status, "reconstructed");
  assert.equal(b.rawFactCount, 3); // first annual revenue + R&D
});
test("34 exact same inputs are deterministic", () => {
  assert.equal(reference(truth()).descriptorHash, reference(truth()).descriptorHash);
});
test("35 descriptor hash is deterministic and independently verified", () => {
  const changed = clone(validRef);
  changed.rawFactCount += 1;
  assert.ok(validateFundamentalsBridgeDescriptor(changed).includes("descriptor_hash_mismatch"));
});
test("36 malformed raw records can never become eligible", () => {
  const t = clone(truth()); delete t.rawTruth.facts[0].taxonomy;
  assert.equal(reference(t).learningEligible, false);
});
test("37 full raw facts never enter tick JSON", () => {
  const row = buildTrajectoryFeatureRow({ ticker: TICKER }, obs, null, validRef, CUTOFF);
  assert.equal(JSON.stringify(row).includes('"facts":'), false);
  assert.equal(JSON.stringify(row).includes('"rawTruth":'), false);
});
test("38 bridge never has canonical or Workgraph authority", () => {
  assert.equal(validRef.canonicalWriteAuthority, undefined);
  const row = buildTrajectoryFeatureRow({ ticker: TICKER, earthScore: 90 }, obs, { state: "canonical" }, validRef, CUTOFF);
  assert.equal(row.earthContext.learningEligible, false);
  assert.equal(row.truthState.fundamentals.learningEligible, true);
});
test("39 absent fundamentals does not poison filing snapshot or tick qualification", () => {
  const s = snapshot();
  assert.equal(s.truthCompleteRecords, 1);
  assert.equal(s.fundamentalsHealth.unknown, 1);
  assert.deepEqual(validateTrajectorySnapshot(s), []);
});
test("40 Earth context is never a learner input", () => {
  const s = snapshot({ [TICKER]: validRef });
  assert.equal(s.learningPolicy.primaryTrainingInput, "truthState");
  assert.equal(s.rows[0].earthContext.learningEligible, false);
  assert.equal(s.rows[0].fundamentalsAuditProjection.learningEligible, false);
  assert.deepEqual(validateTrajectorySnapshot(s), []);
});
test("41 projectionHash cannot masquerade as truthHash", () => {
  const altered = clone(validRef); altered.truthHash = altered.projectionHash;
  assert.ok(validateFundamentalsBridgeDescriptor(altered).length);
});
test("42 historical SEC source drift excludes sample, never substitutes new truth", () => {
  const modified = payload();
  modified.facts["us-gaap"].ResearchAndDevelopmentExpense.units.USD[0].val = 300;
  assert.equal(reconstructFundamentalsBridge(validRef, modified).status, "historical_truth_unrecoverable");
});
test("43 missing source excludes historical sample", () => {
  assert.equal(reconstructFundamentalsBridge(validRef, null).status, "historical_truth_unrecoverable");
});
test("44 source identity mismatch excludes historical sample", () => {
  assert.equal(reconstructFundamentalsBridge(validRef, { ...payload(), cik: 9 }).status, "historical_truth_unrecoverable");
});
test("45 index asOf mismatch cannot import stale truth", () => {
  const index = createBridgeIndex({ asOf: PRIOR, entries: { [TICKER]: { reference: validRef, auditProjection: { learningEligible: false, projectionHash: validRef.projectionHash } } } });
  assert.deepEqual(verifyBridgeIndex(index, { asOf: CUTOFF }), {});
});
test("46 mutated index hash marks affected refs invalid", () => {
  const index = createBridgeIndex({ asOf: CUTOFF, entries: { [TICKER]: { reference: validRef, auditProjection: { learningEligible: false, projectionHash: validRef.projectionHash } } } });
  index.entries[TICKER].reference.rawFactCount += 1;
  assert.equal(verifyBridgeIndex(index, { asOf: CUTOFF, observations: { TEST: obs } }).TEST.reference.status, "invalid");
});
test("47 index projection authority tampering fails closed", () => {
  const index = createBridgeIndex({ asOf: CUTOFF, entries: { TEST: { reference: validRef, auditProjection: { learningEligible: true, projectionHash: validRef.projectionHash } } } });
  const result = verifyBridgeIndex(index, { asOf: CUTOFF, observations: { TEST: obs } });
  assert.equal(result.TEST.reference.status, "invalid");
});
test("48 malformed raw/reference cannot become an eligible snapshot", () => {
  const bad = clone(validRef); bad.sourcePayloadHash = "garbage";
  const s = snapshot({ TEST: bad });
  assert.equal(s.rows[0].learningEligibility.fundamentalsRaw, false);
  assert.equal(s.rows[0].truthState.fundamentals.status, "invalid");
  assert.deepEqual(validateTrajectorySnapshot(s), []);
});
test("49 snapshot hash protects bridge integrity independently", () => {
  const s = snapshot({ TEST: validRef });
  s.rows[0].truthState.fundamentals.rawFactCount = 9;
  assert.ok(validateTrajectorySnapshot(s).length);
});
test("50 health counts distinct raw fact states instead of duplicated fact arrays", () => {
  const refs = [validRef, validRef, unknownFundamentalsBridge({ ticker: "MISSING", asOf: CUTOFF })];
  const h = fundamentalsBridgeHealth(refs);
  assert.equal(h.valid, 2); assert.equal(h.unknown, 1);
  assert.equal(h.uniqueFactStates, 1);
});
test("51 compact 250 x 1000 tick references remain sub-gigabyte without raw facts", () => {
  const bytes = Buffer.byteLength(JSON.stringify(validRef));
  assert.ok(bytes * 250 * 1000 < 1_000_000_000);
  assert.equal("facts" in validRef, false);
});
test("52 full capture and governance wiring are visibly nonblocking", async () => {
  const finalizer = await readFile(new URL("../scripts/finalize-qualified-tick.mjs", import.meta.url), "utf8");
  const workgraph = await readFile(new URL("../scripts/workgraph-sync.mjs", import.meta.url), "utf8");
  assert.ok(finalizer.includes("loadVerifiedBridgeIndex"));
  assert.ok(workgraph.includes("loadVerifiedBridgeIndex"));
  const authority = finalizer.slice(finalizer.indexOf("const fullUniverseInput"), finalizer.indexOf("const finalizationDiagnostics"));
  assert.ok(!authority.includes("fundamentalsByTicker"));
  assert.ok(!finalizer.includes("if (trajectoryErrors"));
  assert.ok(!finalizer.includes("if (t0TrajectoryErrors"));
});
test("53 no training or live forecasts can be smuggled into Trajectory", () => {
  const s = snapshot({ TEST: validRef });
  assert.equal(s.learningPolicy.modelsEnabled, false);
  assert.equal(s.learningPolicy.forecastsEnabled, false);
  s.rows[0].forecast = { target: "revenue" };
  assert.ok(validateTrajectorySnapshot(s).some((e) => e.includes("forecast")));
});
test("54 no invalid reference may claim learning eligibility", () => {
  const ref = invalidFundamentalsBridge({ ticker: TICKER, asOf: CUTOFF });
  ref.learningEligible = true;
  assert.ok(validateFundamentalsBridgeDescriptor(ref).some((e) => e.includes("learning_eligible")));
});
