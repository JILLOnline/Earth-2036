#!/usr/bin/env node
// No network, no source mutation, no forecast inference: stdout only.
import {readTrialArchive,trialArchiveRoot} from "./lib/trial-archive-reader.mjs";
import {buildTrialReviewReport} from "./lib/trial-review-report.mjs";
const {state,manifest,ticks}=await readTrialArchive(trialArchiveRoot());
const report=buildTrialReviewReport({manifest,state,ticks,generatedAt:new Date().toISOString()});
console.log(JSON.stringify(report,null,2));
if(!report.historyPassed)process.exitCode=1;
