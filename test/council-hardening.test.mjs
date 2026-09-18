import assert from "node:assert/strict";
import test from "node:test";
import { qualifiesT0Publication, qualifiesTick } from "../scripts/lib/runtime-gates.mjs";
import { normalizeLaneReportPath, validateLaneReportShape } from "../scripts/lib/supervisor-council.mjs";

const cleanUniverse = {
  companiesExpected: 250,
  companiesObserved: 250,
  identityValidated: 250,
  tradabilityValidated: 250,
  sourceCoverage: 0.97,
  discoveryScanCompleted: true,
  methodologyVersion: "1.0.0",
  unresolvedEvidence: 0,
  scoredCompanies: 250,
  councilApproved: true,
  intelligenceIntegrityPassed: true,
};

const cleanTick = { baselinePublished: true, ...cleanUniverse };

test("T0 publication requires the same council and integrity gates as a qualified universe", () => {
  assert.equal(qualifiesT0Publication(cleanUniverse), true);
  assert.equal(qualifiesT0Publication({ ...cleanUniverse, councilApproved: false }), false);
  assert.equal(qualifiesT0Publication({ ...cleanUniverse, sourceCoverage: 0.94 }), false);
  assert.equal(qualifiesT0Publication({ ...cleanUniverse, discoveryScanCompleted: false }), false);
  assert.equal(qualifiesT0Publication({ ...cleanUniverse, intelligenceIntegrityPassed: false }), false);
  assert.equal(qualifiesT0Publication({ ...cleanUniverse, scoredCompanies: 249 }), false);
});

test("qualified tick rechecks identity, tradability and Beast integrity", () => {
  assert.equal(qualifiesTick(cleanTick), true);
  assert.equal(qualifiesTick({ ...cleanTick, baselinePublished: false }), false);
  assert.equal(qualifiesTick({ ...cleanTick, identityValidated: 249 }), false);
  assert.equal(qualifiesTick({ ...cleanTick, tradabilityValidated: 249 }), false);
  assert.equal(qualifiesTick({ ...cleanTick, intelligenceIntegrityPassed: false }), false);
  assert.equal(qualifiesTick({ ...cleanTick, intelligenceIntegrityPassed: undefined }), false);
});

test("lane report schema cannot pass on empty complete output", () => {
  const laneId = "source-integrity";
  const cycleKey = "20260913T1300Z";
  const clean = {
    reportVersion: 1,
    laneId,
    cycleKey,
    generatedAt: "2026-09-13T13:32:00Z",
    status: "complete",
    summary: "Independent pass complete.",
    materialFindings: [],
    proposedCanonicalChanges: [],
    contradictions: [],
    unknowns: [],
    peerRequests: [],
    accuracyDebates: [],
    blockingIssues: [],
    directivesReviewed: [],
    confidence: 90,
    acquisitionComplete: true,
  };
  assert.equal(validateLaneReportShape(clean, laneId, cycleKey).passed, true);
  assert.equal(validateLaneReportShape({ laneId, cycleKey, status: "complete" }, laneId, cycleKey).passed, false);
  assert.equal(validateLaneReportShape({ ...clean, confidence: 101 }, laneId, cycleKey).passed, false);
});

test("no-material-change requires an explicit successful acquisition pass", () => {
  const laneId = "discovery-weak-signals";
  const cycleKey = "20260913T1300Z";
  const base = {
    reportVersion: 1,
    laneId,
    cycleKey,
    generatedAt: "2026-09-13T13:40:00Z",
    status: "no_material_change",
    summary: "No material change after a successful scan.",
    materialFindings: [],
    proposedCanonicalChanges: [],
    contradictions: [],
    unknowns: [],
    peerRequests: [],
    accuracyDebates: [],
    blockingIssues: [],
    directivesReviewed: [],
    confidence: 80,
  };
  assert.equal(validateLaneReportShape({ ...base, acquisitionComplete: true }, laneId, cycleKey).passed, true);
  assert.equal(validateLaneReportShape({ ...base, acquisitionComplete: false }, laneId, cycleKey).passed, false);
});

test("lane paths normalize repo prefix but reject unrelated paths through attestation validation", () => {
  assert.equal(normalizeLaneReportPath("earth-2036/data/runtime/supervisors/cycles/X/a.json"), "data/runtime/supervisors/cycles/X/a.json");
  assert.equal(normalizeLaneReportPath("data/runtime/supervisors/cycles/X/a.json"), "data/runtime/supervisors/cycles/X/a.json");
});
