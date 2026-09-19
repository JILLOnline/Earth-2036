import registry from "../config/methodology-1.0.json";

export const EARTH_METHODOLOGY_VERSION = registry.version as "1.0.0";

export const EARTH_SCORE_WEIGHTS = Object.freeze(registry.scoreWeights);
export const EARTH_RISK_PENALTY_WEIGHT = registry.riskPenaltyWeight;
export const EARTH_CONFIDENCE_FLOOR_MULTIPLIER = registry.confidenceFloorMultiplier;
export const MIN_PUBLISHABLE_DATA_CONFIDENCE = registry.minimumPublishableDataConfidence;
export const ACTIVE_UNIVERSE_SIZE = registry.activeUniverseSize;
export const CHAMPIONSHIP_SIZE = registry.championshipSize;
export const MONTHLY_FINALIST_SIZE = registry.monthlyFinalistSize;
export const QUARTERLY_FINALIST_SIZE = registry.quarterlyFinalistSize;
export const ANNUAL_CANDIDATE_SIZE = registry.annualCandidateSize;
export const TRIAL_TICKS_REQUIRED = registry.trialTicksRequired;

export const FULL_UNIVERSE_TICK_RULES = Object.freeze({
  companiesExpected: ACTIVE_UNIVERSE_SIZE,
  companiesObserved: ACTIVE_UNIVERSE_SIZE,
  minimumSourceCoverage: registry.minimumSourceCoverage,
  discoveryScanRequired: true,
  methodologyVersion: EARTH_METHODOLOGY_VERSION,
});

export type EarthScoreComponent = keyof typeof EARTH_SCORE_WEIGHTS;

const weightTotal = Object.values(EARTH_SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
if (Math.abs(weightTotal - 1) > 1e-9) {
  throw new Error(`Earth 2036 score weights must total 1.0; found ${weightTotal}.`);
}
