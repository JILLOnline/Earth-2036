export const REQUIRED_SCORE_COMPONENTS = [
  "thesisQuality",
  "financialOperatingMomentum",
  "marketValuationOpportunity",
  "catalystScore",
  "governancePower",
  "alignment2036",
  "crossDivisionLeverage",
  "bottleneckControl",
  "scenarioRobustness",
  "substitutionResilience",
  "supplyChainResilience",
  "pricingPower",
];

export function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function isScoreRecordComplete(record, methodologyVersion = "1.0.0", confidenceFloor = 60) {
  if (!record || record.methodologyVersion !== methodologyVersion) return false;
  if (!Number.isFinite(record.earthScore) || !Number.isFinite(record.risk) || !Number.isFinite(record.dataConfidence)) return false;
  if (record.dataConfidence < confidenceFloor) return false;
  if (!record.components || REQUIRED_SCORE_COMPONENTS.some((key) => !Number.isFinite(record.components[key]))) return false;
  if (!Array.isArray(record.primarySourceUrls) || record.primarySourceUrls.length === 0) return false;
  return true;
}

export function isPublishableScoreRecord(record, methodologyVersion = "1.0.0", confidenceFloor = 60) {
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
      rankClass: index < 10 ? "championship" : "contender",
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
    companiesExpected === 250 &&
    companiesObserved === 250 &&
    identityValidated === 250 &&
    tradabilityValidated === 250 &&
    clamp01(sourceCoverage) >= 0.95 &&
    discoveryScanCompleted === true &&
    methodologyVersion === "1.0.0" &&
    unresolvedEvidence === 0 &&
    scoredCompanies === 250 &&
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
  const checks = {
    identity: identityValidated === 250,
    tradability: tradabilityValidated === 250,
    scored: scoredCompanies === 250,
    publishable: publishableCompanies === 250,
    sourceCoverage: clamp01(sourceCoverage) >= 0.95,
    discovery: discoveryScanCompleted === true,
    evidenceQueue: unresolvedEvidence === 0,
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}
