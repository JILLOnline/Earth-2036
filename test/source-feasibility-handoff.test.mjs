import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {parseSourceFeasibilityHolds,resolveSourceFeasibility}
 from "../scripts/lib/source-feasibility-holds.mjs";
import {buildClosureFrontier} from "../scripts/lib/value-allocator.mjs";
import {buildRoutingQueues} from "../scripts/lib/workgraph-v2.mjs";
import {buildAssistRequests} from "../scripts/lib/assist-bus.mjs";

const POLICY_PATH=new URL("../config/source-feasibility-holds-v1.json",import.meta.url);
const policy=JSON.parse(await readFile(POLICY_PATH,"utf8"));
const holds=parseSourceFeasibilityHolds(policy);
const now="2026-10-18T12:00:00.000Z";
const failures={
 AEVA:["missing_specialist_perspective:source-integrity","missing_factor_evidence",
  "missing_numeric_score_record","unresolved_material_contradiction"],
 SWKS:["missing_specialist_perspective:source-integrity","missing_factor_evidence",
  "missing_numeric_score_record","missing_causal_mapping"],
 MWA:["unresolved_material_contradiction","missing_factor_evidence"]
};
const owner=f=>f.startsWith("unresolved_")?"deep-resolver":
 f==="missing_causal_mapping"?"council-beta":"council-alpha";
function makeGraph(failuresByTicker=failures){
 return {version:2,phase:"t0-bootstrap",companies:Object.fromEntries(Object.keys(failuresByTicker)
  .map(t=>[t,{ticker:t,state:"researching",workId:"t0:"+t,
   lastTransitionAt:"2026-10-07T08:00:00Z",attempts:0}]))};
}
function packet(ticker,failureNames){
 return {version:2,ticker,workId:"t0:"+ticker,sourceState:"ready_for_chief",
  evidencePaths:["data/runtime/workgraph/evidence/"+ticker+"-original.json"],
  evidenceWindow:{latestEvidenceGeneratedAt:"2026-10-08T08:14:46Z"},
  sourceLineage:{uniqueSourceCount:12},
  specialistCoverage:{required:["source-integrity","company-underwriting"],
   present:["company-underwriting"],missing:["source-integrity"],complete:false},
  contradictions:[],gatingIssues:[],unknowns:[],scoreReadiness:{complete:false},
  preflight:{passed:failureNames.length===0,failures:failureNames,
   routing:failureNames.map(f=>({failure:f,owner:owner(f)}))}
 };
}
function frontier(forFailures=failures){
 return buildClosureFrontier(makeGraph(forFailures),Object.entries(forFailures)
  .map(([ticker,fs])=>packet(ticker,fs)),{requests:[]},
  {total:250,counts:{canonical:176}},[],null,now,
  {limit:10,sourceFeasibilityHolds:holds});
}
test("AEVA source gap is grounded in strict noncanonical registry, not scoring",()=>{
 assert.equal(holds.size,1);
 const a=resolveSourceFeasibility("AEVA",failures.AEVA,holds);
 assert.equal(a.held,true);
 assert.equal(a.hold.status,"awaiting_unavailable_historical_primary");
 assert.equal(a.hold.executionGuard,"await_source_integrity_verified_primary");
 assert.ok(a.hold.sourceReferences.some(x=>x.startsWith("https://www.sec.gov/")));
 assert.equal(resolveSourceFeasibility("SWKS",failures.SWKS,holds).held,false);
});
test("source hold is selected OUT of primary capacity without losing company or overriding Workgraph",()=>{
 const f=frontier();
 const aeva=f.candidates.find(x=>x.ticker==="AEVA");
 assert.equal(aeva.primeEligible,false);
 assert.equal(aeva.status,"awaiting_unavailable_historical_primary");
 assert.equal(aeva.executionGuard,"await_source_integrity_verified_primary");
 assert.equal(aeva.selected,false);
 assert.equal(f.selected.some(x=>x.ticker==="AEVA"),false);
 assert.equal(f.selected.some(x=>x.ticker==="SWKS"),true);
 assert.equal(f.backlogTotal,3);
 assert.equal(f.sourceFeasibility.activeHolds,1);
 assert.deepEqual(f.sourceFeasibility.holdTickers,["AEVA"]);
 assert.equal(f.canonicalWriteAuthority,false);
});
test("frontier to worker routing cannot turn source hold into recovery probe",()=>{
 const graph=makeGraph(),packets=Object.entries(failures).map(([ticker,fs])=>packet(ticker,fs));
 const f=frontier();
 const q=buildRoutingQueues(graph,packets,now,{
  frontierFirst:true,
  frontierTickers:f.selected.map(x=>x.ticker),
  stalledTickers:f.stalled.map(x=>x.ticker),
  operationalStatusByTicker:Object.fromEntries(f.candidates.map(x=>[x.ticker,x.status]))
 });
 const alpha=q["council-alpha"];
 const hold=alpha.deferredItems.find(x=>x.ticker==="AEVA");
 assert.ok(hold);
 assert.equal(hold.executionGuard,"await_source_integrity_verified_primary");
 assert.equal(hold.deferred,true);
 assert.equal(alpha.items.some(x=>x.ticker==="AEVA"),false);
 assert.equal(alpha.items.some(x=>x.ticker==="SWKS"),true);
 assert.equal(alpha.items.some(x=>x.executionGuard==="changed_strategy_required"&&x.ticker==="AEVA"),false);
});
test("all source-held work cannot become accidental recovered executable work",()=>{
 const graph=makeGraph({AEVA:failures.AEVA});
 const f=frontier({AEVA:failures.AEVA});
 const q=buildRoutingQueues(graph,[packet("AEVA",failures.AEVA)],now,{
  frontierFirst:true,
  frontierTickers:[],stalledTickers:["AEVA"],
  operationalStatusByTicker:{AEVA:"awaiting_unavailable_historical_primary"}
 });
 assert.equal(f.selectedCount,0);
 assert.equal(f.sourceFeasibility.primaryResearchStarved,true);
 for(const role of ["council-alpha","deep-resolver"]){
  const lane=q[role];
  assert.equal(lane.total,0);
  assert.ok(lane.deferredItems.length>=1);
  assert.ok(lane.deferredItems.every(x=>x.executionGuard==="await_source_integrity_verified_primary"));
 }
});
test("when named original-source preflight failures are genuinely resolved, routing hold releases",()=>{
 const f=frontier({AEVA:["unresolved_material_contradiction"],SWKS:failures.SWKS});
 const a=f.candidates.find(x=>x.ticker==="AEVA");
 assert.equal(a.sourceFeasibility,null);
 assert.equal(a.primeEligible,true);
 assert.notEqual(a.status,"awaiting_unavailable_historical_primary");
 assert.equal(resolveSourceFeasibility("AEVA",["missing_factor_evidence"],holds).held,true);
});
test("policy tampering never authorizes arbitrary time-shift or weaker source guard",()=>{
 for(const mutator of [
  p=>p.cutoff="2026-10-18T23:59:59-04:00",
  p=>p.authority="canonical",
  p=>p.holds[0].ticker="../AEVA",
  p=>p.holds[0].sourceReferences=["http://unsafe/"],
  p=>p.holds[0].triggerFailures=[],
  p=>p.holds.push(structuredClone(p.holds[0]))
 ]){
  const copy=structuredClone(policy);mutator(copy);
  assert.throws(()=>parseSourceFeasibilityHolds(copy),/source_feasibility_/);
 }
});

test("Scout active assist capacity never recycles original-source-held AEVA",()=>{
 const graph=makeGraph(), packets=Object.entries(failures).map(([ticker,fs])=>packet(ticker,fs));
 const f=frontier();
 const status=Object.fromEntries(f.candidates.map(x=>[x.ticker,x.status]));
 const a=buildAssistRequests(graph,packets,[],now,null,{
  lifecycleEnabled:true,frontierTickers:f.selected.map(x=>x.ticker),
  recoverySupportTickers:[],operationalStatusByTicker:status
 });
 const aevaRequests=a.requests.filter(x=>x.ticker==="AEVA");
 assert.ok(aevaRequests.length>0);
 assert.ok(aevaRequests.every(x=>x.status!=="active"));
 assert.ok(aevaRequests.every(x=>x.operationalStatus==="awaiting_unavailable_historical_primary"));
 assert.ok(a.requests.some(x=>x.ticker==="SWKS"));
});

test("genuinely NEW dated primary lineage reopens REVIEW, not canonical source admission",()=>{
 const g=makeGraph({AEVA:failures.AEVA});
 const p=packet("AEVA",failures.AEVA);
 p.sources=[{
  sourceId:"sec:AEVA:share-count-original:20260911",
  originFingerprint:"sec.gov|AEVA|issuer-ledger|2026-09-11|new-filing",
  url:"https://www.sec.gov/Archives/edgar/data/1789029/000000000026111111/new.htm",
  publishedAt:"2026-09-11",primary:true
 }];
 const v=resolveSourceFeasibility("AEVA",failures.AEVA,holds,p);
 assert.equal(v.held,false);
 assert.equal(v.reviewCandidate.mode,"noncanonical_source_review_only");
 assert.equal(v.reviewCandidate.authenticatedForHistoricalT0,false);
 assert.equal(v.reviewCandidate.scoringAuthorized,false);
 assert.equal(v.reviewCandidate.canonicalPromotionAuthorized,false);
 const ff=buildClosureFrontier(g,[p],{requests:[]},
  {total:250,counts:{canonical:176}},[],null,now,
  {limit:10,sourceFeasibilityHolds:holds});
 assert.deepEqual(ff.selected.map(x=>x.ticker),["AEVA"]);
 assert.equal(ff.selected[0].status,"needs_primary_source_review");
 assert.equal(ff.selected[0].sourceFeasibility,null);
 assert.equal(ff.selected[0].sourceFeasibilityReview.canonicalEvidenceAdmitted,false);
 assert.deepEqual(ff.sourceFeasibility.sourceReviewReopenedTickers,["AEVA"]);
});

test("old, post-cutoff, secondary, unaddressed, and duplicate sources do NOT reopen",()=>{
 const make=()=>packet("AEVA",failures.AEVA);
 const candidate={
  sourceId:"sec:AEVA:share-count-original:20260911",
  originFingerprint:"sec.gov|AEVA|issuer-ledger|2026-09-11|new-filing",
  url:"https://www.sec.gov/Archives/edgar/data/1789029/000000000026111111/new.htm",
  publishedAt:"2026-09-11",primary:true
 };
 const changes=[
  {publishedAt:"2026-09-27"},
  {publishedAt:"2026-09-12"},
  {publishedAt:"2026-09-13T00:00:00Z"},
  {primary:false},
  {publishedAt:null},
  {url:"http://insecure.example"},
  {originFingerprint:"sec.gov|AEVA|10-Q|2026-06-30|0001193125-26-338179"},
  {sourceId:"sec:AEVA:10-Q:20260630"},
  {sourceId:"sec:AEVA:original-unchanged",originFingerprint:""},
 ];
 for(const update of changes){
  const p=make();p.sources=[{...candidate,...update}];
  const v=resolveSourceFeasibility("AEVA",failures.AEVA,holds,p);
  assert.equal(v.held,true,JSON.stringify(update));
  assert.equal(v.reviewCandidate,null);
 }
});
