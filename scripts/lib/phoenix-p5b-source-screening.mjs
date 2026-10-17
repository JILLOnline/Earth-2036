import {createHash} from "node:crypto";

export const P5B_SCREENING_CONTRACT="earth2036-phoenix-p5b-primary-source-screening-v1";
export const P5B_RESULT_CONTRACT="earth2036-phoenix-p5b-source-triage-report-v1";
const exactTicker=value=>typeof value==="string" && /^[A-Z][A-Z0-9.-]{0,11}$/.test(value);
const exactAccession=value=>typeof value==="string" && /^\d{10}-\d{2}-\d{6}$/.test(value);
const exactDate=value=>typeof value==="string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
const fingerprint=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0,24);
const secUrl=(record)=>{
  if(!exactAccession(record.accessionNumber) || !/^\d{10}$/.test(record.cik||""))return false;
  const canonical="https://www.sec.gov/Archives/edgar/data/"+
    String(BigInt(record.cik))+"/"+record.accessionNumber.replaceAll("-")+"/";
  try{
    const u=new URL(record.primaryDocumentUrl);
    return u.protocol==="https:" && u.hostname==="www.sec.gov" &&
      u.username==="" && u.password==="" && u.search==="" && u.hash==="" &&
      u.href.startsWith(canonical) && !u.pathname.includes("..") &&
      /^[a-zA-Z0-9_.-]+\.htm[l]?$/.test(u.pathname.split("/").at(-1));
  }catch{return false;}
};

export function screenPrimarySources({
  screening,packets,observations,reviewQueue,sourceHoldCatalog,existingSourcesByTicker={}
}={}){
  if(screening?.contract!==P5B_SCREENING_CONTRACT || screening.version!==1 ||
    !Array.isArray(screening.records) || screening.records.length>6 ||
    screening?.cutoffPolicy?.phase!=="official_t0_baseline" ||
    !exactDate(screening?.cutoffPolicy?.t0EvidenceCutoff) ||
    screening?.cutoffPolicy?.reopeningHistoricalT0OnPostCutoffInformation!==false ||
    !packets || !observations?.candidates || !Array.isArray(reviewQueue?.items) ||
    sourceHoldCatalog?.contract!=="earth2036-phoenix-known-write-rejections-v1")
    throw new Error("phoenix_p5b_inputs_invalid");
  const packetByTicker=new Map(packets.map(p=>[p.ticker,p]));
  const queueById=new Map(reviewQueue.items.map(q=>[q.id,q]));
  const holds=sourceHoldCatalog.records||[];
  const seen=new Set();
  const rows=[];
  for(const c of screening.records){
    const checks={
      ticker:exactTicker(c?.ticker),
      accession:exactAccession(c?.accessionNumber),
      cik:/^\d{10}$/.test(c?.cik||""),
      filingDate:exactDate(c?.filingDate),
      secUrl:secUrl(c),
      form:["10-Q","8-K"].includes(c?.form),
      owner:["council-alpha","earth-scout","council-beta","deep-resolver"].includes(c?.owner),
      gateFailures:Array.isArray(c?.targetedWorkgraphFailures) && c.targetedWorkgraphFailures.length>0,
      facts:Array.isArray(c?.observedPrimaryDocumentFacts) && c.observedPrimaryDocumentFacts.length>0,
      limitations:typeof c?.existingResearchDoesNotProve==="string" && c.existingResearchDoesNotProve.length>=30,
      reviewDecision:["screen_for_lawful_source_acquisition_only","exclude_for_this_gate_without_changing_other_research"].includes(c?.reviewDecision),
    };
    const invalid=Object.keys(checks).filter(k=>!checks[k]);
    if(invalid.length){
      let diagnosis="";
      if(invalid.includes("secUrl")){
        try{
          const u=new URL(c.primaryDocumentUrl);
          const pathPrefix="https://www.sec.gov/Archives/edgar/data/"+
            String(BigInt(c.cik))+"/"+c.accessionNumber.replaceAll("-")+"/";
          diagnosis=":sec_url_components="+JSON.stringify({
            protocol:u.protocol==="https:",host:u.hostname==="www.sec.gov",
            credentials:u.username===""&&u.password==="",search:u.search==="",hash:u.hash==="",
            prefix:u.href.startsWith(pathPrefix),expected:pathPrefix,actual:u.href,basenameText:u.pathname.split("/").at(-1),traversal:!u.pathname.includes(".."),
            basename:/^[a-zA-Z0-9_.-]+\\.htm[l]?$/.test(u.pathname.split("/").at(-1))
          });
        }catch(e){diagnosis=":sec_url_exception="+String(e.name);}
      }
      throw new Error("phoenix_p5b_invalid_source_record:"+invalid.join(",")+diagnosis);
    }
    const key=c.ticker+":"+c.accessionNumber;
    if(seen.has(key))throw new Error("phoenix_p5b_duplicate_screening");
    seen.add(key);
    const packet=packetByTicker.get(c.ticker);
    const observed=observations.candidates[c.ticker];
    if(!packet || packet.workId!==c.workId || observed?.cik!==c.cik ||
      packet.preflight?.passed===true)
      throw new Error("phoenix_p5b_packet_identity_or_state_mismatch");
    const missing=packet.preflight?.failures||[];
    if(c.targetedWorkgraphFailures.some(f=>!missing.includes(f)))
      throw new Error("phoenix_p5b_review_targets_nonexistent_gate");
    const newToExactSources=!(existingSourcesByTicker[c.ticker]||[])
      .some(v=>v===c.primaryDocumentUrl);
    const matchingQueue=queueById.get(key);
    // Older pre-cutoff primary filings are often absent from today's rolling
    // new-filings queue. Do NOT fabricate a queue hit or treat absence as invalidity.
    const queueObserved=matchingQueue?.ticker===c.ticker &&
      matchingQueue?.accessionNumber===c.accessionNumber &&
      matchingQueue?.sourceUrl===c.primaryDocumentUrl;
    const afterCutoff=c.filingDate>screening.cutoffPolicy.t0EvidenceCutoff;
    const isExcluded=c.reviewDecision==="exclude_for_this_gate_without_changing_other_research";
    const matchingSafetyHolds=holds.filter(x=>x.kind==="exact_request" && x.ticker===c.ticker)
      .map(x=>x.requestId);
    let stage;
    if(isExcluded)stage="screened_out_for_named_gate";
    else if(afterCutoff)stage="outside_historical_t0_cutoff";
    else if(!newToExactSources)stage="already_in_exact_source_lineage_no_duplicate_work";
    else stage="awaiting_original_sec_bytes_and_independent_materiality_review";
    // These are self-declared web-visible screening notes, NOT true SEC-byte
    // attestations, worker clearance, or authorization to reopen an old signature.
    if(c.rawSourceBytesAuthenticated===true || c.independentMaterialityApproved===true ||
      c.workerDisableCauseVerified===true || c.originalSECBytesSha256)
      throw new Error("phoenix_p5b_uncommissioned_authentication_or_clearance_claim");
    const row={
      id:fingerprint({ticker:c.ticker,accession:c.accessionNumber,stage,
        target:c.targetedWorkgraphFailures}),
      ticker:c.ticker,workId:c.workId,owner:c.owner,accessionNumber:c.accessionNumber,
      form:c.form,filingDate:c.filingDate,primaryDocumentUrl:c.primaryDocumentUrl,
      targetGateFailures:c.targetedWorkgraphFailures,
      status:stage,secQueuedMatch:queueObserved,
      exactSourceAlreadyInPacketEvidence:!newToExactSources,
      afterT0Cutoff:afterCutoff,sourceScreeningOnly:true,
      exactSafetyHeldRequests:matchingSafetyHolds,
      originalSECBytesAuthenticated:false,
      sourceMaterialityIndependentlyApproved:false,
      workerAvailabilityAuthenticated:false,
      handoffAuthorized:false,automaticWorkerRestart:false,
      previousPacketInputStillAuthoritative:true,
      nextLawfulAction:isExcluded?
        "Retain the documented negative relevance finding; do not close the named T0 gate":
        afterCutoff?"Keep outside the September 12 T0 historical source window":
        !newToExactSources?"Avoid duplicate source work; inspect the existing packet's actual remaining unsupported Methodology leaves":
        "Independently authenticate the exact original SEC filing bytes and map specific facts to a named Methodology 1.0 gap; separately verify worker disable/clearance before any authorized handoff"
    };
    rows.push(row);
  }
  return{
    contract:P5B_RESULT_CONTRACT,version:1,
    mode:"noncanonical_source_relevance_screening",
    screenedCount:rows.length,
    potentialSourceReviewCount:rows.filter(x=>x.status==="awaiting_original_sec_bytes_and_independent_materiality_review").length,
    blockedOrExcludedCount:rows.filter(x=>x.status!=="awaiting_original_sec_bytes_and_independent_materiality_review").length,
    authorizedHandoffs:0,
    canonicalMutations:0,
    workerRestarts:0,
    authority:{dormantQueueReset:false,sourceDisposition:false,workerExecution:false,
      safetyRejectedWriteRetry:false,chiefSignature:false,scoreWrites:false,
      historicalT0Reopening:false,tickQualification:false},
    records:rows,
    governance:"Do not treat an SEC page excerpt, self-declared GitHub review, source URL or unverified paused-worker status as authenticated evidence or execution clearance."
  };
}
