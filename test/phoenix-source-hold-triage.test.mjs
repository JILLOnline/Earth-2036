import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildWorkforceObligations} from "../scripts/lib/phoenix-workforce-obligations.mjs";
import {advanceWorkerLeaseLedger} from "../scripts/lib/phoenix-worker-lease.mjs";
import {deriveSourceWriteHolds,assessWorkerResumption} from "../scripts/lib/phoenix-source-hold-triage.mjs";

const at="2026-10-17T16:00:00Z";
const base=()=>buildWorkforceObligations({
  assistViews:{"earth-scout":{requests:[
    {status:"active",ticker:"AEVA",helperRole:"earth-scout",rootOwner:"council-alpha",requestId:"assist:AEVA:council-alpha:earth-scout:source-acquisition",inputSignature:"sig-a",priority:200},
    {status:"active",ticker:"AEVA",helperRole:"earth-scout",rootOwner:"deep-resolver",requestId:"assist:AEVA:deep-resolver:earth-scout:contradiction-source-support",inputSignature:"sig-b",priority:190},
    {status:"active",ticker:"SWKS",helperRole:"earth-scout",rootOwner:"council-alpha",requestId:"assist:SWKS:council-alpha:earth-scout:source-acquisition",inputSignature:"sig-c",priority:180}
  ]}},
  routingViews:{"council-alpha":{items:[{ticker:"SWKS",rank:1,packetPath:"data/runtime/workgraph/packets/SWKS.json",ownedFailures:["missing_factor_evidence"]}]}},
});
const p="data/runtime/workgraph/receipts/AEVA-20261008T210501Z-earth-scout.json";
const q="data/runtime/workgraph/role-runs/council-alpha-20261006T091314Z.json";
const receipt={version:1,worker:"earth-scout",ticker:"AEVA",status:"evidence_write_blocked",evidenceCommit:"not_committed",generatedAt:at,assistRequestId:"assist:AEVA:council-alpha:earth-scout:source-acquisition"};
const roleRun={version:1,role:"council-alpha",target:"RIO",status:"blocked",generatedAt:at,attemptedArtifact:"data/runtime/workgraph/evidence/RIO-a.json",blocker:"GitHub evidence write rejected before repository mutation by safety checks."};
const fixture=()=>({catalog:{contract:"earth2036-phoenix-known-write-rejections-v1",records:[
  {kind:"exact_request",role:"earth-scout",ticker:"AEVA",requestId:receipt.assistRequestId,sourcePath:p},
  {kind:"target_unattributed",role:"council-alpha",ticker:"RIO",sourcePath:q}
]},sourceFiles:{[p]:JSON.stringify(receipt),[q]:JSON.stringify(roleRun)},obligations:base()});

test("verified exact historical safety hold is scoped to specific active request",()=>{
  const v=deriveSourceWriteHolds(fixture());
  assert.equal(v.currentExactRequestHolds.length,1);
  assert.equal(v.currentExactRequestHolds[0].currentMatchingObligationIds.length,1);
  assert.equal(v.currentExactRequestHolds[0].role,"earth-scout");
  assert.equal(v.anyWorkerResumeAuthorized,false);
});
test("separate Scout contradiction assist is not falsely attributed same rejected payload",()=>{
  const input=fixture(),v=deriveSourceWriteHolds(input);
  const ledger=advanceWorkerLeaseLedger(input.obligations,null,[],at,v.findings);
  const alpha=ledger.entries.find(x=>x.requestId===receipt.assistRequestId);
  const resolver=ledger.entries.find(x=>x.requestId==="assist:AEVA:deep-resolver:earth-scout:contradiction-source-support");
  assert.equal(alpha.status,"blocked_rejected_write_needs_review");
  assert.equal(resolver.status,"awaiting_acknowledgment");
  assert.ok(ledger.entries.every(x=>x.automaticRetryPermitted===false));
});
test("Alpha RIO rejected artifact is historical target scope, not arbitrary Alpha route hold",()=>{
  const v=deriveSourceWriteHolds(fixture());
  const alpha=v.findings.find(x=>x.role==="council-alpha");
  assert.equal(alpha.scope,"target_unattributed");
  assert.equal(alpha.currentMatchingObligationIds.length,0);
});
test("wrong request name does not turn false receipt into verified safety finding",()=>{
  const input=fixture();input.catalog.records[0].requestId="assist:AEVA:other";
  assert.throws(()=>deriveSourceWriteHolds(input),/phoenix_source_hold_exact_rejection_unverified/);
});
test("missing original source bytes fail closed instead of inventing clearance",()=>{
  const input=fixture();delete input.sourceFiles[p];
  assert.throws(()=>deriveSourceWriteHolds(input),/phoenix_source_hold_original_bytes_unavailable/);
});
test("original record cannot be swapped to a successful write while keeping hold label",()=>{
  const input=fixture();input.sourceFiles[p]=JSON.stringify({...receipt,status:"evidence_persisted",evidenceCommit:"some-commit"});
  assert.throws(()=>deriveSourceWriteHolds(input),/phoenix_source_hold_exact_rejection_unverified/);
});
test("path traversal or unknown source domain rejected",()=>{
  const input=fixture();input.catalog.records[0].sourcePath="../data/ops/fake.json";
  assert.throws(()=>deriveSourceWriteHolds(input),/phoenix_source_hold_record_invalid/);
});
test("duplicate safety evidence path rejected",()=>{
  const input=fixture();input.catalog.records.push({...input.catalog.records[0]});
  assert.throws(()=>deriveSourceWriteHolds(input),/phoenix_source_hold_duplicate_record/);
});
test("unknown task disablement never authorizes resumption",()=>{
  const r=assessWorkerResumption({role:"council-beta",taskState:{enabled:false}});
  assert.equal(r.decision,"hold_disabled");
  assert.equal(r.reason,"disable_cause_unverified");
});
test("actual safety hold blocks even with claimed benign transient",()=>{
  const r=assessWorkerResumption({role:"earth-scout",taskState:{enabled:false},disableCause:"transient_platform_interruption",
    clearance:{verified:true,source:"authorized_task_run_diagnostics",evidenceId:"report-1"},activeSafetyHold:true});
  assert.equal(r.reason,"unresolved_source_write_safety_hold");
});
test("explicit operator pause never becomes recoverable interruption",()=>{
  assert.equal(assessWorkerResumption({role:"council-beta",taskState:{enabled:false},disableCause:"operator_pause"}).decision,"hold_disabled");
});
test("verified benign interruption is only eligible for a separate approval, never an automatic restart",()=>{
  const a=assessWorkerResumption({role:"council-beta",taskState:{enabled:false},disableCause:"transient_platform_interruption",
    clearance:{verified:true,source:"authorized_task_run_diagnostics",evidenceId:"reliable-event-id"}});
  assert.equal(a.decision,"eligible_for_control_plane_review");
  assert.equal(a.workerRestartAuthorized,false);
});
test("CI report and hourly audit wired, no additional auto-resume task",async()=>{
  const c=await readFile(new URL("../.github/workflows/earth2036-closure-invariants.yml",import.meta.url),"utf8");
  const h=await readFile(new URL("../.github/workflows/earth2036-hourly-accountability.yml",import.meta.url),"utf8");
  assert.match(c,/scripts\/phoenix-source-hold-inspect\.mjs/);
  assert.match(h,/phoenix-worker-leases\.mjs/);
  assert.match(h,/push:\n\s+branches: \[main\]/);
});
