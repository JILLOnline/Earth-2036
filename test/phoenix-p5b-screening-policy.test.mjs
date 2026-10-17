import test from "node:test";
import assert from "node:assert/strict";
import {screenPrimarySources, P5B_RESULT_CONTRACT} from "../scripts/lib/phoenix-p5b-source-screening.mjs";

const swks={
 ticker:"SWKS",workId:"t0:SWKS",owner:"council-alpha",
 cik:"0000004127",accessionNumber:"0000004127-26-000049",
 form:"10-Q",filingDate:"2026-07-28",
 primaryDocumentUrl:"https://www.sec.gov/Archives/edgar/data/4127/000000412726000049/swks-20260703.htm",
 targetedWorkgraphFailures:["missing_factor_evidence","missing_numeric_score_record"],
 observedPrimaryDocumentFacts:[{item:"Quarterly net revenue",reportedValue:934.8}],
 existingResearchDoesNotProve:"Issuer raw bytes and factor-level materiality are not authenticated by this screen.",
 reviewDecision:"screen_for_lawful_source_acquisition_only",
 rawSourceBytesAuthenticated:false,independentMaterialityApproved:false,
 workerDisableCauseVerified:false,originalSECBytesSha256:null,
};
const mwa={
 ticker:"MWA",workId:"t0:MWA",owner:"earth-scout",
 cik:"0001350593",accessionNumber:"0001350593-26-000038",
 form:"8-K",filingDate:"2026-10-13",
 primaryDocumentUrl:"https://www.sec.gov/Archives/edgar/data/1350593/000135059326000038/mwa-20261012.htm",
 targetedWorkgraphFailures:["unresolved_material_contradiction"],
 observedPrimaryDocumentFacts:[{item:"Leadership",reportedValue:"Finance leadership transition"}],
 existingResearchDoesNotProve:"This later management transition cannot establish prior-year tariff-refund normalization.",
 reviewDecision:"exclude_for_this_gate_without_changing_other_research",
 rawSourceBytesAuthenticated:false,independentMaterialityApproved:false,
 workerDisableCauseVerified:false,originalSECBytesSha256:null,
};
function inputs(){
 return{
  screening:{contract:"earth2036-phoenix-p5b-primary-source-screening-v1",version:1,
    cutoffPolicy:{phase:"official_t0_baseline",t0EvidenceCutoff:"2026-09-12",
    reopeningHistoricalT0OnPostCutoffInformation:false},records:[structuredClone(swks),structuredClone(mwa)]},
  packets:[{ticker:"SWKS",workId:"t0:SWKS",preflight:{passed:false,failures:swks.targetedWorkgraphFailures}},
    {ticker:"MWA",workId:"t0:MWA",preflight:{passed:false,failures:mwa.targetedWorkgraphFailures}}],
  observations:{candidates:{SWKS:{cik:"0000004127"},MWA:{cik:"0001350593"}}},
  reviewQueue:{items:[{id:"MWA:0001350593-26-000038",ticker:"MWA",
    accessionNumber:"0001350593-26-000038",sourceUrl:mwa.primaryDocumentUrl}]},
  sourceHoldCatalog:{contract:"earth2036-phoenix-known-write-rejections-v1",records:[
    {kind:"exact_request",ticker:"AEVA",requestId:"assist:AEVA:council-alpha:earth-scout:source-acquisition"}]},
  existingSourcesByTicker:{SWKS:[],MWA:[]}
 };
}
const assess=x=>screenPrimarySources(x||inputs());

test("bounded two-case source screening is explicitly noncanonical and never launches work",()=>{
 const r=assess();assert.equal(r.contract,P5B_RESULT_CONTRACT);
 assert.equal(r.screenedCount,2);assert.equal(r.authorizedHandoffs,0);
 assert.equal(r.workerRestarts,0);assert.equal(r.canonicalMutations,0);
 assert.ok(r.records.every(x=>x.handoffAuthorized===false && x.automaticWorkerRestart===false));
});
test("pre-cutoff SWKS 10-Q gets only pending authentication and materiality review",()=>{
 const row=assess().records.find(x=>x.ticker==="SWKS");
 assert.equal(row.status,"awaiting_original_sec_bytes_and_independent_materiality_review");
 assert.equal(row.afterT0Cutoff,false);assert.equal(row.secQueuedMatch,undefined);
 assert.equal(row.originalSECBytesAuthenticated,false);
 assert.equal(row.sourceMaterialityIndependentlyApproved,false);
});
test("post-cutoff MWA 8-K cannot clear T0 margin-volume contradiction",()=>{
 const row=assess().records.find(x=>x.ticker==="MWA");
 assert.equal(row.status,"screened_out_for_named_gate");
 assert.equal(row.afterT0Cutoff,true);
 assert.equal(row.secQueuedMatch,true);
 assert.equal(row.handoffAuthorized,false);
});
test("non-excluded post-cutoff source is still ineligible for T0",()=>{
 const x=inputs();x.screening.records[1].reviewDecision="screen_for_lawful_source_acquisition_only";
 assert.equal(assess(x).records[1].status,"outside_historical_t0_cutoff");
});
test("a primary source already cited in packet evidence never generates duplicate work",()=>{
 const x=inputs();x.existingSourcesByTicker.SWKS=[swks.primaryDocumentUrl];
 assert.equal(assess(x).records[0].status,"already_in_exact_source_lineage_no_duplicate_work");
});
test("changing the accession while retaining another filing URL is rejected",()=>{
 const x=inputs();x.screening.records[0].accessionNumber="0000004127-26-000050";
 assert.throws(()=>assess(x),/phoenix_p5b_invalid_source_record/);
});
test("non-SEC or host-similar sources are rejected",()=>{
 for(const prefix of ["https://www.sec.gov.evil.example/", "http://www.sec.gov/", "https://other.example/"]){
  const x=inputs();x.screening.records[0].primaryDocumentUrl=prefix+"Archives/edgar/data/4127/000000412726000049/swks-20260703.htm";
  assert.throws(()=>assess(x),/phoenix_p5b_invalid_source_record/);
 }
});
test("wrong issuer CIK or Workgraph identity fails rather than cross-assigning source",()=>{
 const x=inputs();x.observations.candidates.SWKS.cik="0000001234";
 assert.throws(()=>assess(x),/phoenix_p5b_packet_identity_or_state_mismatch/);
});
test("a named failure must actually exist on the current packet",()=>{
 const x=inputs();x.screening.records[0].targetedWorkgraphFailures=["not_a_real_workgraph_gate"];
 assert.throws(()=>assess(x),/phoenix_p5b_review_targets_nonexistent_gate/);
});
test("a changed signed-off packet cannot be treated as needing another research wake",()=>{
 const x=inputs();x.packets[0].preflight.passed=true;
 assert.throws(()=>assess(x),/phoenix_p5b_packet_identity_or_state_mismatch/);
});
test("self-declared raw source authentication is not accepted",()=>{
 const x=inputs();x.screening.records[0].rawSourceBytesAuthenticated=true;
 assert.throws(()=>assess(x),/phoenix_p5b_uncommissioned_authentication_or_clearance_claim/);
});
test("self-declared independent approval or worker clearance is rejected",()=>{
 for(const field of ["independentMaterialityApproved","workerDisableCauseVerified","originalSECBytesSha256"]){
  const x=inputs();x.screening.records[0][field]=field==="originalSECBytesSha256"?"a".repeat(64):true;
  assert.throws(()=>assess(x),/phoenix_p5b_uncommissioned_authentication_or_clearance_claim/);
 }
});
test("exact historical AEVA write hold does not falsely attach to SWKS or MWA",()=>{
 const rows=assess().records;
 assert.ok(rows.every(x=>x.exactSafetyHeldRequests.length===0));
});
test("new exact request hold is visible without authorizing a retry",()=>{
 const x=inputs();x.sourceHoldCatalog.records.push({
   kind:"exact_request",ticker:"SWKS",requestId:"assist:SWKS:alpha:scout:source"
 });
 const row=assess(x).records[0];
 assert.deepEqual(row.exactSafetyHeldRequests,["assist:SWKS:alpha:scout:source"]);
 assert.equal(row.handoffAuthorized,false);
});
test("duplicate accession or malformed T0 policy refuses a decision",()=>{
 const x=inputs();x.screening.records.push(structuredClone(swks));
 assert.throws(()=>assess(x),/phoenix_p5b_duplicate_screening/);
 const y=inputs();y.screening.cutoffPolicy.reopeningHistoricalT0OnPostCutoffInformation=true;
 assert.throws(()=>assess(y),/phoenix_p5b_inputs_invalid/);
});
