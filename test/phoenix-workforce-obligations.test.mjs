import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildWorkforceObligations} from "../scripts/lib/phoenix-workforce-obligations.mjs";

const sample=()=>({
  assistViews:{
    "earth-scout":{requests:[{requestId:"assist:MWA:resolver:earth-scout:source",inputSignature:"sig1",ticker:"MWA",helperRole:"earth-scout",rootOwner:"deep-resolver",status:"active",exactQuestion:"Get independent primary evidence",priority:190,packetPath:"data/runtime/workgraph/packets/MWA.json"}]},
    "council-beta":{requests:[{requestId:"assist:SWKS:alpha:beta:risk",inputSignature:"sig2",ticker:"SWKS",helperRole:"council-beta",rootOwner:"council-alpha",status:"active",priority:170}]},
  },
  routingViews:{
    "council-alpha":{items:[{ticker:"AEVA",packetPath:"data/runtime/workgraph/packets/AEVA.json",rank:1,ownedFailures:["missing_factor_evidence","missing_numeric_score_record"],evidencePaths:["data/runtime/workgraph/evidence/AEVA.json"]}]},
    "deep-resolver":{items:[],deferredItems:[{ticker:"MWA"}]},
  },
  sourceDependencyHandoffs:{selected:[{
    ticker:"MWA",researchId:"source-dependency:MWA:resolver-claim-pair",
    sourceOwner:"earth-scout",rootOwner:"deep-resolver",signature:"s123",
    taskExecutionAuthorized:false,isActionableResolverContradiction:false,
    exactMissingFacts:["independent claim pair"],
  }]},
});

test("source assistance and Alpha underwriting retain separate ownership and authority",()=>{
  const out=buildWorkforceObligations(sample());
  assert.equal(out.total,4);
  assert.equal(out.actionableWithoutWorkerAck,0);
  assert.ok(out.selected.some(x=>x.owner==="council-alpha" && x.kind==="owned_route"));
  assert.ok(out.selected.some(x=>x.owner==="earth-scout" && x.kind==="source_assist"));
  assert.ok(out.selected.every(x=>x.executionAuthorized===false && x.canonicalWritesAuthorized===false));
});
test("GitHub-only projection never assumes a task is enabled or acknowledged",()=>{
  const out=buildWorkforceObligations(sample());
  assert.equal(out.rosterStatus,"not_available_from_repository");
  assert.equal(out.byStatus.executor_state_unverified,3);
  assert.equal(out.byStatus.awaiting_verified_source_and_worker_clearance,1);
});
test("explicit disabled worker changes report, never restarts or reroutes work",()=>{
  const out=buildWorkforceObligations({...sample(),roster:{"earth-scout":{enabled:false},"council-alpha":{enabled:false},"council-beta":{enabled:true}}});
  assert.ok(out.selected.some(x=>x.owner==="earth-scout" && x.status==="requires_disable_reason_review"));
  assert.ok(out.selected.some(x=>x.owner==="council-beta" && x.status==="awaiting_explicit_worker_acknowledgement"));
  assert.equal(out.governance.workerRestart,false);
  assert.equal(out.governance.automaticTaskAssignment,false);
});
test("known safety hold requires review and never becomes changed-strategy workaround",()=>{
  const out=buildWorkforceObligations({...sample(),roster:{"earth-scout":{enabled:false,clearance:"safety_hold"}}});
  assert.ok(out.selected.some(x=>x.kind==="source_assist" && x.status==="requires_safety_review"));
  assert.ok(out.selected.some(x=>x.kind==="deferred_source_dependency" && x.executionAuthorized===false));
});
test("unsourced Resolver conflict is a deferred Scout dependency, not actionable Resolver task",()=>{
  const out=buildWorkforceObligations(sample());
  const dep=out.selected.find(x=>x.kind==="deferred_source_dependency");
  assert.equal(dep.owner,"earth-scout");
  assert.equal(dep.status,"awaiting_verified_source_and_worker_clearance");
  assert.equal(dep.materialityVerified,false);
  assert.equal(out.selected.some(x=>x.kind==="owned_route" && x.owner==="deep-resolver"),false);
});
test("invalid or accidentally authorized dependency fails closed",()=>{
  const input=sample();
  input.sourceDependencyHandoffs.selected[0].taskExecutionAuthorized=true;
  assert.throws(()=>buildWorkforceObligations(input),/phoenix_unsafe_source_dependency_admission/);
});
test("untraceable request is not assigned as legitimate work",()=>{
  const input=sample();delete input.assistViews["earth-scout"].requests[0].inputSignature;
  assert.throws(()=>buildWorkforceObligations(input),/phoenix_invalid_source_assist_contract/);
});
test("duplicated active source requests cannot inflate throughput",()=>{
  const input=sample();
  input.assistViews["earth-scout"].requests.push({...input.assistViews["earth-scout"].requests[0]});
  assert.throws(()=>buildWorkforceObligations(input),/phoenix_duplicate_obligation_id/);
});
test("receiptless GitHub queue cannot claim source write or acknowledgement",()=>{
  const out=buildWorkforceObligations(sample());
  assert.ok(out.selected.every(x=>x.acknowledged===false && x.evidenceCommitted===false));
});
test("same unchanged input keeps the same obligation fingerprint",()=>{
  const first=buildWorkforceObligations({...sample(),generatedAt:"2026-10-17T12:00:00Z"});
  const second=buildWorkforceObligations({...sample(),generatedAt:"2026-10-17T13:00:00Z"});
  assert.deepEqual(first.compact,second.compact);
});
test("worker shadow is wired to existing closure workflow without new scheduled job",async()=>{
  const workflow=await readFile(new URL("../.github/workflows/earth2036-closure-invariants.yml",import.meta.url),"utf8");
  assert.match(workflow,/node scripts\/phoenix-workforce-inspect\.mjs/);
  assert.match(workflow,/continue-on-error: true/);
});
