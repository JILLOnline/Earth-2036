import {
  EARTH_CONFIDENCE_FLOOR_MULTIPLIER,
  EARTH_METHODOLOGY_VERSION,
  EARTH_RISK_PENALTY_WEIGHT,
  EARTH_SCORE_WEIGHTS,
  MIN_PUBLISHABLE_DATA_CONFIDENCE,
} from "./methodology";

export type ScoreInputs = {
  thesisQuality: number;
  financialOperatingMomentum: number;
  marketValuationOpportunity: number;
  catalystScore: number;
  governancePower: number;
  alignment2036: number;
  crossDivisionLeverage: number;
  bottleneckControl: number;
  scenarioRobustness: number;
  substitutionResilience: number;
  supplyChainResilience: number;
  pricingPower: number;
  dataConfidence: number;
  risk: number;
};

export type EarthScoreBreakdown = {
  methodologyVersion: typeof EARTH_METHODOLOGY_VERSION;
  rawWeightedScore: number;
  confidenceMultiplier: number;
  riskPenalty: number;
  earthScore: number;
  publishable: boolean;
};

export const EARTH_SCORE_VERSION = EARTH_METHODOLOGY_VERSION;

function clamp100(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function calculateEarthScoreBreakdown(input: ScoreInputs): EarthScoreBreakdown {
  const normalized = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, clamp100(value)]),
  ) as ScoreInputs;

  const rawWeightedScore = Object.entries(EARTH_SCORE_WEIGHTS).reduce(
    (sum, [key, weight]) => sum + normalized[key as keyof typeof EARTH_SCORE_WEIGHTS] * weight,
    0,
  );

  const confidenceMultiplier =
    EARTH_CONFIDENCE_FLOOR_MULTIPLIER +
    (1 - EARTH_CONFIDENCE_FLOOR_MULTIPLIER) * (normalized.dataConfidence / 100);

  const riskPenalty = normalized.risk * EARTH_RISK_PENALTY_WEIGHT;
  const earthScore = clamp100(rawWeightedScore * confidenceMultiplier - riskPenalty);

  return {
    methodologyVersion: EARTH_METHODOLOGY_VERSION,
    rawWeightedScore: round1(rawWeightedScore),
    confidenceMultiplier: Math.round(confidenceMultiplier * 1000) / 1000,
    riskPenalty: round1(riskPenalty),
    earthScore: round1(earthScore),
    publishable: normalized.dataConfidence >= MIN_PUBLISHABLE_DATA_CONFIDENCE,
  };
}

export function calculateEarthScore(input: ScoreInputs): number {
  return calculateEarthScoreBreakdown(input).earthScore;
}

export type OpportunityInputs = {
  catalystProximity: number;
  estimateRevisionMomentum: number;
  operatingAcceleration: number;
  technicalPressure: number;
  eventAsymmetry: number;
  dataConfidence: number;
  nearTermRisk: number;
};

export function calculateOpportunityScore(input: OpportunityInputs): number {
  const catalyst = clamp100(input.catalystProximity) * 0.22;
  const revisions = clamp100(input.estimateRevisionMomentum) * 0.18;
  const operating = clamp100(input.operatingAcceleration) * 0.18;
  const pressure = clamp100(input.technicalPressure) * 0.14;
  const asymmetry = clamp100(input.eventAsymmetry) * 0.18;
  const confidence = clamp100(input.dataConfidence) * 0.10;
  const riskPenalty = clamp100(input.nearTermRisk) * 0.18;
  return round1(clamp100(catalyst + revisions + operating + pressure + asymmetry + confidence - riskPenalty));
}

export type EvidenceClass = "Wood" | "Hay" | "Iron" | "Gold" | "Diamond";

export type EvidenceSignal = {
  sourceReliability: number;
  magnitude: number;
  novelty: number;
  durability: number;
  direction: number;
  confidence: number;
};

export function evidenceImpact(signal: EvidenceSignal): number {
  const quality =
    (Math.max(0, Math.min(5, signal.sourceReliability)) / 5) * 0.30 +
    (Math.max(0, Math.min(5, signal.magnitude)) / 5) * 0.30 +
    (Math.max(0, Math.min(5, signal.novelty)) / 5) * 0.15 +
    (Math.max(0, Math.min(5, signal.durability)) / 5) * 0.25;

  const direction = Math.max(-1, Math.min(1, signal.direction));
  const confidence = Math.max(0, Math.min(1, signal.confidence));
  return Math.round(quality * direction * confidence * 1000) / 1000;
}
