import test from "node:test";
import assert from "node:assert/strict";
import {buildTrialReviewReport} from "../scripts/lib/trial-review-report.mjs";
const build=(n)=>({manifest:{baselineId:"t0",methodologyVersion:"1.0.0",universeVersion:"u1-250",
 qualifiedTrialTicksAfterBaseline:n,...(n===1000?{trialStatus:"complete_awaiting_review"}:{})},
 state:{qualifiedTrialTicks:n,lastQualifiedCycleKey:n?("2026"+String(1000000+n).slice(1)+"T0000Z"):null,
 phase:n===1000?"trial_complete_awaiting_review":"trial"},
 ticks:Array.from({length:n},(_,i)=>({tickNumber:i+1,cycleKey:"2026"+String(1000001+i).slice(1)+"T0000Z",
  trajectory:{validation:{passed:true},horizons:[{months:12,outcomeStatus:"pending"}]}}))});
test("noncompleted trial does not claim completion or forecast results",()=>{
 const x=build(2);x.state.lastQualifiedCycleKey=x.ticks.at(-1).cycleKey;
 const r=buildTrialReviewReport(x);
 assert.equal(r.captureComplete,false);assert.equal(r.forecastEvaluation.evaluatedPredictions,0);
});
test("full 1000 trial produces review-ready read-only receipt with pending outcomes",()=>{
 const x=build(1000);x.state.lastQualifiedCycleKey=x.ticks.at(-1).cycleKey;
 const r=buildTrialReviewReport(x);
 assert.equal(r.captureComplete,true);assert.equal(r.awaitingOwnerReassessment,true);
 assert.equal(r.trajectoryObservationHorizons[0].pending,1000);
 assert.equal(r.qualificationAuthority,false);assert.match(r.reportHash,/^[a-f0-9]{64}$/);
});
test("counter corruption never emits a complete result",()=>{
 const x=build(2);x.state.lastQualifiedCycleKey=x.ticks.at(-1).cycleKey;x.manifest.qualifiedTrialTicksAfterBaseline=3;
 assert.equal(buildTrialReviewReport(x).captureComplete,false);
});
