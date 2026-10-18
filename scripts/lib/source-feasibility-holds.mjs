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
   !h.unblockRule?.includes("preflight"))
    throw Error("source_feasibility_hold_invalid:"+String(h?.ticker??"unknown"));
  out.set(h.ticker,Object.freeze({
   ticker:h.ticker,status:STATUS,
   triggerFailures:Object.freeze([...h.triggerFailures]),
   requiredEvidence:h.requiredEvidence,
   sourceReferences:Object.freeze([...h.sourceReferences]),
   reviewedAt:h.reviewedAt,
   unblockRule:h.unblockRule
  }));
 }
 return out;
}

export function resolveSourceFeasibility(ticker,failures,holds){
 const item=holds?.get(ticker);
 if(!item)return {held:false,hold:null};
 const unresolved=item.triggerFailures.filter(f=>(failures||[]).includes(f));
 if(!unresolved.length)return {held:false,hold:null};
 return {held:true,hold:{
  status:STATUS,blockingFailureNames:unresolved,
  requiredEvidence:item.requiredEvidence,sourceReferences:item.sourceReferences,
  reviewedAt:item.reviewedAt,
  executionGuard:"await_source_integrity_verified_primary",
  // A new press release or an unchanged role-run is not automatically an
  // acceptable substitute for missing cutoff-period issuer source documents.
  releaseCondition:"all named preflight failures absent after evidence adjudication"
 }};
}
