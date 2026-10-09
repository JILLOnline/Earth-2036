import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateEvidenceQualification, parseEvidenceDispositionLedger,
  evidenceQualificationMatchesState,
} from "../scripts/lib/evidence-qualification.mjs";

const NOW = "2026-10-09T23:00:00.000Z";
const item=(id="AAA:001",form="4")=>({
  id,ticker:id.split(":")[0],accessionNumber:id.split(":")[1],status:"pending",
  detectedAt:"2026-10-09T20:00:00.000Z",form,
  sourceUrl:"https://www.sec.gov/Archives/edgar/data/123/001/filing.xml"
});
const decision=(x,disposition="non_gating")=>({
  version:1,reviewId:"review:"+x.id+":1",itemId:x.id,ticker:x.ticker,
  accessionNumber:x.accessionNumber,disposition,
  reviewer:"council-alpha:auditor",reviewedAt:"2026-10-09T21:00:00.000Z",
  primarySourceUrl:x.sourceUrl,
  sourceDocumentSha256:"a".repeat(64),
  rationale:"Primary source reviewed in full: disclosed matter was already captured in a verified canonical evidence packet.",
});
const evaluate=(items, reviews=[])=>evaluateEvidenceQualification({items},reviews,NOW);

test("unreviewed SEC forms 4 and 144 are NEVER automatically exempt",()=>{
  const rows=[item("AAA:001","4"),item("BBB:002","144"),item("CCC:003","8-K")];
  const result=evaluate(rows);
  assert.equal(result.totalFilings,3);
  assert.equal(result.pendingUnreviewed,3);
  assert.equal(result.unresolvedMaterialOrUnreviewed,3);
  assert.equal(result.gatePassed,false);
  assert.equal(result.reviewedNonGating,0);
  assert.equal(result.rawPending,3);
});
test("an explicitly source-reviewed non-gating filing remains in raw historical queue",()=>{
  const x=item(); const v=evaluate([x],[decision(x)]);
  assert.equal(v.rawPending,1);
  assert.equal(v.reviewedNonGating,1);
  assert.equal(v.unresolvedMaterialOrUnreviewed,0);
  assert.equal(v.gatePassed,true);
  assert.equal(v.reviewEvents,1);
});
test("material-open review remains blocking regardless of reviewer",()=>{
  const x=item();const v=evaluate([x],[decision(x,"material_open")]);
  assert.equal(v.reviewedMaterialOpen,1);
  assert.equal(v.unresolvedMaterialOrUnreviewed,1);
  assert.equal(v.gatePassed,false);
});
test("legacy raw resolved status cannot clear a gate without reviewed source proof",()=>{
  const x={...item(),status:"resolved"};const v=evaluate([x]);
  assert.equal(v.rawPending,0);
  assert.equal(v.legacyClosedWithoutReview,1);
  assert.equal(v.pendingUnreviewed,1);
  assert.equal(v.gatePassed,false);
});
test("refuses uncorroborated clearance, unknown IDs, hash omissions, and form-only assumptions",()=>{
 const x=item(),d=decision(x);
 for(const bad of [
   {...d,primarySourceUrl:"https://example.org/unsupported"},
   {...d,sourceDocumentSha256:null},
   {...d,reviewer:""},
   {...d,rationale:"Form 4 is always immaterial."},
   {...d,itemId:"BBB:999"},
   {...d,ticker:"BBB"},
   {...d,disposition:"ignore"},
   {...d,reviewedAt:"2026-10-10T01:00:00Z"},
 ]) assert.throws(()=>evaluate([x],[bad]));
});
test("append-only supersession permits reviewed escalation, not rewriting history",()=>{
 const x=item(),first=decision(x),later={
   ...decision(x,"material_open"),reviewId:"review:AAA:001:2",
   supersedesReviewId:first.reviewId,reviewedAt:"2026-10-09T22:00:00.000Z",
 };
 assert.equal(evaluate([x],[first,later]).reviewedMaterialOpen,1);
 assert.equal(evaluate([x],[first,later]).unresolvedMaterialOrUnreviewed,1);
 assert.throws(()=>evaluate([x],[first,{...later,supersedesReviewId:"bogus"}]));
 assert.throws(()=>evaluate([x],[first,{...later,reviewedAt:first.reviewedAt.replace("21:","19:")}]));
 assert.throws(()=>evaluate([x],[first,first]));
});
test("missing or corrupted disposition ledger cannot be silently read as review approval",()=>{
 assert.deepEqual(parseEvidenceDispositionLedger(""),[]);
 assert.equal(parseEvidenceDispositionLedger(JSON.stringify(decision(item()))+"\n").length,1);
 assert.throws(()=>parseEvidenceDispositionLedger("{broken\n"));
});
test("finalizer rejects stale queue, review hash, raw-count, and qualification mismatches",()=>{
 const x=item(),a=evaluate([x]),b=evaluate([x],[decision(x)]);
 const state={unresolvedEvidence:1,rawUnresolvedEvidence:1};
 assert.equal(evidenceQualificationMatchesState(a,state,a),true);
 assert.equal(evidenceQualificationMatchesState(a,state,b),false);
 assert.equal(evidenceQualificationMatchesState(b,state,b),false);
 assert.equal(evidenceQualificationMatchesState(a,{...state,rawUnresolvedEvidence:0},a),false);
 assert.equal(evidenceQualificationMatchesState(a,state,{...a,queueFingerprint:"not-valid"}),false);
});
test("current full SEC queue is retained and remains fail-closed until source-reviewed", async()=>{
 const j=JSON.parse(await readFile(new URL("../data/runtime/evidence-review-queue.json",import.meta.url),"utf8"));
 const result=evaluateEvidenceQualification(j,[],NOW);
 assert.equal(result.totalFilings,j.items.length);
 assert.equal(result.unresolvedMaterialOrUnreviewed,j.items.length);
 assert.ok(result.totalFilings > 0);
});
test("engine writes both raw and reviewed counters; finalizer independently verifies immutable inputs",async()=>{
 const engine=await readFile(new URL("../scripts/earth2036-engine.mjs",import.meta.url),"utf8");
 const finalizer=await readFile(new URL("../scripts/finalize-qualified-tick.mjs",import.meta.url),"utf8");
 assert.match(engine,/evaluateEvidenceQualification\(/);
 assert.match(engine,/rawUnresolvedEvidence: evidenceQualification\.rawPending/);
 assert.match(finalizer,/evidenceQualificationMatchesState\(/);
 assert.match(finalizer,/evidence_review_integrity_failure/);
 assert.match(finalizer,/evidence_review_fingerprint_or_count_mismatch/);
});
