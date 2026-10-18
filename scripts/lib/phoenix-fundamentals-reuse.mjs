import {verifyBridgeIndex} from "./fundamentals-bridge-index.mjs";

export const REUSE_CONTRACT="earth2036-phoenix-fundamentals-reuse-inventory-v1";
export const FROZEN_HISTORICAL_T0_CUTOFF="2026-09-12T23:59:59-04:00";
const hash=value=>typeof value==="string" && /^[a-f0-9]{64}$/.test(value);
const validTime=value=>typeof value==="string" && Number.isFinite(Date.parse(value));
const safeTicker=value=>typeof value==="string" && /^[A-Z][A-Z0-9.-]{0,11}$/.test(value);

/**
 * P7A: inventories pre-existing SEC source *references*; does not ingest,
 * reconstruct, approve, or score source content. The archive as-of time is
 * different from the official historical T0 evidence-window cutoff.
 */
export function assessFundamentalsReuse({index,health,observations,frontier,baseline,systemState}={}) {
  const cutoff=baseline?.evidenceWindowEnd;
  if(index?.contract!=="earth2036-fundamentals-bridge-index-v1" ||
     index.system!=="shadow" || index.mode!=="live-shadow" ||
     index.canonicalWriteAuthority!==false || index.trialEligible!==false ||
     health?.contract!=="earth2036-fundamentals-bridge-health-v1" ||
     health.status!=="live-bootstrap-verified" || health.system!=="shadow" ||
     health.canonicalWriteAuthority!==false || health.projectionAuthority!==0 ||
     health.canonicalWrites!==0 || health.invalid!==0 ||
     !hash(health.archiveSha256) || !health.durableArchive ||
     !Array.isArray(health.companyDetails) ||
     !index.entries || !observations?.candidates ||
     frontier?.contract!=="earth2036-closure-frontier-v1" ||
     !Array.isArray(frontier.candidates) ||
     !String(baseline?.baselineId||"").startsWith("earth2036-official-t0-") ||
     baseline.status!=="in_progress" || baseline.trialEligible!==false ||
     cutoff!==FROZEN_HISTORICAL_T0_CUTOFF || !validTime(index.asOf) ||
     health.asOf!==index.asOf || !validTime(observations.capturedAt) ||
     !validTime(systemState?.lastCycleAt) ||
     observations.capturedAt!==systemState.lastCycleAt ||
     Date.parse(observations.capturedAt)<Date.parse(index.asOf) ||
     Date.parse(index.asOf)<=Date.parse(cutoff))
    throw new Error("phoenix_p7a_source_or_historical_cutoff_unverified");

  if(health.companies!==observations.companiesExpected ||
     health.valid+health.unknown!==health.companies ||
     health.companyDetails.length!==health.companies ||
     Object.keys(index.entries).length!==health.companies)
    throw new Error("phoenix_p7a_live_bridge_coverage_inconsistent");

  const seen=new Set(),details=new Map();
  for(const detail of health.companyDetails){
    if(!safeTicker(detail?.ticker)||seen.has(detail.ticker))
      throw new Error("phoenix_p7a_duplicate_or_bad_source_identity");
    seen.add(detail.ticker);details.set(detail.ticker,detail);
  }
  const candidates=frontier.candidates;
  const frontierTickers=candidates.map(c=>c.ticker);
  if(new Set(frontierTickers).size!==frontierTickers.length ||
     frontierTickers.some(x=>!safeTicker(x) || !observations.candidates[x]))
    throw new Error("phoenix_p7a_invalid_frontier_identity");

  // Actual current index hash and each descriptor are verified by the
  // pre-existing #11 validator, not trusted on displayed status alone.
  const verified=verifyBridgeIndex(index,{
    asOf:index.asOf,observations:observations.candidates,tickers:frontierTickers
  });
  const rows=candidates.map(item=>{
    const entry=index.entries[item.ticker];
    const ref=verified[item.ticker]?.reference;
    const original=entry?.reference;
    const h=details.get(item.ticker);
    const integrityVerified=Boolean(ref?.status==="valid" && original?.status==="valid" &&
      h?.status==="valid" && hash(ref.truthHash) &&
      hash(ref.rawFactsHash) && hash(ref.sourcePayloadHash) &&
      ref.truthHash===h.truthHash && ref.rawFactsHash===h.rawFactsHash &&
      ref.sourcePayloadHash===h.sourcePayloadHash &&
      ref.cik===observations.candidates[item.ticker]?.cik &&
      ref.asOf===index.asOf &&
      ref.reconstructionContract?.cutoff===index.asOf &&
      ref.reconstructionContract?.expectedTruthHash===ref.truthHash &&
      ref.reconstructionContract?.expectedRawFactsHash===ref.rawFactsHash &&
      ref.reconstructionContract?.expectedSourcePayloadHash===ref.sourcePayloadHash);
    const facts=integrityVerified?ref.rawFactCount:null;
    const projection=verified[item.ticker]?.auditProjection;
    return{
      ticker:item.ticker,workId:item.workId||null,
      state:item.state,frontierSelected:item.selected===true,
      executionGuard:item.executionGuard||null,
      namedUnresolvedFailures:Array.isArray(item.failures)?item.failures:[],
      liveReferenceVerified:integrityVerified,
      liveArchiveHashed:Boolean(integrityVerified&&hash(health.archiveSha256)),
      existingFactEntries:facts,
      namedMetricsObserved:integrityVerified?projection?.observedNamedMetrics??null:null,
      namedMetricsMissing:integrityVerified?projection?.missingNamedMetrics??null:null,
      sourceInventoryStatus:integrityVerified?
        "live_archive_reference_verified_historical_t0_unchecked":
        "source_reference_integrity_review_required",
      historicalT0FactEligibility:"not_reconstructed_or_attested",
      sourceBytesIndependentlyRead:false,
      researchOrWorkerClearance:false,
      scoreRecordAuthorized:false,chiefApprovalAuthorized:false,
      canonicalPromotionAuthorized:false,qualifiedTickAuthorized:false,
      nextStep:"Independently reconstruct archived SEC source facts as of the exact T0 evidence-window cutoff, check individual filing/acceptance dates and original records, then map specific facts to unresolved Methodology 1.0 leaves. Preserve source-write safety holds."
    };
  });
  const verifiedRows=rows.filter(r=>r.liveReferenceVerified);
  return{
    contract:REUSE_CONTRACT,version:1,mode:"noncanonical_read_only_source_reference_inventory",
    asOf:index.asOf,sourceCycle:index.asOf,runtimeCycle:systemState.lastCycleAt,
    sourceStaleRelativeToRuntime:systemState.lastCycleAt!==index.asOf,
    historicalEvidenceWindowEnd:cutoff,
    archiveTag:health.archiveTag,archiveSha256:health.archiveSha256,
    summary:{
      totalLiveArchiveCompanies:health.companies,
      verifiedLiveArchiveCompanies:health.valid,
      totalT0BacklogCandidates:rows.length,
      frontierSelected:rows.filter(r=>r.frontierSelected).length,
      liveSourceReferencesVerified:verifiedRows.length,
      referencesNeedingIntegrityReview:rows.length-verifiedRows.length,
      rawFactEntriesReferencedForBacklog:verifiedRows.reduce((n,r)=>n+r.existingFactEntries,0),
      historicalT0EvidenceAdmitted:0,
      realResearchFailuresClosed:0,
      researchWorkersReactivated:0
    },
    authority:{
      originalFileBytesAuthenticatedByThisAudit:false,
      pointInTimeReconstructionPerformed:false,
      sourceWriteAuthorization:false,
      workerRestart:false,
      rejectedPayloadRetry:false,
      methodologyScoring:false,
      chiefAdjudication:false,canonicalWrite:false,tickQualification:false
    },
    rows
  };
}
