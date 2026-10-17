import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assessPhoenixContinuity,CONTINUITY_CONTRACT} from "../scripts/lib/phoenix-continuity-acceptance.mjs";
const sha="a".repeat(64);
const checked="2026-10-17T19:19:34.493Z";
const beginning=Date.parse("2026-10-14T19:00:00.000Z");
function keyAt(index){
  return new Date(beginning+index*3600000).toISOString().replace(/[-:]/g,"").slice(0,11)+"00Z";
}
function fixture(){
  const rows=Array.from({length:72},(_,i)=>{
    const hourKey=keyAt(i);
    return{
      hourKey,asOfObservationStatus:"persisted",
      retrospectiveObservationStatus:"persisted_now",
      asOfReceiptSha256:sha,
      asOfReceiptPath:"data/operations/hourly-audits/2026/10/17/"+hourKey+".json",
      cycleHistoryLine:150+i,
      sourceLineSha256:sha,
      schedulerRuns:[{id:39000000000+i,event:"schedule",status:"completed",
        conclusion:"success",createdAt:new Date(beginning+i*3600000+900000).toISOString()}],
      schedulerLookup:{status:"available"},
    };
  });
  return {contract:"earth2036-retrospective-hourly-reconciliation-v1",version:1,
    checkedAt:checked,windowHours:72,governance:{backfillsObservations:false},rows};
}
test("complete original 72h history passes all four endurance gates",()=>{
  const j=assessPhoenixContinuity(fixture());
  assert.equal(j.contract,CONTINUITY_CONTRACT);
  assert.equal(j.acceptance.allGatesSatisfied,true);
  assert.equal(j.windows["6h"].completeObservationHours,6);
  assert.equal(j.windows["72h"].completeAsOfHours,72);
  assert.equal(j.authority.syntheticObservations,false);
});
test("recent missing observation fails 6h/24h/72h even if workflow succeeded",()=>{
  const d=fixture();d.rows[71].retrospectiveObservationStatus="still_missing";
  d.rows[71].sourceLineSha256=null;
  const r=assessPhoenixContinuity(d);
  assert.equal(r.acceptance.sixConsecutiveOriginalObservations,false);
  assert.equal(r.windows["6h"].missingOriginalObservationHours,1);
  assert.equal(r.windows["6h"].trailingObservedStreak,0);
  assert.equal(r.windows["24h"].observationGate,"not_qualified");
});
test("missing original scheduler run cannot pass based on persisted-looking blob alone",()=>{
  const d=fixture();d.rows[70].schedulerRuns=[];
  const r=assessPhoenixContinuity(d);
  assert.equal(r.windows["6h"].observationGate,"not_qualified");
  assert.equal(r.windows["6h"].persistedWithLineage,6);
  assert.equal(r.windows["6h"].originalSchedulerAttested,5);
});
test("missing as-of receipt never claims full audited continuity",()=>{
  const d=fixture();d.rows[70].asOfReceiptSha256=null;
  d.rows[70].asOfObservationStatus="no_as_of_receipt";
  const r=assessPhoenixContinuity(d);
  assert.equal(r.windows["6h"].observationGate,"passed");
  assert.equal(r.windows["6h"].asOfGate,"not_qualified");
  assert.equal(r.acceptance.allGatesSatisfied,false);
});
test("only recent 6h complete does not qualify 24h or 72h",()=>{
  const d=fixture();d.rows[58].retrospectiveObservationStatus="still_missing";
  d.rows[58].sourceLineSha256=null;
  const r=assessPhoenixContinuity(d);
  assert.equal(r.windows["6h"].observationGate,"passed");
  assert.equal(r.windows["24h"].observationGate,"not_qualified");
  assert.equal(r.windows["72h"].observationGate,"not_qualified");
});
test("72 complete-hour slots are required, no skipped or duplicated key",()=>{
  const d=fixture();d.rows.splice(30,1);
  assert.throws(()=>assessPhoenixContinuity(d),/phoenix_continuity_source_unverified/);
  const e=fixture();e.rows[30]=structuredClone(e.rows[29]);
  assert.throws(()=>assessPhoenixContinuity(e),/phoenix_continuity_missing_or_duplicate_slot/);
});
test("false calendar hour and out-of-order row cannot qualify",()=>{
  const d=fixture();d.rows[30].hourKey="20261317T0900Z";
  assert.throws(()=>assessPhoenixContinuity(d),/phoenix_continuity_impossible_hour/);
  const e=fixture();[e.rows[29],e.rows[30]]=[e.rows[30],e.rows[29]];
  assert.throws(()=>assessPhoenixContinuity(e),/phoenix_continuity_hour_order_mismatch/);
});
test("future hour is not accepted as completed original history",()=>{
  const d=fixture();d.checkedAt="2026-10-17T17:30:00Z";
  assert.throws(()=>assessPhoenixContinuity(d),/phoenix_continuity_future_slot/);
});
test("fake run dispatched the following hour cannot certify an earlier one",()=>{
  const d=fixture();d.rows[71].schedulerRuns[0].createdAt="2026-10-17T19:02:00Z";
  assert.equal(assessPhoenixContinuity(d).windows["6h"].observationGate,"not_qualified");
});
test("event-based real workflow_dispatch counts only with original persisted history",()=>{
  const d=fixture();d.rows[71].schedulerRuns[0].event="workflow_dispatch";
  assert.equal(assessPhoenixContinuity(d).windows["6h"].observationGate,"passed");
  d.rows[71].cycleHistoryLine=null;
  assert.equal(assessPhoenixContinuity(d).windows["6h"].observationGate,"not_qualified");
});
test("tampered provenance SHA and receipt filename fail separately",()=>{
  const d=fixture();d.rows[71].sourceLineSha256="not-a-sha";
  assert.equal(assessPhoenixContinuity(d).windows["6h"].observationGate,"not_qualified");
  const e=fixture();e.rows[71].asOfReceiptPath="../other.json";
  assert.equal(assessPhoenixContinuity(e).windows["6h"].asOfGate,"not_qualified");
});
test("stable fingerprint for same original rows; no extra task or writes",()=>{
  const a=assessPhoenixContinuity(fixture());
  const b=assessPhoenixContinuity(fixture());
  assert.equal(a.sourceFingerprint,b.sourceFingerprint);
  assert.equal(a.authority.schedulerDispatch,false);
  assert.equal(a.authority.canonicalWrites,false);
  assert.equal(a.authority.qualifiedTicks,false);
});
test("must be wired to existing closure audit, never a sixth scheduled task",async()=>{
  const yaml=await readFile(new URL("../.github/workflows/earth2036-closure-invariants.yml",import.meta.url),"utf8");
  assert.match(yaml,/node scripts\/phoenix-continuity-inspect\.mjs/);
  assert.match(yaml,/continue-on-error: true/);
});
