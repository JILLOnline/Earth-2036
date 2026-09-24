import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildFundamentalsTruth, validateFundamentalsTruth, truthHash } from "../scripts/lib/sec-fundamentals-truth.mjs";
import {
  bridgeFundamentalsTruth, unknownFundamentalsBridge, invalidFundamentalsBridge,
  validateFundamentalsBridgeDescriptor, reconstructFundamentalsBridge, fundamentalsBridgeHealth,
} from "../scripts/lib/fundamentals-trajectory-bridge.mjs";
import { createBridgeIndex, verifyBridgeIndex } from "../scripts/lib/fundamentals-bridge-index.mjs";
import { buildTrajectoryFeatureRow, buildTrajectorySnapshot, validateTrajectorySnapshot } from "../scripts/lib/trajectory-engine.mjs";
import { validatePinnedBridgeHistory } from "../scripts/check-fundamentals-bridge-history.mjs";

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
  assert.equal(b.rawFactCount, 2); // first annual revenue + R&D
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
  index.entries[TICKER].reference = clone(index.entries[TICKER].reference);
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
  const authority = finalizer.match(/const fullUniverseInput = \{[\s\S]*?\n\};/)[0];
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

test("55 storage/load rehearsal serializes and parses 250,000 actual compact rows", () => {
  const rows = Array.from({ length: 250 }, (_, i) => ({
    ticker: "C" + String(i).padStart(3, "0"),
    truthState: { sec: { filingFingerprint: "source-" + i }, fundamentals: validRef },
    learningEligibility: { filingState: true, fundamentalsRaw: true },
  }));
  let totalBytes = 0;
  for (let tick = 0; tick < 1_000; tick++) {
    const packed = JSON.stringify({ tick, rows });
    totalBytes += Buffer.byteLength(packed);
    const unpacked = JSON.parse(packed);
    assert.equal(unpacked.rows.length, 250);
    assert.equal(unpacked.rows[0].truthState.fundamentals.rawFactsHash, validRef.rawFactsHash);
    assert.equal(packed.includes('"rawTruth":'), false);
    assert.equal(packed.includes('"facts":'), false);
  }
  assert.ok(totalBytes < 1_000_000_000, "compact reference history must stay under 1 GB");
});
async function createOfflineCacheFixture(sample = payload()) {
  const root = await mkdtemp(path.join(os.tmpdir(), "earth2036-bridge-11-"));
  const observations = JSON.parse(await readFile(new URL("../data/runtime/company-observations.json", import.meta.url), "utf8"));
  const filingFingerprint = observations.candidates?.ETN?.filingFingerprint;
  assert.ok(filingFingerprint, "trusted ETN fingerprint must exist");
  const hash = truthHash(sample);
  const archive = path.join("source", CIK, hash + ".json");
  const archiveFile = path.join(root, archive);
  await mkdir(path.dirname(archiveFile), { recursive: true });
  await writeFile(archiveFile, JSON.stringify(sample) + "\n", "utf8");
  await writeFile(path.join(root, "cache-manifest.json"), JSON.stringify({
    contract: "earth2036-bridge-source-cache-v1",
    companies: { ETN: { cik: CIK, filingFingerprint, payloadHash: hash, archivePath: archive, fetchedAt: CUTOFF } },
    historical: {},
  }), "utf8");
  const run = () => spawnSync(process.execPath, [
    new URL("../scripts/lab-fundamentals-trajectory-bridge.mjs", import.meta.url).pathname,
    "--tickers", "ETN", "--limit", "1", "--as-of", CUTOFF, "--no-network",
    "--strict", "--cache-dir", root,
  ], { cwd: new URL("../", import.meta.url).pathname, encoding: "utf8", timeout: 30000 });
  return { root, archiveFile, run };
}
test("56 offline sidecar persists and reuses audited #10 snapshots without SEC network", async () => {
  const { root, run } = await createOfflineCacheFixture();
  try {
    const first = run();
    assert.equal(first.status, 0, first.stderr + "\n" + first.stdout);
    const result = JSON.parse(first.stdout);
    assert.equal(result.unknown, 0);
    assert.equal(result.invalid, 0);
    assert.equal(result.sourceRefreshes, 0);
    assert.equal(result.changedFactStates, 1);
    const index = JSON.parse(await readFile(path.join(root, "current-index.json"), "utf8"));
    assert.equal(index.entries.ETN.reference.status, "valid");
    assert.deepEqual(verifyBridgeIndex(index, { asOf: CUTOFF, observations: { ETN: { cik: CIK } } }).ETN.reference, index.entries.ETN.reference);
    const beforeArchive = await readdir(path.dirname(path.join(root, "source", CIK, "placeholder.json")));
    const second = run();
    assert.equal(second.status, 0, second.stderr + "\n" + second.stdout);
    assert.equal(JSON.parse(second.stdout).changedFactStates, 0);
    assert.deepEqual(await readdir(path.join(root, "source", CIK)), beforeArchive);
    const immutableIndexes = await readdir(path.join(root, "indexes", CUTOFF.replace(/[^A-Za-z0-9]/g, "")));
    assert.ok(immutableIndexes.length >= 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("57 corrupted cached source fails closed and never triggers an accidental SEC fetch", async () => {
  const { root, archiveFile, run } = await createOfflineCacheFixture();
  try {
    await writeFile(archiveFile, JSON.stringify({ ...payload(), entityName: "corrupt" }), "utf8");
    const failed = run();
    assert.equal(failed.status, 1, "strict offline cache corruption must fail");
    const report = JSON.parse(failed.stdout);
    assert.equal(report.unknown, 0);
    assert.equal(report.invalid, 1);
    assert.equal(report.sourceRefreshes, 0);
    assert.equal(report.canaries[0].status, "invalid");
    const index = JSON.parse(await readFile(path.join(root, "current-index.json"), "utf8"));
    assert.equal(index.entries.ETN.reference.status, "invalid");
    assert.equal(fundamentalsBridgeHealth(Object.values(index.entries).map((e) => e.reference)).invalid, 1);
    assert.match(report.canaries[0].reason, /cached SEC source hash mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("58 future metric-map drift is separately reported without invalidating exact reconstructed raw truth", () => {
  const old = clone(validRef);
  old.projectionHash = "f".repeat(64);
  old.reconstructionContract.expectedProjectionHash = old.projectionHash;
  const { descriptorHash, ...core } = old;
  old.descriptorHash = truthHash(core);
  assert.deepEqual(validateFundamentalsBridgeDescriptor(old), []);
  const result = reconstructFundamentalsBridge(old, payload());
  assert.equal(result.status, "reconstructed");
  assert.equal(result.projectionStatus, "drift");
  assert.equal(result.truthHash, old.truthHash);
});

test("59 pinned historical canaries detect silent source drift without counting T1000 ticks", async () => {
  const baseline = JSON.parse(await readFile(new URL("../config/fundamentals-bridge-historical-baseline-v1.json", import.meta.url), "utf8"));
  const periods = [...new Set(baseline.samples.map((r) => r.asOf))];
  const report = {
    contract: "earth2036-fundamentals-trajectory-bridge-v1",
    historical: true, trialEligible: false, invalid: 0, unknown: 0,
    canaries: baseline.samples.map((r) => ({ ...r, status: "valid", reconstructed: true })),
    indexes: periods.map((asOf) => ({
      asOf, valid: baseline.samples.filter((r) => r.asOf === asOf).length,
      invalid: 0, unknown: 0, canonicalWrites: 0, projectionAuthority: 0,
    })),
  };
  assert.deepEqual(validatePinnedBridgeHistory(report, baseline), []);
  report.canaries[0].truthHash = "0".repeat(64);
  assert.ok(validatePinnedBridgeHistory(report, baseline).some((v) => v.startsWith("historical_raw_truth_drift")));
  report.canaries[0].truthHash = baseline.samples[0].truthHash;
  report.trialEligible = true;
  assert.ok(validatePinnedBridgeHistory(report, baseline).includes("historical_canary_claimed_trial_or_wrong_contract"));
});

test("60 unavailable offline source appears as unknown in index and System health denominator", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "earth2036-bridge-11-missing-"));
  try {
    const result = spawnSync(process.execPath, [
      new URL("../scripts/lab-fundamentals-trajectory-bridge.mjs", import.meta.url).pathname,
      "--tickers", "ETN", "--limit", "1", "--as-of", CUTOFF,
      "--no-network", "--strict", "--cache-dir", root,
    ], { cwd: new URL("../", import.meta.url).pathname, encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.unknown, 1);
    assert.equal(report.invalid, 0);
    const index = JSON.parse(await readFile(path.join(root, "current-index.json"), "utf8"));
    assert.equal(index.entries.ETN.reference.status, "unknown");
    const h = fundamentalsBridgeHealth(Object.values(index.entries).map((entry) => entry.reference));
    assert.equal(h.companies, 1);
    assert.equal(h.valid, 0);
    assert.equal(h.unknown, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("61 mixed index retains exact eligible/unknown/invalid population and never imputes facts", () => {
  const raw = [
    validRef,
    unknownFundamentalsBridge({ ticker: "MISSING", asOf: CUTOFF }),
    invalidFundamentalsBridge({ ticker: "BROKEN", asOf: CUTOFF, reasons: ["source hash mismatch"] }),
  ];
  const report = fundamentalsBridgeHealth(raw);
  assert.deepEqual([report.companies, report.valid, report.unknown, report.invalid], [3,1,1,1]);
  assert.equal(report.rawFactsReferenced, validRef.rawFactCount);
  assert.equal(report.hashFailures, 1);
  assert.equal(report.projectionAuthority, 0);
  assert.equal(report.canonicalWrites, 0);
});

test("62 empty but valid Company Facts remains unknown, not invalid or favorable", async () => {
  const { root, run } = await createOfflineCacheFixture({ cik: 1551182, entityName: "Empty Facts", facts: {} });
  try {
    const result = run();
    assert.equal(result.status, 1, "strict audit alerts on unknown, while production continues");
    const report = JSON.parse(result.stdout);
    assert.equal(report.invalid, 0);
    assert.equal(report.unknown, 1);
    const index = JSON.parse(await readFile(path.join(root, "current-index.json"), "utf8"));
    assert.equal(index.entries.ETN.reference.status, "unknown");
    assert.equal(index.entries.ETN.reference.rawFactCount, null);
    assert.equal(index.entries.ETN.reference.learningEligible, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("63 human-readable SEC CIK and hash diagnostics are counted in System health", () => {
  const refs = [
    invalidFundamentalsBridge({ ticker: "CIK", asOf: CUTOFF, reasons: ["SEC source CIK mismatch"] }),
    invalidFundamentalsBridge({ ticker: "HASH", asOf: CUTOFF, reasons: ["cached SEC source hash mismatch"] }),
  ];
  const health = fundamentalsBridgeHealth(refs);
  assert.equal(health.companies, 2);
  assert.equal(health.invalid, 2);
  assert.equal(health.cikMismatches, 1);
  assert.equal(health.hashFailures, 1);
});


test("64 production bootstrap is durable, shadow-only, and consumed from committed runtime index", async () => {
  const finalizer = await readFile(new URL("../scripts/finalize-qualified-tick.mjs", import.meta.url), "utf8");
  const sync = await readFile(new URL("../scripts/workgraph-sync.mjs", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../.github/workflows/fundamentals-bridge-bootstrap.yml", import.meta.url), "utf8");
  const validator = await readFile(new URL("../scripts/validate-fundamentals-bridge-bootstrap.mjs", import.meta.url), "utf8");
  assert.ok(finalizer.includes("fundamentals-bridge-index.json"));
  assert.equal(finalizer.includes('data", "lab", "bridge", "current-index.json'), false);
  assert.ok(sync.includes("BRIDGE_INDEX_PATH"));
  assert.ok(sync.includes("systemState?.lastCycleAt"));
  assert.ok(workflow.includes("--limit 250"));
  assert.ok(workflow.includes("gh release create"));
  assert.ok(workflow.includes("fundamentals-source-cache.tar.gz.sha256"));
  assert.ok(validator.includes("canonicalWriteAuthority: false"));
  assert.ok(validator.includes("trialEligible: false"));
  assert.ok(validator.includes("statuses.invalid !== 0"));
});
