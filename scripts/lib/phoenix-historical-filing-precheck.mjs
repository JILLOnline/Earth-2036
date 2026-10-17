// Phoenix P7B — pure, noncanonical historical availability gate.
// This module never reads a network source or authorizes canonical evidence.
export const HISTORICAL_T0_CUTOFF = "2026-09-12T23:59:59-04:00";
const isoWithZone = s => typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s) &&
  Number.isFinite(Date.parse(s));
const accn = s => typeof s === "string" && /^\d{10}-\d{2}-\d{6}$/.test(s);
export function assessHistoricalFiling({ticker,cik,fact,filing,sourceBytesVerified=false,
  archiveVerified=false,cutoff=HISTORICAL_T0_CUTOFF}={}) {
  if(cutoff!==HISTORICAL_T0_CUTOFF) throw new Error("historical_t0_cutoff_immutable");
  const failures=[];
  if(!["AEVA","SWKS"].includes(ticker)) failures.push("pilot_ticker_out_of_scope");
  const expectedCik={AEVA:"0001789029",SWKS:"0000004127"}[ticker];
  if(!expectedCik || cik!==expectedCik || filing?.cik!==expectedCik)
    failures.push("cik_identity_unverified");
  if(!accn(fact?.accn)||fact.accn!==filing?.accessionNumber)
    failures.push("accession_crosscheck_unverified");
  if(!sourceBytesVerified || !archiveVerified)
    failures.push("original_bytes_and_archive_not_authenticated");
  if(!isoWithZone(filing?.acceptedAt))
    failures.push("sec_acceptance_timestamp_unverified");
  else if(Date.parse(filing.acceptedAt)>Date.parse(cutoff))
    failures.push("sec_filing_accepted_after_cutoff");
  if(!isoWithZone(filing?.publiclyAvailableAt))
    failures.push("public_availability_timestamp_unverified");
  else if(Date.parse(filing.publiclyAvailableAt)>Date.parse(cutoff))
    failures.push("public_availability_after_cutoff");
  if(typeof fact?.filed!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(fact.filed))
    failures.push("fact_filing_date_unverified");
  else if(fact.filed>cutoff.slice(0,10))
    failures.push("fact_filed_after_cutoff");
  if(filing?.amendmentAndSupersessionReviewed!==true)
    failures.push("amendment_supersession_not_reviewed");
  if(filing?.sourceAccessionAuthenticated!==true)
    failures.push("filing_accession_not_authenticated");
  // Evidence admission additionally requires the separate Methodology source lane.
  return {ticker,accessionNumber:fact?.accn??null,cutoff,
    temporalAndSourcePrecheckPassed:failures.length===0,failures,
    historicalT0EvidenceAdmitted:false,methodologyFactorSatisfied:false,
    chiefApprovalAuthorized:false,canonicalPromotionAuthorized:false,
    workerRestartAuthorized:false,sourceWriteAuthorized:false};
}
