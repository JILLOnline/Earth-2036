// Noncanonical two-clock SEC review audit. Distinguishes immutable historical
// T0 cutoff from rolling live SEC observations; never waives a review gate.
export const CONTRACT = "earth2036-t0-evidence-dual-clock-audit-v1";
const ISO_DAY=/^\d{4}-\d{2}-\d{2}$/;
const REVIEW_OPEN=new Set(["pending","open","unresolved"]);
function cutoffDay(raw){
  if(typeof raw!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(raw)||!Number.isFinite(Date.parse(raw)))throw new Error("invalid_historical_t0_cutoff");
  // Compare stated filing calendar dates to the *explicit source cutoff's*
  // local date, not today's UTC date or implicit machine timezone.
  return raw.slice(0,10);
}
function filingDay(v){
  if(typeof v!=="string"||!ISO_DAY.test(v))throw new Error("invalid_filing_date");
  const parsed=Date.parse(v+"T00:00:00Z");
  if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==v)
    throw new Error("invalid_filing_date");
  return v;
}
const mapSorted=map=>Object.fromEntries([...map].sort((a,b)=>a[0].localeCompare(b[0])));
const increase=(map,key)=>map.set(key,(map.get(key)||0)+1);
export function auditT0EvidenceClocks({manifest,queue,qualification,frontier}){
  const day=cutoffDay(manifest?.evidenceWindowEnd);
  if(manifest?.methodologyVersion!=="1.0.0"||manifest?.expectedCompanies!==250||manifest?.published===true)
    throw new Error("historical_t0_manifest_not_in_progress");
  if(!Array.isArray(queue?.items)||!Number.isSafeInteger(queue?.unresolved)||queue.unresolved<0)
    throw new Error("missing_or_invalid_sec_evidence_queue");
  if(qualification?.contract!=="earth2036-evidence-qualification-v1")throw new Error("missing_formal_review_contract");
  const selected=(frontier?.selected||[]).map(x=>x?.ticker).filter(Boolean);
  const priority=new Set(selected);
  const seen=new Set(), forms=new Map(), days=new Map(), frontierRows=[];
  let postCutoff=0, preOrSameDay=0, pending=0, reviewed=0;
  for(const item of queue.items){
    if(typeof item?.id!=="string"||!item.id||seen.has(item.id)||item.id!==item.ticker+":"+item.accessionNumber)
      throw new Error("invalid_or_duplicate_evidence_queue_identity");
    seen.add(item.id);
    if(!REVIEW_OPEN.has(item.status)&&item.status!=="resolved")throw new Error("unsupported_queue_status");
    const filingDate=filingDay(item.filingDate);
    let url;
    try { url=new URL(item.sourceUrl); } catch { throw new Error("untrusted_sec_source_url"); }
    if(url.protocol!=="https:"||url.hostname!=="www.sec.gov"||url.username||url.password)
      throw new Error("untrusted_sec_source_url");
    const after=filingDate>day;
    if(after)postCutoff++;else preOrSameDay++;
    if(REVIEW_OPEN.has(item.status))pending++;else reviewed++;
    increase(forms,String(item.form||"unknown"));increase(days,filingDate);
    if(priority.has(item.ticker))frontierRows.push({
      ticker:item.ticker,itemId:item.id,filingDate,form:item.form,
      sourceUrl:item.sourceUrl,clock:after?"after_historical_t0_cutoff":"at_or_before_cutoff_date_unverified",
      sourceAdmissibility:"not_authenticated",reviewStatus:item.status
    });
  }
  if(queue.unresolved!==pending)throw new Error("raw_queue_unresolved_mismatch");
  if(qualification.totalFilings!==queue.items.length||qualification.rawPending!==pending||
     qualification.pendingUnreviewed+qualification.reviewedMaterialOpen+qualification.reviewedNonGating+qualification.reviewedResolved!==queue.items.length)
    throw new Error("formal_review_counter_mismatch");
  if(qualification.unresolvedMaterialOrUnreviewed!==qualification.pendingUnreviewed+qualification.reviewedMaterialOpen)
    throw new Error("formal_review_gate_counter_mismatch");
  frontierRows.sort((a,b)=>a.ticker.localeCompare(b.ticker)||a.itemId.localeCompare(b.itemId));
  return {
    contract:CONTRACT,authority:{readOnly:true,sourceAdmission:false,dispositionWrite:false,
      automaticClearance:false,t0GateChange:false,canonicalPromotion:false,
      workerRestart:false,tickQualification:false},
    historicalCutoff:manifest.evidenceWindowEnd,cutoffCalendarDay:day,
    totalItems:queue.items.length,
    clocks:{
      definitivelyFiledAfterT0:postCutoff,
      filedOnOrBeforeCutoffDayButStillUnverified:preOrSameDay,
      historicalEvidenceAutomaticallyAdmitted:0,
      currentRawUnresolved:pending,
      formalUnreviewed:qualification.pendingUnreviewed,
      formalOpenMaterial:qualification.reviewedMaterialOpen,
      formalGatePassed:qualification.gatePassed
    },
    frontier:{selectedTickers:[...new Set(selected)].sort(),postCutoffSelectedFilings:frontierRows.filter(x=>x.clock==="after_historical_t0_cutoff").length,
      originalSecSourceAddressedButUnreviewed:frontierRows},
    byForm:mapSorted(forms),byFilingDay:mapSorted(days),
    governanceDecisionRequired:postCutoff>0?"Live post-cutoff SEC filings currently participate in the global T0 qualification gate; independent Methodology/Chief approval is needed before any historical-vs-live gate-scoping change. Later filings remain subject to explicit source-hashed review, not date-based exemption.":null,
    rule:"A filing date is not proof of first-public availability at the historical cutoff. Never automatically admit earlier filings or exempt later filings from the existing live review gate."
  };
}
