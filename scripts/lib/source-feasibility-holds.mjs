// Noncanonical, source-anchored holds. Stops repeated routing into evidence dead ends
// without modifying any canonical evidence or changing scoring / promotion gates.
export const HISTORICAL_T0_CUTOFF="2026-09-12T23:59:59-04:00";
const CONTRACT="earth2036-source-feasibility-holds-v1";
const STATUS="awaiting_unavailable_historical_primary";

export function parseSourceFeasibilityHolds(document){
 if(!document || document.version!==1 || document.contract!==CONTRACT ||
    document.authority!=="noncanonical_routing_only" ||
    document.cutoff!==HISTORICAL_T0_CUTOFF ||
    !Array.isArray(document.holds) || document.holds.length>250)
  throw Error("source_feasibility_policy_invalid");
 const out=new Map();
 for(const h of document.holds){
  if(!h || !/^[A-Z][A-Z0-9.-]{0,9}$/.test(h.ticker??"") ||
   out.has(h.ticker) || h.status!==STATUS ||
   !Array.isArray(h.triggerFailures) ||h.triggerFailures.length<1||
   h.triggerFailures.length>12||
   h.triggerFailures.some(x=>typeof x!=="string"||!/^[-_a-z0-9:]+$/.test(x))||
   typeof h.requiredEvidence!=="string"||h.requiredEvidence.length<50||
   typeof h.reviewBasis!=="string"||h.reviewBasis.length<40||
   !Array.isArray(h.sourceReferences)||h.sourceReferences.length<1||
   h.sourceReferences.length>10||
   h.sourceReferences.some(x=>typeof x!=="string"||!x.startsWith("https://")||x.length>1024)||
   !Number.isFinite(Date.parse(h.reviewedAt))||
   !Array.isArray(h.baselineSourceIds) || !Array.isArray(h.baselineUniqueOrigins) ||
   h.baselineSourceIds.length<1 ||h.baselineUniqueOrigins.length<1||
   h.baselineSourceIds.length>250||h.baselineUniqueOrigins.length>250||
   h.baselineSourceIds.some(x=>typeof x!=="string"||!x.trim())||
   h.baselineUniqueOrigins.some(x=>typeof x!=="string"||!x.trim())||
   new Set(h.baselineSourceIds).size!==h.baselineSourceIds.length||
   new Set(h.baselineUniqueOrigins).size!==h.baselineUniqueOrigins.length||
   !h.unblockRule?.includes("preflight"))
    throw Error("source_feasibility_hold_invalid:"+String(h?.ticker??"unknown"));
  out.set(h.ticker,Object.freeze({
   ticker:h.ticker,status:STATUS,
   triggerFailures:Object.freeze([...h.triggerFailures]),
   requiredEvidence:h.requiredEvidence,
   sourceReferences:Object.freeze([...h.sourceReferences]),
   reviewedAt:h.reviewedAt,
   baselineSourceIds:Object.freeze([...h.baselineSourceIds]),
   baselineUniqueOrigins:Object.freeze([...h.baselineUniqueOrigins]),
   unblockRule:h.unblockRule
  }));
 }
 return out;
}

// Reopen RESEARCH REVIEW only when the source landscape materially changes.
// A filename / new worker receipt alone does not qualify, and post-cutoff
// sources are never allowed to release a frozen historical review.
function timeEligibleForHistoricalReview(value){
 if(typeof value!=="string")return false;
 if(/^\\d{4}-\\d{2}-\\d{2}$/.test(value))
  return value<"2026-09-12" && Number.isFinite(Date.parse(value+"T12:00:00Z"));
 if(!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$/.test(value))return false;
 const ms=Date.parse(value);
 return Number.isFinite(ms)&&ms<=Date.parse(HISTORICAL_T0_CUTOFF);
}
export function findNewHistoricalPrimaryCandidate(packet,hold){
 const sourceIds=new Set(hold.baselineSourceIds);
 const origins=new Set(hold.baselineUniqueOrigins);
 const candidates=(packet?.sources||[]).filter(s=>s && s.primary===true &&
  typeof s.sourceId==="string" && !sourceIds.has(s.sourceId) &&
  typeof s.originFingerprint==="string" && !origins.has(s.originFingerprint) &&
  typeof s.url==="string" && s.url.startsWith("https://") &&
  timeEligibleForHistoricalReview(s.publishedAt))
 .map(s=>({
  sourceId:s.sourceId,originFingerprint:s.originFingerprint,
  url:s.url,publishedAt:s.publishedAt,
  authenticatedForHistoricalT0:false,
  sourceIntegrityAdjudicated:false,
  canonicalEvidenceAdmitted:false
 })).sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
 return candidates[0]||null;
}

export function resolveSourceFeasibility(ticker,failures,holds,packet=null){
 const item=holds?.get(ticker);
 if(!item)return {held:false,hold:null,reviewCandidate:null};
 const unresolved=item.triggerFailures.filter(f=>(failures||[]).includes(f));
 if(!unresolved.length)return {held:false,hold:null,reviewCandidate:null};
 const candidate=findNewHistoricalPrimaryCandidate(packet,item);
 if(candidate){
  return {held:false,hold:null,reviewCandidate:{
   ...candidate,mode:"noncanonical_source_review_only",
   originalHoldUnresolvedFailures:unresolved,
   scoringAuthorized:false,canonicalPromotionAuthorized:false
  }};
 }
 return {held:true,reviewCandidate:null,hold:{
  status:STATUS,blockingFailureNames:unresolved,
  requiredEvidence:item.requiredEvidence,sourceReferences:item.sourceReferences,
  reviewedAt:item.reviewedAt,
  executionGuard:"await_source_integrity_verified_primary",
  releaseCondition:"New distinct, dated, pre-cutoff primary source registered for review OR named preflight failures closed by adjudication"
 }};
}
