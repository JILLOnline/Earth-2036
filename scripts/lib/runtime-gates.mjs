import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const METHODOLOGY_REGISTRY = require("../../config/methodology-1.0.json");
export const METHODOLOGY_VERSION = METHODOLOGY_REGISTRY.version;
export const MIN_PUBLISHABLE_DATA_CONFIDENCE = METHODOLOGY_REGISTRY.minimumPublishableDataConfidence;
export const ACTIVE_UNIVERSE_SIZE = METHODOLOGY_REGISTRY.activeUniverseSize;
export const CHAMPIONSHIP_SIZE = METHODOLOGY_REGISTRY.championshipSize;
export const REQUIRED_SCORE_COMPONENTS = Object.freeze([...METHODOLOGY_REGISTRY.requiredScoreComponents]);

export const SCORE_CONTRACT_VERSION = "earth-score-contract-v1";
const SCORE_FORMULA_DESCRIPTOR = Object.freeze({
  methodologyVersion: METHODOLOGY_VERSION,
  scoreWeights: METHODOLOGY_REGISTRY.scoreWeights,
  riskPenaltyWeight: METHODOLOGY_REGISTRY.riskPenaltyWeight,
  confidenceFloorMultiplier: METHODOLOGY_REGISTRY.confidenceFloorMultiplier,
});
export const SCORE_FORMULA_HASH = createHash("sha256")
  .update(JSON.stringify(SCORE_FORMULA_DESCRIPTOR))
  .digest("hex");

function clamp100(value) {
  if (!Number.isFinite(Number(value))) return null;
  return Math.max(0, Math.min(100, Number(value)));
}
function round1(value) {
  return Math.round(value * 10) / 10;
}

export function calculateCanonicalEarthScoreBreakdown(input = {}) {
  const missingComponents = REQUIRED_SCORE_COMPONENTS.filter((key) => clamp100(input?.[key]) === null);
  const risk = clamp100(input?.risk);
  const dataConfidence = clamp100(input?.dataConfidence);
  const reasons = [];
  if (missingComponents.length) reasons.push(...missingComponents.map((key) => `missing_component:${key}`));
  if (risk === null) reasons.push("missing_risk");
  if (dataConfidence === null) reasons.push("missing_data_confidence");
  if (reasons.length) {
    return {
      valid: false,
      methodologyVersion: METHODOLOGY_VERSION,
      contractVersion: SCORE_CONTRACT_VERSION,
      formulaHash: SCORE_FORMULA_HASH,
      reasons,
      missingComponents,
      rawWeightedScore: null,
      confidenceMultiplier: null,
      riskPenalty: null,
      earthScore: null,
      publishable: false,
    };
  }

  const rawWeightedScore = REQUIRED_SCORE_COMPONENTS.reduce(
    (sum, key) => sum + clamp100(input[key]) * Number(METHODOLOGY_REGISTRY.scoreWeights[key] || 0),
    0,
  );
  const confidenceMultiplier =
    METHODOLOGY_REGISTRY.confidenceFloorMultiplier +
    (1 - METHODOLOGY_REGISTRY.confidenceFloorMultiplier) * (dataConfidence / 100);
  const riskPenalty = risk * METHODOLOGY_REGISTRY.riskPenaltyWeight;
  const earthScore = Math.max(0, Math.min(100, rawWeightedScore * confidenceMultiplier - riskPenalty));

  return {
    valid: true,
    methodologyVersion: METHODOLOGY_VERSION,
    contractVersion: SCORE_CONTRACT_VERSION,
    formulaHash: SCORE_FORMULA_HASH,
    reasons: [],
    missingComponents: [],
    rawWeightedScore: round1(rawWeightedScore),
    confidenceMultiplier: Math.round(confidenceMultiplier * 1000) / 1000,
    riskPenalty: round1(riskPenalty),
    earthScore: round1(earthScore),
    publishable: dataConfidence >= MIN_PUBLISHABLE_DATA_CONFIDENCE,
  };
}

export function scoreContractAudit(record, tolerance = 0.051) {
  const calculation = calculateCanonicalEarthScoreBreakdown({
    ...(record?.components || {}),
    risk: record?.risk,
    dataConfidence: record?.dataConfidence,
  });
  const storedEarthScore = Number(record?.earthScore);
  const delta = calculation.valid && Number.isFinite(storedEarthScore)
    ? storedEarthScore - calculation.earthScore
    : null;
  const scoreMatches = calculation.valid && Number.isFinite(storedEarthScore) && Math.abs(delta) <= tolerance;
  const contractMatches =
    record?.scoreContract?.version === SCORE_CONTRACT_VERSION &&
    record?.scoreContract?.formulaHash === SCORE_FORMULA_HASH;
  return {
    valid: calculation.valid,
    passed: calculation.valid && scoreMatches && contractMatches,
    scoreMatches,
    contractMatches,
    storedEarthScore: Number.isFinite(storedEarthScore) ? storedEarthScore : null,
    expectedEarthScore: calculation.earthScore,
    delta: delta === null ? null : Math.round(delta * 1000) / 1000,
    calculation,
  };
}

export function normalizeCanonicalScoreRecord(record) {
  if (!record || typeof record !== "object") return record;
  const calculation = calculateCanonicalEarthScoreBreakdown({
    ...(record.components || {}),
    risk: record.risk,
    dataConfidence: record.dataConfidence,
  });
  if (!calculation.valid) return record;

  const priorContract = record.scoreContract && typeof record.scoreContract === "object" ? record.scoreContract : {};
  const authoredEarthScore = Number.isFinite(Number(priorContract.sourceAuthoredEarthScore))
    ? Number(priorContract.sourceAuthoredEarthScore)
    : Number.isFinite(Number(record.earthScore))
      ? Number(record.earthScore)
      : null;
  const delta = authoredEarthScore === null ? null : authoredEarthScore - calculation.earthScore;

  return {
    ...record,
    earthScore: calculation.earthScore,
    scoreBreakdown: {
      methodologyVersion: calculation.methodologyVersion,
      rawWeightedScore: calculation.rawWeightedScore,
      confidenceMultiplier: calculation.confidenceMultiplier,
      riskPenalty: calculation.riskPenalty,
      earthScore: calculation.earthScore,
      publishable: calculation.publishable,
    },
    scoreContract: {
      ...priorContract,
      version: SCORE_CONTRACT_VERSION,
      formulaHash: SCORE_FORMULA_HASH,
      sourceAuthoredEarthScore: authoredEarthScore,
      normalized: priorContract.normalized === true || (delta !== null && Math.abs(delta) > 0.051),
    },
  };
}

export function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function isScoreRecordComplete(record, methodologyVersion = METHODOLOGY_VERSION, confidenceFloor = MIN_PUBLISHABLE_DATA_CONFIDENCE) {
  if (!record || record.methodologyVersion !== methodologyVersion) return false;
  if (!Number.isFinite(record.earthScore) || !Number.isFinite(record.risk) || !Number.isFinite(record.dataConfidence)) return false;
  if (record.dataConfidence < confidenceFloor) return false;
  if (!record.components || REQUIRED_SCORE_COMPONENTS.some((key) => !Number.isFinite(record.components[key]))) return false;
  if (!Array.isArray(record.primarySourceUrls) || record.primarySourceUrls.length === 0) return false;
  return true;
}

export function isPublishableScoreRecord(record, methodologyVersion = METHODOLOGY_VERSION, confidenceFloor = MIN_PUBLISHABLE_DATA_CONFIDENCE) {
  return isScoreRecordComplete(record, methodologyVersion, confidenceFloor) && record.causalMapped === true;
}

export function rankRecords(records) {
  return [...records]
    .sort((a, b) => {
      if (b.earthScore !== a.earthScore) return b.earthScore - a.earthScore;
      if (b.dataConfidence !== a.dataConfidence) return b.dataConfidence - a.dataConfidence;
      if (a.risk !== b.risk) return a.risk - b.risk;
      return a.ticker.localeCompare(b.ticker);
    })
    .map((record, index) => ({
      ...record,
      rank: index + 1,
      rankClass: index < CHAMPIONSHIP_SIZE ? "championship" : "contender",
    }));
}

export function confidenceAdjustedBoundaryScore(earthScore, dataConfidence) {
  const confidence = Math.max(0, Math.min(100, dataConfidence));
  const uncertaintyPenalty = (100 - confidence) * 0.05;
  return Math.round((earthScore - uncertaintyPenalty) * 100) / 100;
}

function commonFullUniverseGate({
  companiesExpected,
  companiesObserved,
  identityValidated,
  tradabilityValidated,
  sourceCoverage,
  discoveryScanCompleted,
  methodologyVersion,
  unresolvedEvidence,
  scoredCompanies,
  councilApproved,
  intelligenceIntegrityPassed,
}) {
  return Boolean(
    companiesExpected === ACTIVE_UNIVERSE_SIZE &&
    companiesObserved === ACTIVE_UNIVERSE_SIZE &&
    identityValidated === ACTIVE_UNIVERSE_SIZE &&
    tradabilityValidated === ACTIVE_UNIVERSE_SIZE &&
    clamp01(sourceCoverage) >= METHODOLOGY_REGISTRY.minimumSourceCoverage &&
    discoveryScanCompleted === true &&
    methodologyVersion === METHODOLOGY_VERSION &&
    unresolvedEvidence === 0 &&
    scoredCompanies === ACTIVE_UNIVERSE_SIZE &&
    councilApproved === true &&
    intelligenceIntegrityPassed === true
  );
}

export function qualifiesT0Publication(input) {
  return commonFullUniverseGate(input);
}

export function qualifiesTick({ baselinePublished, ...input }) {
  return Boolean(baselinePublished && commonFullUniverseGate(input));
}

export function baselineGate({
  identityValidated,
  tradabilityValidated,
  scoredCompanies,
  publishableCompanies,
  sourceCoverage,
  discoveryScanCompleted,
  unresolvedEvidence,
}) {
  const expected = ACTIVE_UNIVERSE_SIZE;
  const checks = {
    identity: identityValidated === expected,
    tradability: tradabilityValidated === expected,
    scored: scoredCompanies === expected,
    publishable: publishableCompanies === expected,
    sourceCoverage: clamp01(sourceCoverage) >= METHODOLOGY_REGISTRY.minimumSourceCoverage,
    discovery: discoveryScanCompleted === true,
    evidenceQueue: unresolvedEvidence === 0,
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}
