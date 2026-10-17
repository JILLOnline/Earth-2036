import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {determineTickFinalization} from "../scripts/lib/tick-authority.mjs";
import {auditTrialTickHistory} from "../scripts/lib/trial-tick-history-audit.mjs";
import {buildTrialReviewReport} from "../scripts/lib/trial-review-report.mjs";
const cycle=n=>new Date(Date.UTC(2026,0,1,n)).toISOString().slice(0,13).replace(/-/g,"")+"00Z";
test("T0 to first tick, completion hold, and report share a consistent contract",()=>{
 const state={phase:"trial",qualifiedTrialTicks:0,lastQualifiedCycleKey:null};
 const manifest={published:true,qualifiedTrialTicksAfterBaseline:0};
 const ticks=[];
 assert.deepEqual(determineTickFinalization({cycleKey:cycle(0),qualified:true,state,manifest,existingTick:null}),{action:"finalize",tickNumber:1});
 ticks.push({cycleKey:cycle(0),tickNumber:1,trajectory:{validation:{passed:true},horizons:[]}});
 state.qualifiedTrialTicks=1;state.lastQualifiedCycleKey=cycle(0);manifest.qualifiedTrialTicksAfterBaseline=1;
 assert.equal(auditTrialTickHistory({state,manifest,ticks}).passed,true);
 assert.equal(buildTrialReviewReport({state,manifest,ticks}).captureComplete,false);
 const second=determineTickFinalization({cycleKey:cycle(1),qualified:false,state,manifest,existingTick:null});
 assert.equal(second.action,"not_qualified");
 assert.equal(state.qualifiedTrialTicks,1);
});
test("scheduler uses one Git commit after the new independent audit",async()=>{
 const y=await readFile(new URL("../.github/workflows/earth2036-scheduler.yml",import.meta.url),"utf8");
 assert.match(y,/concurrency:[\s\S]*group: earth2036-machine-engine[\s\S]*cancel-in-progress: false/);
 assert.ok(y.indexOf("node scripts/audit-trial-persistence.mjs")<y.indexOf("git add data"));
 assert.match(y,/git push origin HEAD:main/);
});
test("read-only review CLI does not write or promote canonical state",async()=>{
 const r=await readFile(new URL("../scripts/report-trial-review.mjs",import.meta.url),"utf8");
 assert.match(r,/buildTrialReviewReport/);
 assert.doesNotMatch(r,/writeFile|appendFile|git push|promote-chief-ready/);
});
