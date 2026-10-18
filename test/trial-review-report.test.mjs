import test from "node:test";
import assert from "node:assert/strict";
import {buildTrialReviewReport} from "../scripts/lib/trial-review-report.mjs";
import {sealTrialTick} from "../scripts/lib/trial-tick-seal.mjs";
const makeTicks=(n)=>Array.from({length:n},(_,i)=>({tickNumber:i+1,cycleKey:new Date(Date.UTC(2026,0,1,i)).toISOString().slice(0,13).replace(/-/g,"")+"00Z",trajectory:{validation:{passed:true},horizons:[{months:12,outcomeStatus:"pending"}]}})).reduce((acc,t)=>{acc.push(sealTrialTick(t,acc.at(-1)?.tickRecordHash??null));return acc;},[]);
const build=(n)=>({manifest:{published:true,baselineId:"t0",methodologyVersion:"1.0.0",universeVersion:"u1-250",
 qualifiedTrialTicksAfterBaseline:n,...(n===1000?{trialStatus:"complete_awaiting_review"}:{})},
 state:{qualifiedTrialTicks:n,lastQualifiedCycleKey:null,
 phase:n===1000?"trial_complete_awaiting_review":"trial"},
 ticks:makeTicks(n)});;
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
