import {
  ACTIVE_UNIVERSE_SIZE,
  EARTH_METHODOLOGY_VERSION,
  MIN_PUBLISHABLE_DATA_CONFIDENCE,
} from "./methodology";

export const OFFICIAL_T0_ID = "earth2036-official-t0-2026-09-12" as const;

export type BaselineSourceRef = {
  sourceId: string;
  url: string;
  retrievedAt: string;
  primary: boolean;
  supports: string[];
};

export type BaselineComponents = {
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

export type BaselineCompanyRecord = {
  baselineId: typeof OFFICIAL_T0_ID;
  methodologyVersion: typeof EARTH_METHODOLOGY_VERSION;
  ticker: string;
  company: string;
  division: string;
  lane: string;
  cik: string | null;
  exchange: string;
  tradabilityStatus: "verified" | "not_verified" | "not_trading" | "ambiguous";
  identityStatus: "verified" | "ambiguous" | "invalid";
  evidenceWindowEnd: string;
  components: BaselineComponents | null;
  earthScore: number | null;
  opportunityScore: number | null;
  evidenceTier: "Wood" | "Hay" | "Iron" | "Gold" | "Diamond" | null;
  sources: BaselineSourceRef[];
  notes: string[];
  status: "pending" | "validated" | "scored" | "rejected";
};

export type BaselineValidation = {
  publishable: boolean;
  errors: string[];
};

function inRange(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export function validateBaselineCompany(record: BaselineCompanyRecord): BaselineValidation {
  const errors: string[] = [];

  if (record.baselineId !== OFFICIAL_T0_ID) errors.push("Wrong baseline id.");
  if (record.methodologyVersion !== EARTH_METHODOLOGY_VERSION) errors.push("Wrong methodology version.");
  if (!record.ticker.trim()) errors.push("Missing ticker.");
  if (!record.company.trim()) errors.push("Missing company name.");
  if (!record.division.trim()) errors.push("Missing division.");
  if (!record.lane.trim()) errors.push("Missing functional lane.");
  if (!record.exchange.trim()) errors.push("Missing exchange.");
  if (record.identityStatus !== "verified") errors.push("Identity is not verified.");
  if (record.tradabilityStatus !== "verified") errors.push("Tradability is not verified.");
  if (!record.sources.some((source) => source.primary)) errors.push("No primary source attached.");
  if (record.status !== "scored") errors.push("Record has not completed scoring.");
  if (!record.components) errors.push("Missing score components.");
  if (record.earthScore === null || !inRange(record.earthScore)) errors.push("Missing or invalid Earth Score.");

  if (record.components) {
    for (const [key, value] of Object.entries(record.components)) {
      if (!inRange(value)) errors.push(`Invalid component ${key}.`);
    }
    if (record.components.dataConfidence < MIN_PUBLISHABLE_DATA_CONFIDENCE) {
      errors.push(`Data confidence below ${MIN_PUBLISHABLE_DATA_CONFIDENCE}.`);
    }
  }

  return { publishable: errors.length === 0, errors };
}

export function validateOfficialT0(records: readonly BaselineCompanyRecord[]) {
  const duplicateTickers = records
    .map((record) => record.ticker)
    .filter((ticker, index, tickers) => tickers.indexOf(ticker) !== index);
  const companyResults = records.map((record) => ({
    ticker: record.ticker,
    ...validateBaselineCompany(record),
  }));
  const publishableCount = companyResults.filter((result) => result.publishable).length;

  return {
    baselineId: OFFICIAL_T0_ID,
    expectedCompanies: ACTIVE_UNIVERSE_SIZE,
    observedCompanies: records.length,
    publishableCompanies: publishableCount,
    duplicateTickers: [...new Set(duplicateTickers)],
    publishable:
      records.length === ACTIVE_UNIVERSE_SIZE &&
      publishableCount === ACTIVE_UNIVERSE_SIZE &&
      duplicateTickers.length === 0,
    companyResults,
  };
}
