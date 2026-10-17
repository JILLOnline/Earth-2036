import test from "node:test";
import assert from "node:assert/strict";
import {determineTickFinalization,TRIAL_TICK_LIMIT} from "../scripts/lib/tick-authority.mjs";
import {auditTrialTickHistory} from "../scripts/lib/trial-tick-history-audit.mjs";
import {buildTrialReviewReport} from "../scripts/lib/trial-review-report.mjs";
const slot=n=>new Date(Date.UTC(2026,0,1,n)).toISOString().slice(0,13).replace(/-/g,"")+"00Z";
function fixture(count){
 const ticks=Array.from({length:count},(_,i)=>({tickNumber:i+1,cycleKey:slot(i),trajectory:{validation:{passed:true},horizons:[{months:12,outcomeStatus:"pending"},{months:24,outcomeStatus:"pending"}]}}));
 return {ticks,state:{qualifiedTrialTicks:count,lastQualifiedCycleKey:ticks.at(-1)?.cycleKey??null,phase:count===1000?"trial_complete_awaiting_review":"trial"},manifest:{qualifiedTrialTicksAfterBaseline:count,...(count===1000?{trialStatus:"complete_awaiting_review"}:{})}};
}
test("full simulated 1000-tick hour sequence has exactly one terminal transition",()=>{
 const x=fixture(0);
 for(let i=0;i<TRIAL_TICK_LIMIT;i++){
  const cycleKey=slot(i);
  const decision=determineTickFinalization({cycleKey,qualified:true,state:x.state,manifest:x.manifest,existingTick:null});
  assert.equal(decision.action,"finalize");
  assert.equal(decision.tickNumber,i+1);
  x.ticks.push({tickNumber:i+1,cycleKey,trajectory:{validation:{passed:true},horizons:[{months:12,outcomeStatus:"pending"}]}});
  x.state.qualifiedTrialTicks=i+1;x.state.lastQualifiedCycleKey=cycleKey;
  x.manifest.qualifiedTrialTicksAfterBaseline=i+1;
  if(i===999){x.state.phase="trial_complete_awaiting_review";x.manifest.trialStatus="complete_awaiting_review";}
  assert.equal(auditTrialTickHistory(x).passed,true);
 }
 const stop=determineTickFinalization({cycleKey:slot(1000),qualified:true,state:x.state,manifest:x.manifest,existingTick:null});
 assert.deepEqual(stop,{action:"trial_complete",tickNumber:1000});
 const replay=determineTickFinalization({cycleKey:slot(999),qualified:true,state:x.state,manifest:x.manifest,existingTick:x.ticks.at(-1)});
 assert.deepEqual(replay,{action:"already_finalized",tickNumber:1000});
 const report=buildTrialReviewReport({...x,generatedAt:"2026-02-12T00:00:00Z"});
 assert.equal(report.captureComplete,true);
 assert.equal(report.forecastEvaluation.evaluatedPredictions,0);
 assert.equal(report.trajectoryObservationHorizons[0].pending,1000);
});
test("simulated crash after writing the last tick before updating both counters blocks",()=>{
 const x=fixture(999);x.ticks.push({tickNumber:1000,cycleKey:slot(999)});
 assert.equal(auditTrialTickHistory(x).passed,false);
 assert.equal(buildTrialReviewReport(x).captureComplete,false);
});
test("simulated crash after updating counters but before writing tick blocks",()=>{
 const x=fixture(1000);x.ticks.pop();
 assert.equal(auditTrialTickHistory(x).passed,false);
});
test("same-hour replay without a committed receipt never silently backfills",()=>{
 const x=fixture(999);x.state.lastQualifiedCycleKey=slot(999);
 assert.throws(()=>determineTickFinalization({cycleKey:slot(999),qualified:true,state:x.state,manifest:x.manifest,existingTick:null}),/without immutable tick file/);
});
test("nonqualified cycle does not advance sequence",()=>{
 const x=fixture(999);
 assert.deepEqual(determineTickFinalization({cycleKey:slot(999),qualified:false,state:x.state,manifest:x.manifest,existingTick:null}),{action:"not_qualified",tickNumber:999});
});
