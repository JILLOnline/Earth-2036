import type { EarthScoreComponent } from "./methodology";

export type RubricFactor = {
  key: string;
  label: string;
  weight: number;
  description: string;
};

export type RubricEvidenceValue = {
  value: number;
  sourceIds: readonly string[];
  note: string;
};

export type ComponentEvidence = Record<string, RubricEvidenceValue>;

const componentRubrics: Record<EarthScoreComponent, readonly RubricFactor[]> = {
  thesisQuality: [
    { key: "problemDurability", label: "Problem durability", weight: 0.25, description: "How durable and economically important is the problem being solved?" },
    { key: "productMarketFitEvidence", label: "Product-market fit", weight: 0.25, description: "Hard evidence of customer adoption, repeat demand and deployment." },
    { key: "moatDifferentiation", label: "Moat / differentiation", weight: 0.25, description: "Technical, cost, regulatory, network or scale advantage that is difficult to copy." },
    { key: "capturePath", label: "Value-capture path", weight: 0.25, description: "Clear route from structural demand to durable company economics." },
  ],
  financialOperatingMomentum: [
    { key: "revenueMomentum", label: "Revenue momentum", weight: 0.25, description: "Growth quality and direction, adjusted for cyclicality and one-offs." },
    { key: "marginCashFlow", label: "Margin / cash flow", weight: 0.25, description: "Operating leverage, margin direction and cash-generation quality." },
    { key: "backlogBookings", label: "Backlog / bookings", weight: 0.25, description: "Demand visibility supported by contracts, backlog, bookings or utilization." },
    { key: "balanceSheetExecution", label: "Balance-sheet execution", weight: 0.25, description: "Liquidity, leverage, capital efficiency and ability to fund the plan." },
  ],
  marketValuationOpportunity: [
    { key: "scenarioHeadroom", label: "Scenario headroom", weight: 0.35, description: "Upside to defensible base/bull outcomes versus downside to bear outcomes." },
    { key: "growthAdjustedValuation", label: "Growth-adjusted valuation", weight: 0.25, description: "Valuation relative to durable growth, margins and capital intensity." },
    { key: "asymmetry", label: "Asymmetry", weight: 0.25, description: "Skew of plausible outcomes after risk and dilution." },
    { key: "dilutionAdjustedValue", label: "Dilution-adjusted value", weight: 0.15, description: "Per-share value after realistic financing and share-count assumptions." },
  ],
  catalystScore: [
    { key: "materiality", label: "Catalyst materiality", weight: 0.35, description: "Potential to change intrinsic value or thesis confidence." },
    { key: "timingClarity", label: "Timing clarity", weight: 0.25, description: "How well-defined and near enough the catalyst timing is." },
    { key: "evidenceQuality", label: "Evidence quality", weight: 0.20, description: "Primary-source support that the catalyst is real and on track." },
    { key: "catalystBreadth", label: "Catalyst breadth", weight: 0.20, description: "Number of independent, non-duplicative catalysts." },
  ],
  governancePower: [
    { key: "executionHistory", label: "Execution history", weight: 0.30, description: "Management delivery versus prior commitments." },
    { key: "capitalAllocation", label: "Capital allocation", weight: 0.25, description: "Quality of investment, financing, M&A and dilution decisions." },
    { key: "alignment", label: "Alignment", weight: 0.20, description: "Owner/operator incentives, voting power and shareholder alignment." },
    { key: "operatorQuality", label: "Operator quality", weight: 0.15, description: "Technical and operating capability of key decision makers." },
    { key: "transparency", label: "Transparency", weight: 0.10, description: "Disclosure quality, consistency and willingness to quantify outcomes." },
  ],
  alignment2036: [
    { key: "humanNeedDurability", label: "Human-need durability", weight: 0.25, description: "Exposure to durable needs such as time, health, trust, energy, security or connection." },
    { key: "infrastructureCriticality", label: "Infrastructure criticality", weight: 0.25, description: "Importance to physical/digital systems required by multiple future paths." },
    { key: "technologyTailwind", label: "Technology tailwind", weight: 0.25, description: "Benefit from long-duration technological adoption rather than a short fad." },
    { key: "strategicRelevance", label: "Strategic relevance", weight: 0.25, description: "National, industrial or supply-chain strategic importance." },
  ],
  crossDivisionLeverage: [
    { key: "independentDemandEngines", label: "Independent demand engines", weight: 0.40, description: "Number and quality of independent structural themes that need the product." },
    { key: "customerDiversification", label: "Customer diversification", weight: 0.20, description: "Demand spread across distinct end markets and customers." },
    { key: "reuseAcrossMarkets", label: "Cross-market reuse", weight: 0.20, description: "Ability to reuse core IP/capability across markets without equivalent capital duplication." },
    { key: "secondOrderExposure", label: "Second-order exposure", weight: 0.20, description: "Benefits mechanically when winners elsewhere expand." },
  ],
  bottleneckControl: [
    { key: "scarcity", label: "Scarcity", weight: 0.30, description: "Evidence that capacity, material, certification or capability is constrained." },
    { key: "switchingCost", label: "Switching cost", weight: 0.25, description: "Customer cost/risk of replacing this supplier or capability." },
    { key: "capacityLeadTime", label: "Capacity lead time", weight: 0.25, description: "Time and difficulty required for the market to add competing supply." },
    { key: "constraintShare", label: "Constraint ownership", weight: 0.20, description: "How much of the actual constraint the company controls." },
  ],
  scenarioRobustness: [
    { key: "multiScenarioWins", label: "Multi-scenario wins", weight: 0.40, description: "Ability to win across materially different plausible futures." },
    { key: "downsideOptionality", label: "Downside optionality", weight: 0.20, description: "Alternative revenue/capability paths if the primary thesis weakens." },
    { key: "geographicDiversification", label: "Geographic diversification", weight: 0.20, description: "Exposure spread across jurisdictions and demand centers." },
    { key: "businessModelFlexibility", label: "Business-model flexibility", weight: 0.20, description: "Capacity to adapt pricing, product or customer mix as conditions change." },
  ],
  substitutionResilience: [
    { key: "performanceEdge", label: "Performance edge", weight: 0.30, description: "Performance advantage that matters enough to resist cheaper substitutes." },
    { key: "costCurve", label: "Cost curve", weight: 0.25, description: "Competitive cost trajectory as the market scales." },
    { key: "replacementDifficulty", label: "Replacement difficulty", weight: 0.25, description: "Qualification, integration, ecosystem or physical barriers to substitution." },
    { key: "roadmapAdaptability", label: "Roadmap adaptability", weight: 0.20, description: "Ability to adopt or own the substitute rather than be displaced by it." },
  ],
  supplyChainResilience: [
    { key: "supplierDiversification", label: "Supplier diversification", weight: 0.25, description: "Redundancy across key suppliers and inputs." },
    { key: "geographicDiversification", label: "Geographic diversification", weight: 0.25, description: "Reduced exposure to a single country or policy regime." },
    { key: "leadTimeResilience", label: "Lead-time resilience", weight: 0.20, description: "Inventory, contracts and planning against long-lead inputs." },
    { key: "verticalIntegration", label: "Vertical integration", weight: 0.15, description: "Internal control over strategically important stages." },
    { key: "recyclingSubstitution", label: "Recycling / substitution", weight: 0.15, description: "Practical paths around constrained materials or suppliers." },
  ],
  pricingPower: [
    { key: "marginEvidence", label: "Margin evidence", weight: 0.25, description: "Observed margin durability consistent with pricing power." },
    { key: "pricePassThrough", label: "Price pass-through", weight: 0.25, description: "Ability to pass input inflation to customers." },
    { key: "scarcityRent", label: "Scarcity rent", weight: 0.25, description: "Ability to capture value from a constrained product/capability." },
    { key: "contractStructure", label: "Contract structure", weight: 0.25, description: "Terms that preserve economics, indexing or recurring value." },
  ],
};

export const RISK_RUBRIC: readonly RubricFactor[] = [
  { key: "solvencyDilution", label: "Solvency / dilution", weight: 0.20, description: "Cash runway, leverage, refinancing and likely dilution." },
  { key: "customerConcentration", label: "Customer concentration", weight: 0.15, description: "Dependence on a small number of customers or counterparties." },
  { key: "regulatory", label: "Regulatory", weight: 0.15, description: "Licensing, export, approval and policy risk." },
  { key: "technology", label: "Technology", weight: 0.15, description: "Technical feasibility, obsolescence and performance risk." },
  { key: "execution", label: "Execution", weight: 0.15, description: "Schedule, manufacturing, scaling and delivery risk." },
  { key: "valuation", label: "Valuation", weight: 0.10, description: "Compression risk embedded in the current valuation." },
  { key: "governance", label: "Governance", weight: 0.10, description: "Control, disclosure, incentives and management credibility risk." },
];

export const DATA_CONFIDENCE_RUBRIC: readonly RubricFactor[] = [
  { key: "primaryCoverage", label: "Primary-source coverage", weight: 0.35, description: "Share of important claims supported by primary sources." },
  { key: "independentCorroboration", label: "Independent corroboration", weight: 0.25, description: "Independent evidence rather than repeated syndication." },
  { key: "freshness", label: "Freshness", weight: 0.20, description: "How current the evidence is for the decision being made." },
  { key: "completeness", label: "Completeness", weight: 0.20, description: "Coverage of financial, operating, governance, dependency and risk dimensions." },
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function scoreFactors(factors: readonly RubricFactor[], evidence: ComponentEvidence) {
  let total = 0;
  for (const factor of factors) {
    const entry = evidence[factor.key];
    if (!entry || !Number.isFinite(entry.value)) {
      throw new Error(`Missing rubric evidence for ${factor.key}`);
    }
    if (!entry.sourceIds.length) {
      throw new Error(`Rubric factor ${factor.key} requires at least one source id`);
    }
    total += clamp(entry.value) * factor.weight;
  }
  return Math.round(total * 100) / 100;
}

export function componentRubric(component: EarthScoreComponent) {
  return componentRubrics[component];
}

export function scoreComponent(component: EarthScoreComponent, evidence: ComponentEvidence) {
  return scoreFactors(componentRubrics[component], evidence);
}

export function scoreRisk(evidence: ComponentEvidence) {
  return scoreFactors(RISK_RUBRIC, evidence);
}

export function scoreDataConfidence(evidence: ComponentEvidence) {
  return scoreFactors(DATA_CONFIDENCE_RUBRIC, evidence);
}

export const EARTH_SCORE_RUBRICS = Object.freeze(componentRubrics);
