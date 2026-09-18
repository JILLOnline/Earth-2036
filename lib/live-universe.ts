import entityRegistryJson from "../data/runtime/entity-registry.json";
import currentRankingJson from "../data/runtime/current-ranking.json";
import scoreStateJson from "../data/runtime/score-state.json";
import { activeUniverseSeeds } from "./universe";

export type LiveUniverseRow = {
  seedSlot: number;
  ticker: string;
  company: string;
  division: string;
  lane: string;
  seedClass: "active_seed";
  identityStatus: "validated" | "unresolved";
  tradabilityStatus: "validated" | "unresolved";
  cik: string | null;
  exchange: string | null;
  scoreStatus: "publishable" | "scored" | "pending";
  earthScore: number | null;
  dataConfidence: number | null;
  risk: number | null;
  officialRank: number | null;
  rankClass: string | null;
};

type EntityRuntime = {
  ticker: string;
  cik?: string | null;
  exchange?: string | null;
  identityStatus?: string;
  tradabilityStatus?: string;
};

type ScoreRuntime = {
  earthScore?: number;
  dataConfidence?: number;
  risk?: number;
};

type RankRuntime = {
  ticker: string;
  rank?: number;
  rankClass?: string;
  earthScore?: number;
  dataConfidence?: number;
  risk?: number;
};

const registry = entityRegistryJson as unknown as { candidates: EntityRuntime[] };
const scoreState = scoreStateJson as unknown as { candidates: Record<string, ScoreRuntime> };
const ranking = currentRankingJson as unknown as { official?: boolean; rankings: RankRuntime[] };

export const liveRankingOfficial = ranking.official === true;

const entityByTicker = new Map(registry.candidates.map((entity) => [entity.ticker, entity]));
const rankByTicker = new Map(ranking.rankings.map((row) => [row.ticker, row]));

export const liveUniverse: LiveUniverseRow[] = activeUniverseSeeds.map((seed, index) => {
  const entity = entityByTicker.get(seed.ticker);
  const score = scoreState.candidates[seed.ticker];
  const rank = rankByTicker.get(seed.ticker);
  const earthScore = rank?.earthScore ?? score?.earthScore ?? null;
  const dataConfidence = rank?.dataConfidence ?? score?.dataConfidence ?? null;
  const risk = rank?.risk ?? score?.risk ?? null;

  return {
    seedSlot: index + 1,
    ticker: seed.ticker,
    company: seed.company,
    division: seed.division,
    lane: seed.lane,
    seedClass: "active_seed",
    identityStatus: entity?.identityStatus === "validated" ? "validated" : "unresolved",
    tradabilityStatus: entity?.tradabilityStatus === "validated" ? "validated" : "unresolved",
    cik: entity?.cik ?? null,
    exchange: entity?.exchange ?? null,
    scoreStatus: rank ? "publishable" : score && Number.isFinite(score.earthScore) ? "scored" : "pending",
    earthScore,
    dataConfidence,
    risk,
    officialRank: liveRankingOfficial ? rank?.rank ?? null : null,
    rankClass: liveRankingOfficial ? rank?.rankClass ?? null : null,
  };
});

export const liveUniverseByTicker = new Map(liveUniverse.map((row) => [row.ticker, row]));

export const liveUniverseSummary = Object.freeze({
  total: liveUniverse.length,
  identityValidated: liveUniverse.filter((row) => row.identityStatus === "validated").length,
  tradabilityValidated: liveUniverse.filter((row) => row.tradabilityStatus === "validated").length,
  verified: liveUniverse.filter((row) => row.identityStatus === "validated" && row.tradabilityStatus === "validated").length,
  scored: liveUniverse.filter((row) => row.scoreStatus !== "pending").length,
  publishable: liveUniverse.filter((row) => row.scoreStatus === "publishable").length,
});
