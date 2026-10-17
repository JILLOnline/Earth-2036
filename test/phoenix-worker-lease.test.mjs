import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {buildWorkforceObligations} from "../scripts/lib/phoenix-workforce-obligations.mjs";
import {advanceWorkerLeaseLedger,validateWorkerAck,WORKER_ACK_CONTRACT} from "../scripts/lib/phoenix-worker-lease.mjs";

const at="2026-10-17T16:00:00Z";
const first=()=>buildWorkforceObligations({
  assistViews:{"earth-scout":{requests:[{status:"active",ticker:"AEVA",helperRole:"earth-scout",
    rootOwner:"council-alpha",requestId:"assist:AEVA:alpha:scout:source",inputSignature:"known123",
    priority:200,packetPath:"data/runtime/workgraph/packets/AEVA.json"}]}},
  routingViews:{"council-alpha":{items:[{ticker:"AEVA",rank:1,
    packetPath:"data/runtime/workgraph/packets/AEVA.json",
    ownedFailures:["missing_factor_evidence"],evidencePaths:[]}]}},
  sourceDependencyHandoffs:{selected:[{ticker:"MWA",sourceOwner:"earth-scout",rootOwner:"deep-resolver",
    researchId:"source-dependency:MWA:resolver-claim-pair",signature:"mwa-source-gap",
    taskExecutionAuthorized:false,isActionableResolverContradiction:false}]},
});
const tPlus = mins => new Date(Date.parse(at)+mins*60000).toISOString();
const origin={path:"data/operations/phoenix/worker-acks/a.json",
  byteSha256:createHash("sha256").update("original committed test bytes").digest("hex")};
const ack=(ob,where=at)=>({
  contract:WORKER_ACK_CONTRACT,version:1,obligationId:ob.id,owner:ob.owner,
  requestId:ob.requestId,inputSignature:ob.inputSignature,ticker:ob.ticker,
  acknowledgedAt:where,disposition:"accepted_for_review",newEvidencePaths:[],
});
const assess=(obligations=first(),prev=null,acks=[],now=at)=>
  advanceWorkerLeaseLedger(obligations,prev,acks,now);

test("new queued source requests are not acknowledged or considered working",()=>{
  const v=assess();
  assert.equal(v.count,3);
  assert.equal(v.byStatus.awaiting_acknowledgment,2);
  assert.equal(v.byStatus.blocked_deferred_source_dependency,1);
  assert.ok(v.entries.every(x=>!x.automaticRetryPermitted && !x.evidenceValidated));
});
test("same input fingerprint preserves first seen across Workgraph regeneration",()=>{
  const a=assess();
  const b=assess(first(),a,[],tPlus(45));
  const row=b.entries.find(x=>x.ticker==="AEVA" && x.kind==="source_assist");
  assert.equal(row.firstSeenAt,new Date(at).toISOString());
  assert.equal(row.leaseDurationMinutes,45);
});
test("unacknowledged source request becomes overdue without autorun or restart",()=>{
  const a=assess();
  const b=assess(first(),a,[],tPlus(121));
  assert.equal(b.byStatus.unacknowledged_overdue_needs_review,2);
  assert.equal(b.governance.workerResume,false);
  assert.equal(b.governance.rejectedWriteRetry,false);
});
test("matching persisted acknowledgement remains unauthenticated role assertion",()=>{
  const o=first(),item=o.allObligations.find(x=>x.kind==="source_assist");
  const v=assess(o,null,[{data:ack(item),origin}],tPlus(15));
  const row=v.entries.find(x=>x.id===item.id);
  assert.equal(row.status,"ack_recorded_identity_unverified");
  assert.equal(row.ack.reason,"self_declared_ack_matches_obligation");
  assert.equal(row.workerIdentityAuthenticated,false);
  assert.equal(row.workgraphClosureConfirmed,false);
});
test("new source path is a claim, not independently validated evidence",()=>{
  const o=first(),item=o.allObligations.find(x=>x.kind==="source_assist");
  const data=ack(item);data.newEvidencePaths=["data/runtime/workgraph/evidence/AEVA-20261017-earth-scout.json"];
  const v=assess(o,null,[{data,origin}],tPlus(15));
  assert.equal(v.entries.find(x=>x.id===item.id).status,"evidence_claim_unvalidated");
  assert.equal(v.entries.find(x=>x.id===item.id).evidenceValidated,false);
});
test("changed input signature invalidates prior acknowledgement",()=>{
  const o=first(),item=o.allObligations.find(x=>x.kind==="source_assist");
  const data=ack(item);data.inputSignature="outdated";
  const v=assess(o,null,[{data,origin}],tPlus(15));
  assert.equal(v.entries.find(x=>x.id===item.id).status,"invalid_ack_needs_review");
  assert.equal(v.entries.find(x=>x.id===item.id).reason,"ack_target_or_input_mismatch");
});
test("stale acknowledgement cannot renew an expired worker lease",()=>{
  const o=first(),item=o.allObligations.find(x=>x.kind==="source_assist");
  const v=assess(o,null,[{data:ack(item),origin}],tPlus(121));
  assert.equal(v.entries.find(x=>x.id===item.id).status,"invalid_ack_needs_review");
});
test("duplicate claimed acknowledgments require manual review rather than accepted work",()=>{
  const o=first(),item=o.allObligations.find(x=>x.kind==="source_assist");
  const v=assess(o,null,[{data:ack(item),origin},{data:ack(item),origin}],tPlus(15));
  assert.equal(v.entries.find(x=>x.id===item.id).status,"conflicting_acks_needs_review");
});
test("source request disappearing from Workgraph is not proof of completion",()=>{
  const previous=assess(first());
  const o=first();o.allObligations=o.allObligations.filter(x=>x.ticker!=="AEVA");
  const updated=assess(o,previous,[],tPlus(60));
  assert.equal(updated.byStatus.no_longer_routed_unverified,2);
  assert.equal(updated.entries.find(x=>x.kind==="owned_route").evidenceValidated,false);
});
test("known safety hold is never overridden even by a matching receipt",()=>{
  const o=first(),item=o.allObligations.find(x=>x.kind==="source_assist");
  item.status="requires_safety_review";
  const v=assess(o,null,[{data:ack(item),origin}],tPlus(15));
  assert.equal(v.entries.find(x=>x.id===item.id).status,"blocked_safety_hold");
});
test("deferred MWA never becomes a Resolver adjudication job through an ack",()=>{
  const o=first(),item=o.allObligations.find(x=>x.kind==="deferred_source_dependency");
  const v=assess(o,null,[{data:ack(item),origin}],tPlus(15));
  assert.equal(v.entries.find(x=>x.id===item.id).status,"blocked_deferred_source_dependency");
});
test("unverified Git receipt path is not accepted as persisted acknowledgment",()=>{
  const o=first(),item=o.allObligations.find(x=>x.kind==="source_assist");
  const result=validateWorkerAck(ack(item),item,tPlus(10),{path:"tmp/uncommitted.json",byteSha256:origin.byteSha256});
  assert.equal(result.valid,false);
});
test("illegal future first-seen time fails rather than resetting due date",()=>{
  const previous=assess();
  previous.entries[0].firstSeenAt=tPlus(180);
  assert.throws(()=>assess(first(),previous,[],at),/phoenix_future_or_invalid_lease_first_seen/);
});
test("hourly accountability, not a sixth automation, persists the operational lease",async()=>{
  const yaml=await readFile(new URL("../.github/workflows/earth2036-hourly-accountability.yml",import.meta.url),"utf8");
  assert.match(yaml,/node scripts\/phoenix-worker-leases\.mjs/);
  assert.match(yaml,/git add data\/operations\/phoenix/);
});
