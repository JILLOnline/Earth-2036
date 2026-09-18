import assert from "node:assert/strict";
import test from "node:test";
import { validateLaneReportShape } from "../scripts/lib/supervisor-council.mjs";

const cycleKey = "20260913T1300Z";
const base = {
  reportVersion: 1,
  laneId: "source-integrity",
  cycleKey,
  generatedAt: "2026-09-13T13:32:00Z",
  status: "complete",
  summary: "Independent source-integrity review completed.",
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

test("qualifying council lane requires completed acquisition", () => {
  assert.equal(validateLaneReportShape(base, base.laneId, cycleKey).passed, true);
  const incomplete = validateLaneReportShape({ ...base, acquisitionComplete: false }, base.laneId, cycleKey);
  assert.equal(incomplete.passed, false);
  assert.ok(incomplete.reasons.includes("lane_qualifying_status_without_acquisition_complete"));
});

test("needs-research lane may truthfully remain acquisition-incomplete but cannot qualify", () => {
  const result = validateLaneReportShape({ ...base, status: "needs_research", acquisitionComplete: false }, base.laneId, cycleKey);
  assert.equal(result.passed, true);
});
