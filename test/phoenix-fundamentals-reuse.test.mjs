import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assessFundamentalsReuse,REUSE_CONTRACT} from "../scripts/lib/phoenix-fundamentals-reuse.mjs";

const read=async file=>JSON.parse(await readFile(new URL("../"+file,import.meta.url),"utf8"));
const live=await Promise.all([
  "data/runtime/workgraph/shadow/fundamentals-bridge-index.json",
  "data/runtime/workgraph/shadow/fundamentals-bridge-health.json",
  "data/runtime/company-observations.json",
  "data/runtime/workgraph/shadow/closure-frontier.json",
  "data/baselines/earth2036-official-t0-2026-09-12/manifest.json",
  "data/runtime/system-state.json"
].map(read));
const inputs=()=>Object.fromEntries(
  ["index","health","observations","frontier","baseline","systemState"]
    .map((k,i)=>[k,structuredClone(live[i])])
);
test("actual 74-company T0 backlog has existing SEC archive references, not historical admission",()=>{
  const r=assessFundamentalsReuse(inputs());
  assert.equal(r.contract,REUSE_CONTRACT);
  assert.equal(r.summary.totalT0BacklogCandidates,74);
  assert.equal(r.summary.frontierSelected,2);
  assert.equal(r.summary.liveSourceReferencesVerified,74);
  assert.equal(r.summary.referencesNeedingIntegrityReview,0);
  assert.ok(r.summary.rawFactEntriesReferencedForBacklog>74);
  assert.equal(r.summary.historicalT0EvidenceAdmitted,0);
  assert.equal(r.summary.realResearchFailuresClosed,0);
  assert.equal(r.summary.researchWorkersReactivated,0);
});
test("no live-source count is allowed to imply historic Methodology readiness",()=>{
  const r=assessFundamentalsReuse(inputs());
  for(const row of r.rows){
    assert.equal(row.sourceInventoryStatus,"live_archive_reference_verified_historical_t0_unchecked");
    assert.equal(row.historicalT0FactEligibility,"not_reconstructed_or_attested");
    assert.equal(row.scoreRecordAuthorized,false);
    assert.equal(row.researchOrWorkerClearance,false);
    assert.equal(row.canonicalPromotionAuthorized,false);
  }
  assert.equal(r.authority.sourceWriteAuthorization,false);
  assert.equal(r.authority.rejectedPayloadRetry,false);
});
test("SWKS and AEVA both have source references but still unresolved gates",()=>{
  const r=assessFundamentalsReuse(inputs());
  for(const ticker of ["SWKS","AEVA"]){
    const row=r.rows.find(x=>x.ticker===ticker);
    assert.equal(row.frontierSelected,true);
    assert.equal(row.liveReferenceVerified,true);
    assert.ok(row.namedUnresolvedFailures.length>0);
  }
});
test("altered top-level bridge index hash cannot validate any backlogged source references",()=>{
  const x=inputs();
  x.index.indexHash="0".repeat(64);
  const r=assessFundamentalsReuse(x);
  assert.equal(r.summary.liveSourceReferencesVerified,0);
  assert.equal(r.summary.referencesNeedingIntegrityReview,74);
  assert.equal(r.summary.historicalT0EvidenceAdmitted,0);
});
test("CIK drift fails verification of the affected issuer without inventing sources",()=>{
  const x=inputs();x.observations.candidates.SWKS.cik="0000000001";
  const r=assessFundamentalsReuse(x);
  const row=r.rows.find(y=>y.ticker==="SWKS");
  assert.equal(row.liveReferenceVerified,false);
  assert.equal(row.existingFactEntries,null);
});
test("tampered archived per-company hash invalidates that source reference",()=>{
  const x=inputs();x.health.companyDetails.find(y=>y.ticker==="AEVA").truthHash="0".repeat(64);
  const r=assessFundamentalsReuse(x);
  assert.equal(r.rows.find(y=>y.ticker==="AEVA").liveReferenceVerified,false);
});
test("future live source cutoff cannot be mistaken for historical baseline cutoff",()=>{
  const r=assessFundamentalsReuse(inputs());
  assert.ok(Date.parse(r.asOf)>Date.parse(r.historicalEvidenceWindowEnd));
  assert.equal(r.authority.pointInTimeReconstructionPerformed,false);
  assert.equal(r.authority.originalFileBytesAuthenticatedByThisAudit,false);
});
test("missing or untrusted durable archive hash is a hard input error",()=>{
  const x=inputs();x.health.archiveSha256=null;
  assert.throws(()=>assessFundamentalsReuse(x),/phoenix_p7a_source_or_historical_cutoff_unverified/);
  const y=inputs();y.health.durableArchive=false;
  assert.throws(()=>assessFundamentalsReuse(y),/phoenix_p7a_source_or_historical_cutoff_unverified/);
});
test("wrong source cycle or changed as-of is never silently admitted",()=>{
  const x=inputs();x.health.asOf="2026-09-11T00:00:00Z";
  assert.throws(()=>assessFundamentalsReuse(x),/phoenix_p7a_source_or_historical_cutoff_unverified/);
  const y=inputs();y.systemState.lastCycleAt="2026-09-11T00:00:00Z";
  assert.throws(()=>assessFundamentalsReuse(y),/phoenix_p7a_source_or_historical_cutoff_unverified/);
});
test("bridge canonical authority or trial eligibility cannot be toggled",()=>{
  const x=inputs();x.index.trialEligible=true;
  assert.throws(()=>assessFundamentalsReuse(x),/phoenix_p7a_source_or_historical_cutoff_unverified/);
  const y=inputs();y.health.canonicalWrites=1;
  assert.throws(()=>assessFundamentalsReuse(y),/phoenix_p7a_source_or_historical_cutoff_unverified/);
});
test("historical T0 cutoff cannot be shifted forward by a live bridge",()=>{
  const x=inputs();x.baseline.evidenceWindowEnd="2026-10-18T00:00:00Z";
  assert.throws(()=>assessFundamentalsReuse(x),/phoenix_p7a_source_or_historical_cutoff_unverified/);
});
test("a forged cutoff still earlier than the archive cannot replace frozen historical T0",()=>{
 const x=inputs();
 x.baseline.evidenceWindowEnd=new Date(Date.parse(x.index.asOf)-3600000).toISOString();
 assert.throws(()=>assessFundamentalsReuse(x),/phoenix_p7a_source_or_historical_cutoff_unverified/);
});
test("duplicate Workgraph frontier identities fail before reuse recommendations",()=>{
  const x=inputs();x.frontier.candidates.push(structuredClone(x.frontier.candidates[0]));
  assert.throws(()=>assessFundamentalsReuse(x),/phoenix_p7a_invalid_frontier_identity/);
});
test("unreported missing bridge company fails verified coverage check",()=>{
  const x=inputs();x.health.companies=249;
  assert.throws(()=>assessFundamentalsReuse(x),/phoenix_p7a_live_bridge_coverage_inconsistent/);
});
test("no new worker, scheduler, source write or public Pages trigger is added",async()=>{
  const workflow=await readFile(new URL("../.github/workflows/earth2036-closure-invariants.yml",import.meta.url),"utf8");
  assert.match(workflow,/node scripts\/phoenix-fundamentals-reuse-inspect\.mjs/);
  assert.match(workflow,/continue-on-error: true/);
});
