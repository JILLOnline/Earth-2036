import { createHash } from "node:crypto";
import { REQUIRED_SUPERVISOR_LANES } from "./runtime-gates.mjs";

export const QUALIFYING_LANE_STATUSES = new Set(["complete", "no_material_change"]);
export const ALL_LANE_STATUSES = new Set(["complete", "no_material_change", "needs_research", "blocked"]);
export const REQUIRED_LANE_ARRAY_FIELDS = [
  "materialFindings",
  "proposedCanonicalChanges",
  "contradictions",
  "unknowns",
  "peerRequests",
  "accuracyDebates",
  "blockingIssues",
  "directivesReviewed",
];

export function gitBlobSha(content) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(String(content), "utf8");
  const header = Buffer.from(`blob ${body.length}\0`, "utf8");
  return createHash("sha1").update(Buffer.concat([header, body])).digest("hex");
}

export function normalizeLaneReportPath(value) {
  let normalized = String(value || "").trim().replaceAll("\\", "/");
  if (normalized.startsWith("earth-2036/")) normalized = normalized.slice("earth-2036/".length);
  return normalized;
}

export function validateLaneReportShape(report, expectedLaneId, expectedCycleKey) {
  const reasons = [];
  if (!report || typeof report !== "object" || Array.isArray(report)) return { passed: false, reasons: ["lane_report_not_object"] };
  if (report.reportVersion !== 1) reasons.push("lane_report_version_invalid");
  if (report.laneId !== expectedLaneId) reasons.push("lane_identity_mismatch");
  if (report.cycleKey !== expectedCycleKey) reasons.push("lane_report_cycle_mismatch");
  if (!ALL_LANE_STATUSES.has(report.status)) reasons.push("lane_status_invalid");
  if (!String(report.generatedAt || "").trim() || Number.isNaN(Date.parse(report.generatedAt))) reasons.push("lane_generated_at_invalid");
  if (!String(report.summary || "").trim()) reasons.push("lane_summary_missing");
  if (!Number.isFinite(Number(report.confidence)) || Number(report.confidence) < 0 || Number(report.confidence) > 100) reasons.push("lane_confidence_invalid");
  for (const field of REQUIRED_LANE_ARRAY_FIELDS) if (!Array.isArray(report[field])) reasons.push(`lane_field_missing:${field}`);
  if (QUALIFYING_LANE_STATUSES.has(report.status) && Array.isArray(report.blockingIssues) && report.blockingIssues.length) reasons.push("lane_qualifying_status_has_blockers");
  if (QUALIFYING_LANE_STATUSES.has(report.status) && report.acquisitionComplete !== true) reasons.push("lane_qualifying_status_without_acquisition_complete");
  return { passed: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function validateCouncilAttestationShape(council, expectedCycleKey) {
  const attestation = council?.attestation ?? null;
  const reasons = [];
  if (!attestation) reasons.push("missing_attestation");
  if (attestation?.approved !== true) reasons.push("manager_not_approved");
  if (attestation?.managerId !== "chief-earth") reasons.push("invalid_manager_id");
  if (!String(attestation?.attestationId || "").trim()) reasons.push("missing_attestation_id");
  if (!String(attestation?.approvedAt || "").trim() || Number.isNaN(Date.parse(attestation?.approvedAt))) reasons.push("invalid_approved_at");
  if (!expectedCycleKey || attestation?.cycleKey !== expectedCycleKey) reasons.push("cycle_key_mismatch");
  if (attestation?.disagreementsResolved !== true) reasons.push("unresolved_disagreements");
  if (attestation?.unknownsAcknowledged !== true) reasons.push("unknowns_not_acknowledged");
  if (attestation?.sheetMirrorSynced !== true) reasons.push("sheet_mirror_not_synced");
  if (attestation?.canonicalChangesApplied === true) reasons.push("canonical_changes_require_recompute");
  if (attestation?.requiresRecompute === true) reasons.push("manager_requires_recompute");
  if (Array.isArray(attestation?.unresolvedBlockers) && attestation.unresolvedBlockers.length) reasons.push("unresolved_manager_blockers");

  const lanes = attestation?.lanes ?? {};
  for (const laneId of REQUIRED_SUPERVISOR_LANES) {
    const lane = lanes[laneId];
    if (!lane) {
      reasons.push(`missing_lane:${laneId}`);
      continue;
    }
    if (!QUALIFYING_LANE_STATUSES.has(lane.status)) reasons.push(`lane_not_complete:${laneId}`);
    if (lane.cycleKey !== expectedCycleKey) reasons.push(`lane_cycle_mismatch:${laneId}`);
    if (!normalizeLaneReportPath(lane.path).startsWith("data/runtime/supervisors/cycles/")) reasons.push(`lane_path_invalid:${laneId}`);
    if (!/^[0-9a-f]{40}$/i.test(String(lane.blobSha || ""))) reasons.push(`lane_blob_sha_missing:${laneId}`);
    if (Number(lane.blockingIssueCount || 0) !== 0) reasons.push(`lane_blocked:${laneId}`);
  }

  const extras = Object.keys(lanes).filter((laneId) => !REQUIRED_SUPERVISOR_LANES.includes(laneId));
  if (extras.length) reasons.push("unexpected_lane_entries");

  return {
    passed: reasons.length === 0,
    reasons: [...new Set(reasons)],
    attestation,
    requiredLanes: REQUIRED_SUPERVISOR_LANES,
  };
}
