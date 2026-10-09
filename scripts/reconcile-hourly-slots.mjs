#!/usr/bin/env node
// Retrospective, read-only reconciliation. Never create or revise an observation,
// qualified tick, as-of audit, score record or historical scheduler run.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assessHour, hourKeyFromDate, auditReceiptPath, parseCycleHistory } from "./hourly-accountability.mjs";
const ROOT=process.cwd();
const digest = content => createHash("sha256").update(content).digest("hex");

export function reconcilePastSlots({cycleHistory,asOfReceipts,workflowRuns,checkedAt,windowHours=72,runLookupError=null}) {
  const now=new Date(checkedAt);
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid reconciliation time");
  const hours=Math.max(1,Math.min(168,Math.trunc(windowHours)));
  const currentHour=new Date(now.getTime());currentHour.setUTCMinutes(0,0,0);
  const rows=[];
  for(let back=hours;back>=1;back--){
    const key=hourKeyFromDate(new Date(currentHour.getTime()-back*3600000));
    const retro=assessHour({hourKey:key,cycleHistory,workflowRuns,checkedAt,runLookupError});
    const immutable=asOfReceipts[key]||null;
    const asOf=immutable?.observationStatus || "no_as_of_receipt";
    const retrospect=retro.observationStatus==="persisted"?"persisted_now":"still_missing";
    const amended=asOf==="missing_as_of_audit" && retrospect==="persisted_now";
    const issueCodes=[
      ...retro.issues,
      ...(immutable ? [] : ["as_of_receipt_missing"]),
      ...(amended ? ["late_persistence_after_as_of_audit"] : []),
    ];
    rows.push({
      hourKey:key,asOfObservationStatus:asOf,retrospectiveObservationStatus:retrospect,
      asOfReceiptSha256:immutable?.sha256||null,
      asOfReceiptPath:immutable?.path||null,
      cycleHistoryLine:retro.observation?.sourceLine ?? null,
      sourceLineSha256:retro.observation?.sourceLineSha256 ?? null,
      schedulerRuns:retro.schedulerRunsCreatedInHour,
      schedulerLookup:retro.schedulerLookup,
      issues:[...new Set(issueCodes)],
      qualifiedTrialTickAsObserved:retro.observation?.qualifiedTrialTick ?? null,
      rule:"Only the original cycle-history is evidence of an actual observation; this row never backfills it.",
    });
  }
  return {
    version:1,contract:"earth2036-retrospective-hourly-reconciliation-v1",
    mode:"retrospective_read_only",checkedAt,windowHours:hours,
    governance:{canonicalWrites:false,scoreWrites:false,tickWrites:false,asOfReceiptMutation:false,backfillsObservations:false},
    schedulerRunLookup:runLookupError?{status:"unavailable",error:String(runLookupError).slice(0,300)}:{status:"available"},
    counts:{
      slots:rows.length,observationsPersistedNow:rows.filter(x=>x.retrospectiveObservationStatus==="persisted_now").length,
      slotsWithoutObservation:rows.filter(x=>x.retrospectiveObservationStatus==="still_missing").length,
      missingAsOfReceipts:rows.filter(x=>x.asOfObservationStatus==="no_as_of_receipt").length,
      latePersistedObservations:rows.filter(x=>x.issues.includes("late_persistence_after_as_of_audit")).length,
      failedSchedulerSlots:rows.filter(x=>x.issues.includes("scheduler_failed_or_timed_out")).length,
    },rows,
    warning:"A missing persisted observation is not proof a scheduler did not run. Retrospective records never qualify trial ticks.",
  };
}
async function readReceipt(key){
 const p=auditReceiptPath(key),filename=path.join(ROOT,p);
 try{
  const raw=await readFile(filename,"utf8");
  return {path:p,sha256:digest(raw),...JSON.parse(raw)};
 }catch(error){
  if(error.code==="ENOENT")return null;
  throw error;
 }
}
async function loadRuns(){
 const repo=process.env.GITHUB_REPOSITORY||"JILLOnline/Earth-2036";
 const runs=[];const seen=new Set();
 for(let page=1;page<=10;page++){
   const data=execFileSync("gh",["api",
     "repos/"+repo+"/actions/workflows/earth2036-scheduler.yml/runs?per_page=100&page="+page,
     "--jq","[.workflow_runs[] | {id, path,created_at,run_started_at,updated_at,event,status,conclusion,run_attempt,head_sha,html_url}]"
   ],{encoding:"utf8",timeout:30000,maxBuffer:16*1024*1024});
   const batch=JSON.parse(data);
   if(!Array.isArray(batch))throw new Error("Invalid GitHub runs page");
   for(const item of batch)if(!seen.has(item.id)){runs.push(item);seen.add(item.id)}
   if(batch.length<100)return runs;
 }
 throw new Error("GitHub scheduler pagination exceeded 10 pages; refuse incomplete coverage");
}
async function main(){
 const now=new Date(),windowHours=Number(process.env.EARTH_RECONCILE_WINDOW_HOURS||72);
 const text=await readFile(path.join(ROOT,"data/runtime/cycle-history.jsonl"),"utf8");
 const history=parseCycleHistory(text);const receipts={};
 const start=new Date(now);start.setUTCMinutes(0,0,0);
 for(let back=1;back<=Math.min(168,Math.max(1,Math.trunc(windowHours)));back++){
  const key=hourKeyFromDate(new Date(start.getTime()-back*3600000));
  const receipt=await readReceipt(key);if(receipt)receipts[key]=receipt;
 }
 let runs=[],runLookupError=null;
 try{runs=await loadRuns()}catch(e){runLookupError=e.message}
 const report=reconcilePastSlots({cycleHistory:history,asOfReceipts:receipts,workflowRuns:runs,checkedAt:now.toISOString(),windowHours,runLookupError});
 const outfile=path.join(ROOT,"data/operations/hourly-reconciliation/latest.json");
 await mkdir(path.dirname(outfile),{recursive:true});
 await writeFile(outfile,JSON.stringify(report,null,2)+"\n","utf8");
 console.log(JSON.stringify({contract:report.contract,counts:report.counts,runLookup:report.schedulerRunLookup},null,2));
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e);process.exitCode=1});
