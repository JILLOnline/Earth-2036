import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const CALIBRATION_REGISTRY = require("../../config/methodology-1.0.json");

function finiteValue(node) {
  if (!node || typeof node !== "object") return null;
  if (Number.isFinite(node.value)) return Number(node.value);
  if (Number.isFinite(node.numericAssessment)) return Number(node.numericAssessment);
  return null;
}

function evidenceLeaves(node, leaves = []) {
  if (!node || typeof node !== "object") return leaves;
  const value = finiteValue(node);
  if (value !== null || Array.isArray(node.sourceIds) || node.note || node.basis) {
    leaves.push({
      value,
      sourceIds: Array.isArray(node.sourceIds) ? node.sourceIds.filter(Boolean) : [],
      note: String(node.note || node.basis || "").trim(),
    });
    return leaves;
  }
  for (const value of Object.values(node)) evidenceLeaves(value, leaves);
  return leaves;
}

export function calibrationBand(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) return null;
  return CALIBRATION_REGISTRY.calibrationPolicy.bands.find((band) => numeric >= band.min && numeric <= band.max) || null;
}

export function componentCalibrationGuidance(component) {
  const spec = CALIBRATION_REGISTRY.components?.[component];
  if (!spec) return null;
  return {
    component,
    description: spec.description,
    anchors: spec.anchors,
    policy: CALIBRATION_REGISTRY.calibrationPolicy.rule,
    calibrationVersion: CALIBRATION_REGISTRY.calibrationVersion,
  };
}

export function auditCalibrationRecord(record) {
  const reasons = [];
  const components = [];
  const factorEvidence = record?.factorEvidence || {};
  for (const component of CALIBRATION_REGISTRY.requiredScoreComponents) {
    const value = Number(record?.components?.[component] ?? record?.[component]);
    const band = calibrationBand(value);
    const leaves = evidenceLeaves(factorEvidence?.[component]);
    const sourcedLeaves = leaves.filter((leaf) => leaf.value !== null && leaf.sourceIds.length > 0 && leaf.note);
    if (!Number.isFinite(value)) reasons.push(`missing_component:${component}`);
    else if (!band) reasons.push(`component_out_of_range:${component}`);
    if (sourcedLeaves.length === 0) reasons.push(`missing_source_addressed_component_evidence:${component}`);
    components.push({
      component,
      value: Number.isFinite(value) ? value : null,
      band,
      evidenceLeaves: leaves.length,
      sourcedLeaves: sourcedLeaves.length,
      guidance: componentCalibrationGuidance(component),
    });
  }

  const riskLeaves = evidenceLeaves(record?.riskEvidence);
  const confidenceLeaves = evidenceLeaves(record?.dataConfidenceEvidence);
  if (!riskLeaves.some((leaf) => leaf.value !== null && leaf.sourceIds.length && leaf.note)) reasons.push("missing_source_addressed_risk_evidence");
  if (!confidenceLeaves.some((leaf) => leaf.value !== null && leaf.sourceIds.length && leaf.note)) reasons.push("missing_source_addressed_confidence_evidence");
  if (record?.methodologyVersion !== CALIBRATION_REGISTRY.version) reasons.push("methodology_version_mismatch");

  return {
    ticker: record?.ticker || null,
    methodologyVersion: record?.methodologyVersion || null,
    calibrationVersion: CALIBRATION_REGISTRY.calibrationVersion,
    passed: reasons.length === 0,
    reasons: [...new Set(reasons)],
    components,
  };
}

export function buildPacketCalibrationGuidance(packet) {
  const missing = packet?.scoreReadiness?.sourceAddressedEvidence?.missingFactorEvidence || CALIBRATION_REGISTRY.requiredScoreComponents;
  return {
    ticker: packet?.ticker || null,
    workId: packet?.workId || null,
    sourceState: packet?.sourceState || null,
    calibrationVersion: CALIBRATION_REGISTRY.calibrationVersion,
    policy: CALIBRATION_REGISTRY.calibrationPolicy,
    requiredComponents: CALIBRATION_REGISTRY.requiredScoreComponents,
    missingComponents: missing,
    components: Object.fromEntries(
      CALIBRATION_REGISTRY.requiredScoreComponents.map((component) => [component, componentCalibrationGuidance(component)])
    ),
    directionalEvidence: packet?.factorEvidence?.byPerspective || {},
    note: "Shadow guidance only. It never creates evidence, never manufactures a score, and never overrides truth gates.",
  };
}
