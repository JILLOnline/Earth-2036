import {createHash} from "node:crypto";

// Phoenix P5A is only a review queue. A newly seen SEC accession is neither
// a new filing date nor permission to re-run a worker or change packet inputs.
export const SOURCE_REVIEW_CONTRACT="earth2036-phoenix-source-change-review-v1";
const digest=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0,24);
const isSha=v=>typeof v==="string" && /^[a-f0-9]{64}$/.test(v);
const accession=v=>typeof v==="string" && /^\d{10}-\d{2}-\d{6}$/.test(v);
const ticker=v=>typeof v==="string" && /^[A-Z][A-Z0-9.-]{0,11}$/.test(v);
const validTime=v=>typeof v==="string" && Number.isFinite(Date.parse(v));

export function buildSourceChangeReview({
  sourceAudit,secContinuity,frontier,assistBus,reviewQueue,observations,sourceHoldCatalog,
  previous=null
}={}) {
  if(sourceAudit?.contract!=="earth2036-source-delta-observation-audit-v1" ||
     secContinuity?.contract!=="earth2036-sec-accession-continuity-v1" ||
     frontier?.contract!=="earth2036-closure-frontier-v1" ||
     !Array.isArray(assistBus?.requests) ||
     !Array.isArray(reviewQueue?.items) ||
     !observations || typeof observations.candidates!=="object" ||
     sourceHoldCatalog?.contract!=="earth2036-phoenix-known-write-rejections-v1" ||
     (previous && previous.contract!==SOURCE_REVIEW_CONTRACT))
    throw new Error("phoenix_source_review_inputs_invalid");
  if(!validTime(sourceAudit.generatedAt) || sourceAudit.currentCycleAt!==observations.capturedAt ||
    !validTime(observations.capturedAt))
    throw new Error("phoenix_source_review_cycle_mismatch");
  const stalled=new Map((frontier.stalled||[]).map(x=>[x.ticker,x]));
  const dormant=new Map();
  for(const r of assistBus.requests.filter(x=>x.status==="dormant_until_input_changes")) {
    if(!dormant.has(r.ticker))dormant.set(r.ticker,[]);
    dormant.get(r.ticker).push(r);
  }
  const reviewById=new Map();
  for(const item of reviewQueue.items){
    if(item?.id && !reviewById.has(item.id))reviewById.set(item.id,item);
  }
  const rows=[],seen=new Set();
  const unchangedRequests=assistBus.requests.filter(r=>r.status==="dormant_until_input_changes").length;
  const exactSafetyRequests=new Set((sourceHoldCatalog.records||[])
    .filter(x=>x.kind==="exact_request" && x.requestId)
    .map(x=>x.requestId));
  const changedArray=Array.isArray(sourceAudit.changes)?sourceAudit.changes:[];
  for(const change of changedArray) {
    if(!ticker(change?.ticker) || !Array.isArray(change.addedAccessions))throw new Error("phoenix_invalid_sec_change");
    if(!stalled.has(change.ticker) && !dormant.has(change.ticker))continue;
    const primaryObservation=observations.candidates[change.ticker];
    const validDelta=change.status==="observed_window_new_accessions" &&
      isSha(change.previousFingerprint) && isSha(change.currentFingerprint) &&
      change.previousFingerprint!==change.currentFingerprint &&
      primaryObservation?.status==="observed" &&
      primaryObservation.filingFingerprint===change.currentFingerprint;
    const continuityVerified=secContinuity.incomplete===0 &&
      secContinuity.companiesChecked===observations.companiesExpected &&
      secContinuity.continuous===observations.companiesExpected;
    for(const filing of change.addedAccessions){
      if(!accession(filing?.accessionNumber))throw new Error("phoenix_invalid_added_accession");
      const id=change.ticker+":"+filing.accessionNumber;
      if(seen.has(id))throw new Error("phoenix_duplicate_sec_change");seen.add(id);
      const queued=reviewById.get(id);
      const queueMatch=queued?.ticker===change.ticker && queued.accessionNumber===filing.accessionNumber &&
        /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(queued.sourceUrl||"");
      const sourceCandidateVerified=Boolean(validDelta && continuityVerified && queueMatch);
      const relatedRequests=dormant.get(change.ticker)||[];
      const heldRequests=relatedRequests.filter(r=>exactSafetyRequests.has(r.requestId)).map(r=>r.requestId);
      const signalId=digest({ticker:change.ticker,accession:filing.accessionNumber,
        previous:change.previousFingerprint,current:change.currentFingerprint});
      const prior=(previous?.signals||[]).find(x=>x.id===signalId);
      let status="unverified_changed_source";
      if(!sourceCandidateVerified)status="needs_sec_continuity_or_queue_verification";
      else if(heldRequests.length)status="source_review_required_with_existing_safety_hold";
      else status="source_review_required";
      rows.push({
        id:signalId,ticker:change.ticker,accessionNumber:filing.accessionNumber,
        filingForm:filing.form||null,filingDate:filing.filingDate||null,
        firstObservedAt:prior?.firstObservedAt||sourceAudit.generatedAt,
        lastObservedAt:sourceAudit.generatedAt,
        previousFingerprint:change.previousFingerprint,currentFingerprint:change.currentFingerprint,
        sourceUrl:queueMatch?queued.sourceUrl:null,
        queueStatus:queueMatch?queued.status:null,
        stalledFrontier:Boolean(stalled.has(change.ticker)),
        dormantAssistCount:relatedRequests.length,
        heldRequestIds:heldRequests,
        status,
        reviewNeeded:"independent primary source content and input materiality; newly visible accession is not proof it was newly filed",
        authorizedForAutomatedReactivation:false,
        authorizedForSafetyRejectedPayloadRetry:false,
        authorizedForChiefApproval:false,
        authorizedForCanonicalOrTickWrites:false
      });
    }
  }
  // Keep prior review candidates, even if later source-delta rolling snapshots
  // are empty. Disappearance from the current SEC window does not equal review.
  const previousById=new Map((previous?.signals||[]).map(x=>[x.id,x]));
  for(const row of rows)previousById.delete(row.id);
  const retained=[...previousById.values()].map(row=>({...row,
    status:row.status==="source_review_required"?"historical_candidate_review_unverified":row.status}));
  const signals=[...rows,...retained].sort((a,b)=>a.ticker.localeCompare(b.ticker) ||
    a.accessionNumber.localeCompare(b.accessionNumber));
  const summary={
    companiesChecked:observations.companiesExpected,
    sourceAuditChangedCount:changedArray.length,
    secContinuityComplete:secContinuity.incomplete===0,
    staleFrontierCount:stalled.size,
    dormantAssistCount:unchangedRequests,
    newReviewSignals:rows.length,
    retainedUnresolvedSignals:retained.length,
    notAutoActivated:signals.length,
  };
  return {
    contract:SOURCE_REVIEW_CONTRACT,version:1,
    mode:"source_candidate_review_only",
    observedAt:sourceAudit.generatedAt,
    authority:{automaticWorkerActivation:false,resetDormantAssist:false,
      resetFrontierStall:false,safetyRejectedWriteRetry:false,
      chiefApproval:false,scoreWrites:false,canonicalPromotion:false,qualifiedTicks:false},
    summary,signals,
    policy:"Source changes are candidates for independent review, not automatic research-queue reactivation; historical dormant state is never mass-reset on version migration."
  };
}
