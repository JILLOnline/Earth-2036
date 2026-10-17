import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildSourceChangeReview} from "../scripts/lib/phoenix-source-change-review.mjs";
const old="a".repeat(64),fresh="b".repeat(64),time="2026-10-17T18:00:00.000Z";
const ticker="MWA",number="0001234567-26-000123";
function fixture(){
  return {
    sourceAudit:{contract:"earth2036-source-delta-observation-audit-v1",generatedAt:time,currentCycleAt:time,
      changes:[{ticker,status:"observed_window_new_accessions",previousFingerprint:old,
        currentFingerprint:fresh,addedAccessions:[{accessionNumber:number,form:"10-Q",filingDate:"2026-10-17"}]}]},
    secContinuity:{contract:"earth2036-sec-accession-continuity-v1",companiesChecked:250,continuous:250,incomplete:0},
    frontier:{contract:"earth2036-closure-frontier-v1",stalled:[{ticker,inputSignature:"legacy"}]},
    assistBus:{requests:[{ticker,requestId:"assist:MWA:council-alpha:earth-scout:source-acquisition",
      inputSignature:"old-20-char-signature",status:"dormant_until_input_changes"}]},
    reviewQueue:{items:[{id:ticker+":"+number,ticker,accessionNumber:number,
      status:"pending",sourceUrl:"https://www.sec.gov/Archives/edgar/data/1234567/000123456726000123/report.htm"}]},
    observations:{capturedAt:time,companiesExpected:250,candidates:{[ticker]:{status:"observed",filingFingerprint:fresh}}},
    sourceHoldCatalog:{contract:"earth2036-phoenix-known-write-rejections-v1",records:[]},
  };
}
const assess=(x=fixture())=>buildSourceChangeReview(x);
test("a genuine new SEC accession with continuous cursor creates review-only candidate",()=>{
  const r=assess();
  assert.equal(r.summary.newReviewSignals,1);
  assert.equal(r.signals[0].status,"source_review_required");
  assert.equal(r.signals[0].sourceUrl.startsWith("https://www.sec.gov/"),true);
  assert.equal(r.authority.automaticWorkerActivation,false);
  assert.equal(r.authority.resetDormantAssist,false);
  assert.equal(r.authority.resetFrontierStall,false);
});
test("unchanged SEC window never wakes dormant requests",()=>{
  const x=fixture();x.sourceAudit.changes=[];
  const r=assess(x);
  assert.equal(r.summary.newReviewSignals,0);
  assert.equal(r.summary.dormantAssistCount,1);
  assert.equal(r.summary.staleFrontierCount,1);
});
test("source-change report cannot silently assert material new filing date",()=>{
  const r=assess();
  assert.match(r.signals[0].reviewNeeded,/not.*newly filed/);
  assert.equal(r.signals[0].authorizedForCanonicalOrTickWrites,false);
});
test("SEC accession discontinuity leaves candidate unverified rather than accepted",()=>{
  const x=fixture();x.secContinuity.incomplete=1;x.secContinuity.continuous=249;
  const r=assess(x);assert.equal(r.signals[0].status,"needs_sec_continuity_or_queue_verification");
});
test("mismatched raw company fingerprint cannot certify candidate",()=>{
  const x=fixture();x.observations.candidates.MWA.filingFingerprint=old;
  assert.equal(assess(x).signals[0].status,"needs_sec_continuity_or_queue_verification");
});
test("SEC review queue origin must point to exact authentic archive URL",()=>{
  const x=fixture();x.reviewQueue.items[0].sourceUrl="https://bogus.example/filing";
  assert.equal(assess(x).signals[0].status,"needs_sec_continuity_or_queue_verification");
});
test("a changing source without new accession is never candidate",()=>{
  const x=fixture();
  x.sourceAudit.changes[0].status="window_changed_without_new_accession";
  assert.equal(assess(x).signals[0].status,"needs_sec_continuity_or_queue_verification");
});
test("specific historical safety rejection survives a new filing event",()=>{
  const x=fixture(),req=x.assistBus.requests[0].requestId;
  x.sourceHoldCatalog.records=[{kind:"exact_request",role:"earth-scout",ticker,requestId:req}];
  const r=assess(x);
  assert.equal(r.signals[0].status,"source_review_required_with_existing_safety_hold");
  assert.deepEqual(r.signals[0].heldRequestIds,[req]);
  assert.equal(r.signals[0].authorizedForSafetyRejectedPayloadRetry,false);
});
test("unrelated old safety hold not applied to a different exact source request",()=>{
  const x=fixture();
  x.sourceHoldCatalog.records=[{kind:"exact_request",role:"earth-scout",ticker,requestId:"other-assist"}];
  const r=assess(x);
  assert.equal(r.signals[0].status,"source_review_required");
});
test("new issuer filing without stale/dormant work is not presumed to fix a specific gate",()=>{
  const x=fixture();x.frontier.stalled=[];x.assistBus.requests=[];
  assert.equal(assess(x).signals.length,0);
});
test("rolling source audit becoming empty retains prior unresolved candidate rather than resolving",()=>{
  const first=assess(),x=fixture();
  x.sourceAudit.changes=[];x.previous=first;
  const second=assess(x);
  assert.equal(second.signals.length,1);
  assert.equal(second.signals[0].status,"historical_candidate_review_unverified");
  assert.equal(second.signals[0].firstObservedAt,time);
});
test("first version upgrade has no ability to mass wake legacy dormant states",()=>{
  const x=fixture();
  x.assistBus.requests=Array.from({length:200},(_,i)=>({...x.assistBus.requests[0],ticker:"OLD"+i}));
  x.sourceAudit.changes=[];
  const r=assess(x);
  assert.equal(r.summary.dormantAssistCount,200);
  assert.equal(r.summary.newReviewSignals,0);
  assert.equal(r.authority.resetDormantAssist,false);
});
test("duplicate accession signals or invalid source audit fail closed",()=>{
  const x=fixture();x.sourceAudit.changes[0].addedAccessions.push({...x.sourceAudit.changes[0].addedAccessions[0]});
  assert.throws(()=>assess(x),/phoenix_duplicate_sec_change/);
  x.sourceAudit.contract="invalid";
  assert.throws(()=>assess(x),/phoenix_source_review_inputs_invalid/);
});
test("cycle mismatch cannot claim change provenance",()=>{
  const x=fixture();x.sourceAudit.currentCycleAt="2026-10-16T10:00:00Z";
  assert.throws(()=>assess(x),/phoenix_source_review_cycle_mismatch/);
});
test("inspection is nonexecuting and wired to existing audit workflow",async()=>{
  const yaml=await readFile(new URL("../.github/workflows/earth2036-closure-invariants.yml",import.meta.url),"utf8");
  assert.match(yaml,/node scripts\/phoenix-source-change-inspect\.mjs/);
  assert.match(yaml,/continue-on-error: true/);
});
