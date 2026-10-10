import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { reconcilePastSlots } from "../scripts/reconcile-hourly-slots.mjs";
import { parseCycleHistory } from "../scripts/hourly-accountability.mjs";

const check="2026-10-09T16:20:00.000Z";
const key="20261009T1400Z";
const obs={cycleKey:key,lastCycleAt:"2026-10-09T14:50:00Z",cycleStatus:"completed",phase:"official_t0_baseline",qualifiedTick:false,companiesObserved:250};
const run={id:12,path:".github/workflows/earth2036-scheduler.yml",created_at:"2026-10-09T14:02:00Z",conclusion:"success",status:"completed"};
const input=(cycles=[],receipts={},runs=[run],error=null)=>({
 cycleHistory:parseCycleHistory(cycles.map(x=>JSON.stringify(x)).join("\n")),
 asOfReceipts:receipts,workflowRuns:runs,checkedAt:check,windowHours:2,runLookupError:error
});
test("reconciles 2 completed UTC slots with no fabricated prior observation",()=>{
 const a=reconcilePastSlots(input());
 assert.equal(a.counts.slots,2);
 assert.equal(a.counts.slotsWithoutObservation,2);
 assert.equal(a.counts.missingAsOfReceipts,2);
 assert.equal(a.rows[0].hourKey,"20261009T1400Z");
 assert.equal(a.rows[0].qualifiedTrialTickAsObserved,null);
 assert.equal(a.governance.backfillsObservations,false);
});
test("late observation supplements immutable as-of missing receipt with no rewrite",()=>{
 const a=reconcilePastSlots(input([obs],{[key]:{
   observationStatus:"missing_as_of_audit",sha256:"a".repeat(64),path:"data/operations/hourly-audits/2026/10/09/"+key+".json",
 }}));
 const row=a.rows.find(x=>x.hourKey===key);
 assert.equal(row.asOfObservationStatus,"missing_as_of_audit");
 assert.equal(row.retrospectiveObservationStatus,"persisted_now");
 assert.equal(row.qualifiedTrialTickAsObserved,false);
 assert.ok(row.issues.includes("late_persistence_after_as_of_audit"));
 assert.equal(row.asOfReceiptSha256,"a".repeat(64));
});
test("failed scheduler remains distinguishable from absent or partial observation",()=>{
 const failed={...run,conclusion:"failure"};
 const a=reconcilePastSlots(input([],{ },[failed]));
 assert.ok(a.rows[0].issues.includes("scheduler_failed_or_timed_out"));
 assert.ok(a.rows[0].issues.includes("no_persisted_observation_for_hour_as_of_audit"));
});
test("unavailable GitHub lookup is UNKNOWN, never asserted no workflow",()=>{
 const a=reconcilePastSlots(input([],{ },[],"GitHub 403"));
 assert.equal(a.schedulerRunLookup.status,"unavailable");
 assert.equal(a.rows[0].schedulerLookup.status,"unavailable");
 assert.equal(a.rows[0].issues.includes("no_scheduler_run_created_in_slot"),false);
});
test("window cannot include incomplete current hour and does not exceed bounded maximum",()=>{
 const x=reconcilePastSlots({...input(),windowHours:900});
 assert.equal(x.windowHours,168);
 assert.equal(x.rows.at(-1).hourKey,"20261009T1500Z");
});
test("audit workflow computes reconciliation but does not replace immutable as-of receipts",async()=>{
 const s=await readFile(new URL("../.github/workflows/earth2036-hourly-accountability.yml",import.meta.url),"utf8");
 assert.match(s,/node scripts\/hourly-accountability\.mjs/);
 assert.match(s,/node scripts\/reconcile-hourly-slots\.mjs/);
 assert.match(s,/hourly-reconciliation\/latest\.json/);
});

test("missing observation with no created scheduler is not called a Git write failure",()=>{
 const a=reconcilePastSlots(input([],{},[]));
 assert.equal(a.counts.missingWithoutSchedulerRun,2);
 assert.equal(a.counts.missingAfterFailedScheduler,0);
 assert.equal(a.rows[0].missingObservationClassification,"scheduler_run_not_created_in_slot");
 assert.equal(a.rows[0].gitWriteFailureVerified,false);
});
test("failed scheduler and successful scheduler without an observation are separate unproven outcomes",()=>{
 const fail=reconcilePastSlots(input([],{},[{...run,conclusion:"failure"}]));
 assert.equal(fail.rows[0].missingObservationClassification,"scheduler_run_failed_cause_unverified");
 assert.equal(fail.counts.missingAfterFailedScheduler,1);
 const success=reconcilePastSlots(input());
 assert.equal(success.rows[0].missingObservationClassification,"scheduler_succeeded_without_original_observation");
 assert.equal(success.counts.missingAfterSuccessfulScheduler,1);
});
test("outage is explicitly unknown rather than inventing an absent scheduler or failed push",()=>{
 const a=reconcilePastSlots(input([],{},[],"GitHub 403"));
 assert.equal(a.rows[0].missingObservationClassification,"scheduler_lookup_unavailable");
 assert.equal(a.counts.missingWithSchedulerLookupUnavailable,2);
});
