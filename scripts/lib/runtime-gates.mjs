import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const METHODOLOGY_REGISTRY = require("../../config/methodology-1.0.json");
export const METHODOLOGY_VERSION = METHODOLOGY_REGISTRY.version;
export const MIN_PUBLISHABLE_DATA_CONFIDENCE = METHODOLOGY_REGISTRY.minimumPublishableDataConfidence;
export const ACTIVE_UNIVERSE_SIZE = METHODOLOGY_REGISTRY.activeUniverseSize;
export const CHAMPIONSHIP_SIZE = METHODOLOGY_REGISTRY.championshipSize;
export const REQUIRED_SCORE_COMPONENTS = Object.freeze([...METHODOLOGY_REGISTRY.requiredScoreComponents]);

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
