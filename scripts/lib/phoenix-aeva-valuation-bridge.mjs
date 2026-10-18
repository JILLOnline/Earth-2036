// Phoenix P7G: transparent, noncanonical AEVA valuation-capital structure
// sensitivity. This module is NOT an Earth Score or source admission authority.
import {HISTORICAL_T0_CUTOFF} from "./phoenix-historical-filing-precheck.mjs";
export const AEVA_SOURCE_2026_Q2=Object.freeze({
 ticker:"AEVA",cik:"0001789029",form:"10-Q",
 accession:"0001193125-26-338179",filingDate:"2026-08-06",
 sourceUrl:"https://www.sec.gov/Archives/edgar/data/1789029/000119312526338179/aeva-20260630.htm",
 primarySha256:"50a50d985259e53b3aa25eddcdc0fa1a654d724d8c079d7030261a43de7b0b35",
 coverShares:{asOf:"2026-07-30",count:69705758},
 basicJuneShares:{asOf:"2026-06-30",count:68683000,precision:"financial statement reported in thousands"},
 financialAsOf:"2026-06-30",
 cashAndCashEquivalentsUSD:43235000,
 marketableSecuritiesUSD:134654000,
 convertibleNotePrincipalUSD:100000000,
 convertibleNoteCarryingUSD:96896000,
 convertibleNoteFairValueUSD:192843000,
 convertiblePotentialShares:6303480,
 warrantExercisePriceUSD:5,
 warrantsSeriesAShares:3000000,
 warrantLiabilityFairValueUSD:73961000,
 employeeOptionPotentialShares:2303765,
 employeeRSUPotentialShares:7286827,
 employeePerformanceRSUPotentialShares:1695156,
 excludedFromEpsPotentialShares:20589228
});
export const AEVA_LAST_T0_SESSION_PRICE_CANDIDATE=Object.freeze({
 quoteDate:"2026-09-11",closeUSD:15.52,exchange:"NASDAQ",currency:"USD",
 authority:"independent_retail_history_candidate_NOT_primary_exchange_tape",
 urls:[
  "https://stockanalysis.com/stocks/aeva/history/",
  "https://ca.finance.yahoo.com/quote/AEVA/history/"
 ],
 splitAdjustmentVerified:false,pointInTimeProvenanceVerified:false
});
const fixed=(n,precision=2)=>Number(n.toFixed(precision));
const whole=n=>Number.isSafeInteger(n)&&n>=0;
const anchoredMoney=n=>Number.isFinite(n)&&n>=0;
export function buildAevaValuationBridge({
 source=AEVA_SOURCE_2026_Q2,
 quote=AEVA_LAST_T0_SESSION_PRICE_CANDIDATE,
 cutoff=HISTORICAL_T0_CUTOFF
}={}){
 if(cutoff!==HISTORICAL_T0_CUTOFF)throw Error("historical_t0_cutoff_immutable");
 if(source.ticker!=="AEVA"||source.cik!=="0001789029"||
    source.accession!=="0001193125-26-338179"||
    source.primarySha256!==AEVA_SOURCE_2026_Q2.primarySha256)
  throw Error("untrusted_aeva_issuer_or_filing_identity");
 if(source.financialAsOf>"2026-09-12"||source.coverShares?.asOf>"2026-09-12"||
    quote?.quoteDate!=="2026-09-11"||quote.exchange!=="NASDAQ"||quote.currency!=="USD")
  throw Error("invalid_historical_asof_or_quote_identity");
 if(!whole(source.coverShares.count)||!whole(source.convertiblePotentialShares)||
    !whole(source.warrantsSeriesAShares)||!whole(source.excludedFromEpsPotentialShares)||
    !whole(source.employeeOptionPotentialShares)||!whole(source.employeeRSUPotentialShares)||
    !whole(source.employeePerformanceRSUPotentialShares) ||
    !anchoredMoney(source.cashAndCashEquivalentsUSD)||
    !anchoredMoney(source.marketableSecuritiesUSD)||
    !anchoredMoney(source.convertibleNotePrincipalUSD)||
    !anchoredMoney(source.convertibleNoteFairValueUSD)||
    !anchoredMoney(source.convertibleNoteCarryingUSD)||
    !anchoredMoney(source.warrantLiabilityFairValueUSD)||
    !anchoredMoney(source.warrantExercisePriceUSD)||
    !anchoredMoney(quote.closeUSD) || quote.closeUSD===0)
  throw Error("invalid_valuation_reconciliation_input");
 const employeePotential=source.employeeOptionPotentialShares+
  source.employeeRSUPotentialShares+source.employeePerformanceRSUPotentialShares;
 const reconstructedExcluded=employeePotential+source.convertiblePotentialShares+source.warrantsSeriesAShares;
 if(reconstructedExcluded!==source.excludedFromEpsPotentialShares)
  throw Error("eps_potential_share_components_do_not_reconcile");
 const liquid=source.cashAndCashEquivalentsUSD+source.marketableSecuritiesUSD;
 const cases=[];
 // Alternative, MUTUALLY EXCLUSIVE settlement paths. Cash, stock and debt
 // treatment must change together, preventing double-counting convertible debt.
 for(const note of ["principal_outstanding","hypothetical_as_converted"]){
  for(const warrant of ["unexercised","hypothetical_fully_exercised"]){
   const converted=note==="hypothetical_as_converted";
   const exercised=warrant==="hypothetical_fully_exercised";
   const shares=source.coverShares.count+
    (converted?source.convertiblePotentialShares:0)+
    (exercised?source.warrantsSeriesAShares:0);
   const warrantProceeds=exercised?
    source.warrantsSeriesAShares*source.warrantExercisePriceUSD:0;
   const hypotheticalEquityUSD=shares*quote.closeUSD;
   const debtPrincipalRetained=converted?0:source.convertibleNotePrincipalUSD;
   const netLiquidityReference=liquid+warrantProceeds;
   const unconstrainedEVReference=hypotheticalEquityUSD+
    debtPrincipalRetained-netLiquidityReference;
   cases.push({
    noteSettlement:note,warrantSettlement:warrant,
    assumedCommonShares:shares,
    staticPriceUSD:quote.closeUSD,
    hypotheticalEquityUSD:fixed(hypotheticalEquityUSD),
    convertibleNotePrincipalRetainedUSD:debtPrincipalRetained,
    hypotheticalWarrantProceedsUSD:warrantProceeds,
    juneEndLiquidityPlusHypotheticalProceedsUSD:netLiquidityReference,
    mixedDateUnadjustedEVReferenceUSD:fixed(unconstrainedEVReference),
    currentAsOfCutoffEnterpriseValueValidated:false
   });
  }
 }
 return {
  contract:"earth2036-phoenix-p7g-aeva-valuation-bridge-v1",
  ticker:"AEVA",cutoff,mode:"research_only_noncanonical",
  source:{form:source.form,accession:source.accession,filingDate:source.filingDate,
   url:source.sourceUrl,primarySha256:source.primarySha256,
   financialAsOf:source.financialAsOf,coverSharesAsOf:source.coverShares.asOf},
  marketPriceCandidate:{...quote},
  reconciliation:{
   juneEndLiquidityUSD:liquid,
   notePrincipalUSD:source.convertibleNotePrincipalUSD,
   noteCarryingUSD:source.convertibleNoteCarryingUSD,
   noteDisclosedFairValueUSD:source.convertibleNoteFairValueUSD,
   warrantDisclosedFairValueUSD:source.warrantLiabilityFairValueUSD,
   potentialSharesExcludedFromEps:source.excludedFromEpsPotentialShares,
   potentialShareComponentsReconcile:true,
   employeeAndEquityAwardsPotentialShares:employeePotential,
   convertiblePotentialShares:source.convertiblePotentialShares,
   seriesAWarrantPotentialShares:source.warrantsSeriesAShares
  },
  mutuallyExclusiveSettlementScenarios:cases,
  limitations:[
   "September 11 quote is secondary-source candidate, not authenticated primary exchange tape",
   "July 30 cover share count and June 30 financials are not September 12 verified outstanding shares and balance sheet",
   "Dilution scenarios assume 100 percent settlements hypothetically; conversion terms, strike/treasury method and corporate action adjustments not validated",
   "Convertible debt principal, carrying amount, modeled fair value, and warrant liability fair value are different measures: never add all together",
   "June 30 liabilities/liquidity must not be double counted with hypothetical note conversion or warrant proceeds",
   "Employee options and awards omitted from settlement scenarios; no fully diluted September market cap established",
   "No source-admissible forward economics/valuation benchmark for Methodology 1.0"
  ],
  historicalT0EvidenceAdmitted:0,
  marketValuationOpportunity:null,
  numericalEarthScore:null,
  candidateFactorsQualified:0,
  firstPublicAvailabilityAuthenticated:false,
  stockExchangePriceTapeAuthenticated:false,
  SeptemberCapitalizationAuthenticated:false,
  methodologyFactorSatisfied:false,
  chiefReadyAuthorized:false,canonicalPromotionAuthorized:false,
  workerRestartAuthorized:false,canonicalWriteAuthority:false
 };
}
