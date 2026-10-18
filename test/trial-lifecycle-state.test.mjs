import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolveTrialLifecycleState} from "../scripts/lib/trial-lifecycle-state.mjs";
const state=(n,phase="trial")=>({phase,qualifiedTrialTicks:n});
const manifest=(n,extra={})=>({published:true,qualifiedTrialTicksAfterBaseline:n,...extra});

test("unpublished T0 never authorizes trial, even if machine gate appears green",()=>{
 const result=resolveTrialLifecycleState({runtimeState:state(0,"official_t0_baseline"),manifest:{published:false,qualifiedTrialTicksAfterBaseline:0},gatePassed:true});
 assert.deepEqual(result,{phase:"official_t0_baseline",trialEligible:false,trialComplete:false});
});
test("published T0 transitions to active trial without silently producing tick one",()=>{
 const result=resolveTrialLifecycleState({runtimeState:state(0),manifest:manifest(0),gatePassed:true});
 assert.equal(result.phase,"trial");assert.equal(result.trialEligible,true);
});
test("healthy tick 999 stays active but never changes counter",()=>{
 const result=resolveTrialLifecycleState({runtimeState:state(999),manifest:manifest(999),gatePassed:true});
 assert.equal(result.phase,"trial");assert.equal(result.trialEligible,true);
});
test("tick 1000 remains terminal after subsequent observations even with healthy sources",()=>{
 const result=resolveTrialLifecycleState({
  runtimeState:state(1000,"trial_complete_awaiting_review"),
  manifest:manifest(1000,{trialStatus:"complete_awaiting_review",trialEligible:false}),
  gatePassed:true,
 });
 assert.deepEqual(result,{phase:"trial_complete_awaiting_review",trialEligible:false,trialComplete:true});
});
test("terminal phase reset, manifest reopening, and inconsistent counters fail closed",()=>{
 const terminal=manifest(1000,{trialStatus:"complete_awaiting_review",trialEligible:false});
 for(const x of [
  {runtimeState:state(1000,"trial"),manifest:terminal},
  {runtimeState:state(1000,"trial_complete_awaiting_review"),manifest:{...terminal,trialEligible:true}},
  {runtimeState:state(1000,"trial_complete_awaiting_review"),manifest:{...terminal,trialStatus:null}},
  {runtimeState:state(999,"trial"),manifest:terminal},
  {runtimeState:state(1001,"trial_complete_awaiting_review"),manifest:{...terminal,qualifiedTrialTicksAfterBaseline:1001}},
  {runtimeState:state(1,"trial"),manifest:{published:false,qualifiedTrialTicksAfterBaseline:1}},
 ]){
  assert.throws(()=>resolveTrialLifecycleState({...x,gatePassed:true}));
 }
});
test("hourly engine uses reconciled lifecycle phase and trial eligibility",async()=>{
 const source=await readFile(new URL("../scripts/earth2036-engine.mjs",import.meta.url),"utf8");
 assert.match(source,/resolveTrialLifecycleState\(\{runtimeState,manifest,gatePassed:gate\.passed\}\)/);
 assert.match(source,/phase: lifecycleState\.phase/);
 assert.match(source,/trialEligible: lifecycleState\.trialEligible/);
 assert.doesNotMatch(source,/phase: baselinePublished \? "trial"/);
});
