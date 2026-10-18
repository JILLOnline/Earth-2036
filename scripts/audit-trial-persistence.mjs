#!/usr/bin/env node
// Read-only persistence preflight: no canonical repair or recovery writes.
import {readFile} from "node:fs/promises";
import path from "node:path";
import {auditTrialTickHistory} from "./lib/trial-tick-history-audit.mjs";
import {buildTrialReviewReport} from "./lib/trial-review-report.mjs";
import {readTrialArchive,trialArchiveRoot} from "./lib/trial-archive-reader.mjs";
const root=trialArchiveRoot();
const {state,manifest,ticks}=await readTrialArchive(root);
const audit=auditTrialTickHistory({state,manifest,ticks});
const errors=[...audit.errors];
if(audit.passed && state.qualifiedTrialTicks===1000){
 try{
  const receipt=JSON.parse(await readFile(path.join(root,"data/runtime/trial-review-report.json"),"utf8"));
  const expected=buildTrialReviewReport({state,manifest,ticks,generatedAt:receipt.generatedAt});
  if(!expected.captureComplete || JSON.stringify(receipt)!==JSON.stringify(expected))
   errors.push("terminal_trial_review_receipt_mismatch");
 }catch(error){
  errors.push("terminal_trial_review_receipt_missing_or_corrupt");
 }
}
const passed=errors.length===0;
console.log(JSON.stringify({contract:"earth2036-trial-persistence-preflight-v1",...audit,passed,errors}));
if(!passed)process.exitCode=1;
