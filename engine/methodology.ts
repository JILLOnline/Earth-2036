export const EARTH_METHODOLOGY_VERSION = "1.0.0" as const;

export const EARTH_SCORE_WEIGHTS = Object.freeze({
  thesisQuality: 0.12,
  financialOperatingMomentum: 0.12,
  marketValuationOpportunity: 0.08,
  catalystScore: 0.06,
  governancePower: 0.07,
  alignment2036: 0.12,
  crossDivisionLeverage: 0.08,
  bottleneckControl: 0.10,
  scenarioRobustness: 0.08,
  substitutionResilience: 0.07,
  supplyChainResilience: 0.05,
  pricingPower: 0.05,
});

export const EARTH_RISK_PENALTY_WEIGHT = 0.16;
export const EARTH_CONFIDENCE_FLOOR_MULTIPLIER = 0.80;
export const MIN_PUBLISHABLE_DATA_CONFIDENCE = 60;
export const ACTIVE_UNIVERSE_SIZE = 250;
export const CHAMPIONSHIP_SIZE = 10;
export const MONTHLY_FINALIST_SIZE = 5;
export const QUARTERLY_FINALIST_SIZE = 3;
export const ANNUAL_CANDIDATE_SIZE = 12;
export const TRIAL_TICKS_REQUIRED = 1000;

export const FULL_UNIVERSE_TICK_RULES = Object.freeze({
  companiesExpected: ACTIVE_UNIVERSE_SIZE,
  companiesObserved: ACTIVE_UNIVERSE_SIZE,
  minimumSourceCoverage: 0.95,
  discoveryScanRequired: true,
  methodologyVersion: EARTH_METHODOLOGY_VERSION,
});

export type EarthScoreComponent = keyof typeof EARTH_SCORE_WEIGHTS;

const weightTotal = Object.values(EARTH_SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
if (Math.abs(weightTotal - 1) > 1e-9) {
  throw new Error(`Earth 2036 score weights must total 1.0; found ${weightTotal}.`);
}
