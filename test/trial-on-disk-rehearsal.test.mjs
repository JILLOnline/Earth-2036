import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,unlink,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {buildTrialReviewReport} from "../scripts/lib/trial-review-report.mjs";
import {sealTrialTick} from "../scripts/lib/trial-tick-seal.mjs";

const auditScript=fileURLToPath(new URL("../scripts/audit-trial-persistence.mjs",import.meta.url));
const reportScript=fileURLToPath(new URL("../scripts/report-trial-review.mjs",import.meta.url));
const manifestPath="data/baselines/earth2036-official-t0-2026-09-12/manifest.json";
const statePath="data/runtime/system-state.json";
const cycle=i=>new Date(Date.UTC(2026,0,1,i)).toISOString().slice(0,13).replace(/-/g,"")+"00Z";
const fixtureRankings=Array.from({length:250},(_,i)=>({ticker:"SYN"+String(i+1).padStart(3,"0"),rank:i+1,earthScore:60,risk:20,dataConfidence:75}));
const save=async(root,name,value)=>{
 const target=join(root,name);
 await mkdir(dirname(target),{recursive:true});
 await writeFile(target,JSON.stringify(value)+"\n");
};
const run=(script,root)=>spawnSync(process.execPath,[script,"--root",root],{
 encoding:"utf8",timeout:45000,maxBuffer:2*1024*1024,
});

test("disk-backed rehearsal: 1000 ticks, report, crash boundaries, and read-only outcomes", {timeout:120000},async()=>{
 const root=await mkdtemp(join(tmpdir(),"earth2036-isolated-rehearsal-"));
 try{
  const ticks=Array.from({length:1000},(_,i)=>({
   tickNumber:i+1,cycleKey:cycle(i),capturedAt:new Date(Date.UTC(2026,0,1,i)).toISOString(),
   methodologyVersion:"1.0.0",universeVersion:"u1-250",
   rankings:fixtureRankings,
   trajectory:{validation:{passed:true},horizons:[12,24,36,60].map(months=>({months,outcomeStatus:"pending"}))},
  })).reduce((acc,tick)=>{
   acc.push(sealTrialTick(tick,acc.at(-1)?.tickRecordHash??null));
   return acc;
  },[]);
  for(let offset=0;offset<1000;offset+=40){
   await Promise.all(ticks.slice(offset,offset+40).map(tick=>
    save(root,"data/runtime/ticks/"+tick.cycleKey+".json",tick)));
  }
  const state={phase:"trial_complete_awaiting_review",qualifiedTrialTicks:1000,lastQualifiedCycleKey:cycle(999)};
  const manifest={baselineId:"synthetic-rehearsal-only",published:true,methodologyVersion:"1.0.0",
   universeVersion:"u1-250",qualifiedTrialTicksAfterBaseline:1000,trialStatus:"complete_awaiting_review"};
  await save(root,statePath,state);await save(root,manifestPath,manifest);
  const receipt=buildTrialReviewReport({state,manifest,ticks,generatedAt:"2026-02-12T12:00:00.000Z"});
  assert.equal(receipt.captureComplete,true);
  await save(root,"data/runtime/trial-review-report.json",receipt);

  const audit=run(auditScript,root);
  assert.equal(audit.status,0,audit.stderr||audit.stdout);
  assert.equal(JSON.parse(audit.stdout).passed,true);
  const report=run(reportScript,root);
  assert.equal(report.status,0,report.stderr||report.stdout);
  const result=JSON.parse(report.stdout);
  assert.equal(result.captureComplete,true);
  assert.equal(result.qualifiedTicks,1000);
  assert.equal(result.trajectoryObservationHorizons.length,4);
  assert.equal(result.trajectoryObservationHorizons[0].pending,1000);
  assert.equal(result.forecastEvaluation.evaluatedPredictions,0);

  // A perfectly numbered immutable archive with modified content must fail.
  await save(root,"data/runtime/ticks/"+cycle(500)+".json",{...ticks[500],rankings:[{ticker:"SYN001",rank:1}]});
  const modifiedTick=run(auditScript,root);
  assert.equal(modifiedTick.status,1);
  assert.ok(JSON.parse(modifiedTick.stdout).errors.includes("trial_tick_content_hash_mismatch"));
  await save(root,"data/runtime/ticks/"+cycle(500)+".json",ticks[500]);

  // Trial-complete must not pass with a missing or forged review receipt.
  await unlink(join(root,"data/runtime/trial-review-report.json"));
  const missingReceipt=run(auditScript,root);
  assert.equal(missingReceipt.status,1);
  assert.ok(JSON.parse(missingReceipt.stdout).errors.includes("terminal_trial_review_receipt_missing_or_corrupt"));
  await save(root,"data/runtime/trial-review-report.json",{...receipt,reportHash:"0".repeat(64)});
  const forgedReceipt=run(auditScript,root);
  assert.equal(forgedReceipt.status,1);
  assert.ok(JSON.parse(forgedReceipt.stdout).errors.includes("terminal_trial_review_receipt_mismatch"));
  await save(root,"data/runtime/trial-review-report.json",receipt);

  // Simulate a failed process between creating tick #1000 and updating counters.
  await save(root,statePath,{...state,phase:"trial",qualifiedTrialTicks:999,lastQualifiedCycleKey:cycle(998)});
  await save(root,manifestPath,{...manifest,qualifiedTrialTicksAfterBaseline:999,trialStatus:null});
  const extra=run(auditScript,root);
  assert.equal(extra.status,1,extra.stderr||extra.stdout);
  assert.ok(JSON.parse(extra.stdout).errors.includes("immutable_tick_file_count_mismatch"));
  const heldReport=run(reportScript,root);
  assert.equal(heldReport.status,1,heldReport.stderr||heldReport.stdout);
  assert.equal(JSON.parse(heldReport.stdout).captureComplete,false);

  // Simulate counters committing while the final immutable tick was lost.
  await save(root,statePath,state);await save(root,manifestPath,manifest);
  await unlink(join(root,"data/runtime/ticks/"+cycle(999)+".json"));
  const missing=run(auditScript,root);
  assert.equal(missing.status,1,missing.stderr||missing.stdout);
  assert.ok(JSON.parse(missing.stdout).errors.includes("immutable_tick_file_count_mismatch"));

  // This test only operates on an isolated synthetic root, never on GitHub main.
  assert.equal(JSON.parse(await readFile(join(root,manifestPath),"utf8")).qualifiedTrialTicksAfterBaseline,1000);
 }finally{await rm(root,{recursive:true,force:true})}
});
