import {createHash} from "node:crypto";
import {auditTrialTickHistory} from "./trial-tick-history-audit.mjs";
export const TRIAL_REPORT_CONTRACT="earth2036-trial-review-report-v1";
const sha=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function buildTrialReviewReport({manifest,state,ticks=[],generatedAt}={}){
 const history=auditTrialTickHistory({state,manifest,ticks});
 const complete=history.passed && history.qualifiedTicks===1000 &&
  state?.phase==="trial_complete_awaiting_review" &&
  manifest?.trialStatus==="complete_awaiting_review";
 const ordered=[...ticks].sort((a,b)=>a.tickNumber-b.tickNumber);
 const byHorizon=new Map();
 let invalidTrajectories=0;
 for(const tick of ordered){
  if(tick.trajectory?.validation?.passed!==true)invalidTrajectories++;
  for(const horizon of tick.trajectory?.horizons??[]){
   const key=String(horizon.months)+"m";
   const item=byHorizon.get(key)??{horizon:key,observations:0,pending:0,maturedVerified:0};
   item.observations++;
   // The trajectory's built-in pending outcome is not proof of maturity.
   item.pending++;
   byHorizon.set(key,item);
  }
 }
 const report={
  contract:TRIAL_REPORT_CONTRACT,mode:"read_only_review",
  generatedAt:generatedAt??null,baselineId:manifest?.baselineId??null,
  methodologyVersion:manifest?.methodologyVersion??null,
  universeVersion:manifest?.universeVersion??null,
  trialLimit:1000,qualifiedTicks:history.qualifiedTicks??null,
  immutableTickFiles:history.immutableTickFiles,
  historyPassed:history.passed,historyErrors:history.errors,
  captureComplete:complete,awaitingOwnerReassessment:complete,
  earliestCycle:ordered[0]?.cycleKey??null,
  latestCycle:ordered.at(-1)?.cycleKey??null,
  invalidTrajectorySnapshots:invalidTrajectories,
  trajectoryObservationHorizons:[...byHorizon.values()].sort((a,b)=>parseInt(a.horizon)-parseInt(b.horizon)),
  forecastEvaluation:{status:"not_available",reason:"forecast_models_disabled_in_trajectory_v1",
   requestedDayHorizons:[1,3,7,15,21,28],evaluatedPredictions:0,
   warning:"Tick capture completion does not establish mature forecast outcomes."},
  canonicalWriteAuthority:false,qualificationAuthority:false,autoRestartAuthorized:false,
 };
 return {...report,reportHash:sha(report)};
}
