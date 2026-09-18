import {
  ACTIVE_UNIVERSE_SIZE,
  CHAMPIONSHIP_SIZE,
  EARTH_METHODOLOGY_VERSION,
  MIN_PUBLISHABLE_DATA_CONFIDENCE,
  TRIAL_TICKS_REQUIRED,
} from "./methodology";

export type RankedCandidate = {
  ticker: string;
  earthScore: number;
  dataConfidence: number;
  risk: number;
  ticksObserved: number;
  methodologyVersion: string;
};

export type RankClass = "championship" | "contender" | "outside_universe";
export type ObservationMaturity = "rookie" | "seasoned" | "trial_complete";

export function observationMaturity(ticksObserved: number): ObservationMaturity {
  if (ticksObserved >= TRIAL_TICKS_REQUIRED) return "trial_complete";
  if (ticksObserved >= 30) return "seasoned";
  return "rookie";
}

export function rankClass(rank: number | null): RankClass {
  if (rank === null || rank > ACTIVE_UNIVERSE_SIZE) return "outside_universe";
  if (rank <= CHAMPIONSHIP_SIZE) return "championship";
  return "contender";
}

export function isRankPublishable(candidate: RankedCandidate) {
  return (
    candidate.methodologyVersion === EARTH_METHODOLOGY_VERSION &&
    candidate.dataConfidence >= MIN_PUBLISHABLE_DATA_CONFIDENCE &&
    Number.isFinite(candidate.earthScore) &&
    Number.isFinite(candidate.risk)
  );
}

export function rankUniverse(candidates: readonly RankedCandidate[]) {
  return candidates
    .filter(isRankPublishable)
    .slice()
    .sort((a, b) => {
      if (b.earthScore !== a.earthScore) return b.earthScore - a.earthScore;
      if (b.dataConfidence !== a.dataConfidence) return b.dataConfidence - a.dataConfidence;
      if (a.risk !== b.risk) return a.risk - b.risk;
      return a.ticker.localeCompare(b.ticker);
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
      rankClass: rankClass(index + 1),
      maturity: observationMaturity(candidate.ticksObserved),
    }));
}

export function confidenceAdjustedBoundaryScore(earthScore: number, dataConfidence: number) {
  const confidence = Math.max(0, Math.min(100, dataConfidence));
  const uncertaintyPenalty = (100 - confidence) * 0.05;
  return Math.round((earthScore - uncertaintyPenalty) * 100) / 100;
}

export function shouldReplaceBoundary(
  challenger: Pick<RankedCandidate, "earthScore" | "dataConfidence">,
  incumbent: Pick<RankedCandidate, "earthScore" | "dataConfidence">,
) {
  return (
    confidenceAdjustedBoundaryScore(challenger.earthScore, challenger.dataConfidence) >
    confidenceAdjustedBoundaryScore(incumbent.earthScore, incumbent.dataConfidence)
  );
}

export type TickQualificationInput = {
  companiesExpected: number;
  companiesObserved: number;
  sourceCoverage: number;
  discoveryScanCompleted: boolean;
  methodologyVersion: string;
};

export function qualifiesAsFullUniverseTick(input: TickQualificationInput) {
  return (
    input.companiesExpected === ACTIVE_UNIVERSE_SIZE &&
    input.companiesObserved === ACTIVE_UNIVERSE_SIZE &&
    input.sourceCoverage >= 0.95 &&
    input.discoveryScanCompleted &&
    input.methodologyVersion === EARTH_METHODOLOGY_VERSION
  );
}
