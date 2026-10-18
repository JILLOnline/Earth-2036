#!/usr/bin/env node
// Read-only persistence preflight: no canonical repair or recovery writes.
import {auditTrialTickHistory} from "./lib/trial-tick-history-audit.mjs";
import {readTrialArchive,trialArchiveRoot} from "./lib/trial-archive-reader.mjs";
const {state,manifest,ticks}=await readTrialArchive(trialArchiveRoot());
const audit=auditTrialTickHistory({state,manifest,ticks});
console.log(JSON.stringify({contract:"earth2036-trial-persistence-preflight-v1",...audit}));
if(!audit.passed)process.exitCode=1;
