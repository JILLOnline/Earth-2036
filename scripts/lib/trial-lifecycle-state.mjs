import {TRIAL_TICK_LIMIT} from "./tick-authority.mjs";

// Pure lifecycle reconciliation. No promotions, clock dependencies or writes.
// Once completed, continued machine observations cannot reopen trial qualification.
export function resolveTrialLifecycleState({runtimeState,manifest,gatePassed=false}={}){
 if(!manifest || typeof manifest!=="object") throw Error("missing_official_t0_manifest");
 const counter=runtimeState?.qualifiedTrialTicks ?? 0;
 const officialCounter=manifest?.qualifiedTrialTicksAfterBaseline ?? 0;
 if(!Number.isInteger(counter)||!Number.isInteger(officialCounter)||
   counter<0||officialCounter<0||counter>TRIAL_TICK_LIMIT||
   officialCounter>TRIAL_TICK_LIMIT||counter!==officialCounter)
   throw Error("invalid_or_mismatched_trial_lifecycle_counters");
 if(!manifest.published){
  if(counter!==0||runtimeState?.phase==="trial_complete_awaiting_review"||
    manifest?.trialStatus==="complete_awaiting_review")
   throw Error("trial_state_without_published_t0");
  return {phase:"official_t0_baseline",trialEligible:false,trialComplete:false};
 }
 const isTerminal=counter===TRIAL_TICK_LIMIT;
 if(isTerminal){
  if(runtimeState?.phase!=="trial_complete_awaiting_review" ||
    manifest?.trialStatus!=="complete_awaiting_review" ||
    manifest?.trialEligible!==false)
   throw Error("terminal_trial_phase_or_manifest_inconsistent");
  return {phase:"trial_complete_awaiting_review",trialEligible:false,trialComplete:true};
 }
 if(runtimeState?.phase==="trial_complete_awaiting_review" ||
    manifest?.trialStatus==="complete_awaiting_review")
  throw Error("trial_marked_complete_before_terminal_tick");
 return {phase:"trial",trialEligible:gatePassed===true,trialComplete:false};
}
