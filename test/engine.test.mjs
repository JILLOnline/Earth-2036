import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { parseNasdaqListed, parseOtherListed } from "../scripts/earth2036-engine.mjs";
import { buildUniverse, normalizeTicker, parseExpansionContenders } from "../scripts/lib/universe-parser.mjs";
import { baselineGate, confidenceAdjustedBoundaryScore, isPublishableScoreRecord, qualifiesTick, rankRecords, REQUIRED_SUPERVISOR_LANES } from "../scripts/lib/runtime-gates.mjs";
import { gitBlobSha, validateCouncilAttestationShape } from "../scripts/lib/supervisor-council.mjs";

const completeComponents = {
  thesisQuality: 70,
  financialOperatingMomentum: 70,
  marketValuationOpportunity: 70,
  catalystScore: 70,
  governancePower: 70,
  alignment2036: 70,
  crossDivisionLeverage: 70,
  bottleneckControl: 70,
  scenarioRobustness: 70,
  substitutionResilience: 70,
  supplyChainResilience: 70,
  pricingPower: 70,
};

test("ticker normalization is deterministic", () => {
  assert.equal(normalizeTicker(" brk.b "), "BRK-B");
});

test("expansion parser preserves group metadata without rank semantics", () => {
  const parsed = parseExpansionContenders('seedGroup("Grid", "Transformers", [["AAA", "Alpha"],["BBB", "Beta"]])');
  assert.deepEqual(parsed, [
    { ticker: "AAA", company: "Alpha", division: "Grid", lane: "Transformers", seedClass: "active_universe" },
    { ticker: "BBB", company: "Beta", division: "Grid", lane: "Transformers", seedClass: "active_universe" },
  ]);
});

test("Nasdaq directory parser maps fields correctly and excludes ETF/test issues", () => {
  const sample = [
    "Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares",
    "GOOD|Good Corp|Q|N|N|100|N|N",
    "ETFX|ETF Corp|G|N|N|100|Y|N",
    "TEST|Test Issue|Q|Y|N|100|N|N",
    "File Creation Time: 202609121800",
  ].join("\n");
  const parsed = parseNasdaqListed(sample);
  assert.equal(parsed.size, 1);
  assert.deepEqual(parsed.get("GOOD"), { symbol: "GOOD", name: "Good Corp", exchange: "NASDAQ", roundLot: "100" });
  assert.equal(parsed.has("ETFX"), false);
  assert.equal(parsed.has("TEST"), false);
});

test("other-listed parser maps exchange and excludes ETF/test issues", () => {
  const sample = [
    "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol",
    "AAA|Alpha Corp|N|AAA|N|100|N|AAA",
    "BBB|ETF Thing|A|BBB|Y|100|N|BBB",
    "CCC|Test Thing|Z|CCC|N|100|Y|CCC",
    "File Creation Time: 202609121800",
  ].join("\n");
  const parsed = parseOtherListed(sample);
  assert.equal(parsed.size, 1);
  assert.deepEqual(parsed.get("AAA"), { symbol: "AAA", name: "Alpha Corp", exchange: "NYSE", roundLot: "100" });
  assert.equal(parsed.has("BBB"), false);
  assert.equal(parsed.has("CCC"), false);
});

test("canonical repository universe parses to exactly 250 unique neutral seeds", async () => {
  const root = process.cwd();
  const [universeSource, expansionSource] = await Promise.all([
    readFile(path.join(root, "lib", "universe.ts"), "utf8"),
    readFile(path.join(root, "lib", "universe-expansion.ts"), "utf8"),
  ]);
  const universe = buildUniverse({ universeSource, expansionSource, expectedSize: 250 });
  assert.equal(universe.length, 250);
  assert.equal(new Set(universe.map((row) => row.ticker)).size, 250);
  assert.equal(universe.filter((row) => row.seedClass === "active_universe").length, 250);
  assert.equal(universe.some((row) => Object.hasOwn(row, "rank")), false);
  assert.equal(universe.some((row) => Object.hasOwn(row, "earthScore")), false);
});

test("universe parser rejects duplicate tickers", () => {
  assert.throws(() => buildUniverse({
    universeSource: '{ ticker: "AAA", company: "A", division: "X", lane: "Z" }{ ticker: "AAA", company: "A2", division: "Y", lane: "Q" }',
    expansionSource: "",
    expectedSize: 2,
  }), /Duplicate universe ticker/);
});

test("publishable score requires complete sourced causal record", () => {
  assert.equal(isPublishableScoreRecord({ methodologyVersion: "1.0.0", earthScore: 80, risk: 30, dataConfidence: 75, components: completeComponents, primarySourceUrls: ["https://example.com/primary"], causalMapped: true }), true);
  assert.equal(isPublishableScoreRecord({ methodologyVersion: "1.0.0", earthScore: 80, risk: 30, dataConfidence: 75, components: completeComponents, primarySourceUrls: [], causalMapped: true }), false);
});

test("ranking tie-breaks match canonical methodology", () => {
  const ranked = rankRecords([
    { ticker: "B", earthScore: 80, dataConfidence: 70, risk: 20 },
    { ticker: "A", earthScore: 80, dataConfidence: 70, risk: 20 },
    { ticker: "C", earthScore: 80, dataConfidence: 80, risk: 50 },
    { ticker: "D", earthScore: 79, dataConfidence: 100, risk: 0 },
  ]);
  assert.deepEqual(ranked.map((row) => row.ticker), ["C", "A", "B", "D"]);
});

test("confidence-adjusted boundary penalizes uncertainty", () => {
  assert.ok(confidenceAdjustedBoundaryScore(80, 100) > confidenceAdjustedBoundaryScore(80, 60));
});

test("baseline gate requires every integrity condition", () => {
  assert.equal(baselineGate({ identityValidated: 250, tradabilityValidated: 250, scoredCompanies: 250, publishableCompanies: 250, sourceCoverage: 0.95, discoveryScanCompleted: true, unresolvedEvidence: 0 }).passed, true);
  assert.equal(baselineGate({ identityValidated: 250, tradabilityValidated: 249, scoredCompanies: 250, publishableCompanies: 250, sourceCoverage: 0.95, discoveryScanCompleted: true, unresolvedEvidence: 0 }).passed, false);
});

test("trial tick requires council approval in addition to hard machine gates", () => {
  const clean = {
    baselinePublished: true,
    companiesExpected: 250,
    companiesObserved: 250,
    identityValidated: 250,
    tradabilityValidated: 250,
    sourceCoverage: 0.96,
    discoveryScanCompleted: true,
    methodologyVersion: "1.0.0",
    unresolvedEvidence: 0,
    scoredCompanies: 250,
    councilApproved: true,
    intelligenceIntegrityPassed: true,
  };
  assert.equal(qualifiesTick(clean), true);
  assert.equal(qualifiesTick({ ...clean, unresolvedEvidence: 1 }), false);
  assert.equal(qualifiesTick({ ...clean, councilApproved: false }), false);
  assert.equal(qualifiesTick({ ...clean, councilApproved: undefined }), false);
  assert.equal(qualifiesTick({ ...clean, identityValidated: 249 }), false);
  assert.equal(qualifiesTick({ ...clean, intelligenceIntegrityPassed: false }), false);
});

test("council attestation requires all six same-cycle clean lanes", () => {
  const cycleKey = "20260913T1200Z";
  const lanes = Object.fromEntries(REQUIRED_SUPERVISOR_LANES.map((laneId) => [laneId, {
    cycleKey,
    status: "complete",
    path: `data/runtime/supervisors/cycles/${cycleKey}/${laneId}.json`,
    blobSha: "a".repeat(40),
    blockingIssueCount: 0,
  }]));
  const council = { attestation: {
    attestationId: "attest-20260913T1200Z-test",
    approved: true,
    approvedAt: "2026-09-13T12:52:00Z",
    managerId: "chief-earth",
    cycleKey,
    disagreementsResolved: true,
    unknownsAcknowledged: true,
    sheetMirrorSynced: true,
    canonicalChangesApplied: false,
    requiresRecompute: false,
    unresolvedBlockers: [],
    lanes,
  }};
  assert.equal(validateCouncilAttestationShape(council, cycleKey).passed, true);
  assert.equal(validateCouncilAttestationShape({ attestation: { ...council.attestation, requiresRecompute: true } }, cycleKey).passed, false);
  assert.equal(validateCouncilAttestationShape({ attestation: { ...council.attestation, lanes: { ...lanes, [REQUIRED_SUPERVISOR_LANES[0]]: { ...lanes[REQUIRED_SUPERVISOR_LANES[0]], status: "needs_research" } } } }, cycleKey).passed, false);
});

test("git blob hashing is deterministic for attested lane artifacts", () => {
  assert.equal(gitBlobSha("hello\n"), "ce013625030ba8dba906f756967f9e9ca394464a");
});
