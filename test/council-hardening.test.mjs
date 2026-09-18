import assert from "node:assert/strict";
import test from "node:test";
import { qualifiesT0Publication, qualifiesTick } from "../scripts/lib/runtime-gates.mjs";

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

test("T0 publication requires the same Workgraph and integrity gates as a qualified universe", () => {
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
