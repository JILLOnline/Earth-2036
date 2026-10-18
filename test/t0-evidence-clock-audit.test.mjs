import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {auditT0EvidenceClocks} from "../scripts/lib/t0-evidence-clock-audit.mjs";
const make=(date="2026-09-14",ticker="AEVA")=>({
 id:ticker+":0001193125-26-390791",ticker,accessionNumber:"0001193125-26-390791",
 filingDate:date,form:"3",status:"pending",
 sourceUrl:"https://www.sec.gov/Archives/edgar/data/1789029/000119312526390791/xslF345X06/ownership.xml"
});
const fixture=()=>{
 const items=[make("2026-09-14","AEVA"),make("2026-09-12","SWKS")];
 return {manifest:{evidenceWindowEnd:"2026-09-12T23:59:59-04:00",methodologyVersion:"1.0.0",expectedCompanies:250,published:false},
   queue:{items,unresolved:2},
   qualification:{contract:"earth2036-evidence-qualification-v1",totalFilings:2,rawPending:2,pendingUnreviewed:2,
     reviewedMaterialOpen:0,reviewedNonGating:0,reviewedResolved:0,unresolvedMaterialOrUnreviewed:2,gatePassed:false},
   frontier:{selected:[{ticker:"AEVA"},{ticker:"SWKS"}]}
 };
};
test("after-cutoff filings are separated without date-based clearance",()=>{
 const r=auditT0EvidenceClocks(fixture());
 assert.equal(r.clocks.definitivelyFiledAfterT0,1);
 assert.equal(r.clocks.filedOnOrBeforeCutoffDayButStillUnverified,1);
 assert.equal(r.clocks.historicalEvidenceAutomaticallyAdmitted,0);
 assert.equal(r.authority.t0GateChange,false);
 assert.equal(r.clocks.formalGatePassed,false);
 assert.equal(r.frontier.postCutoffSelectedFilings,1);
});
test("cutoff date uses stated local calendar not UTC rollover",()=>{
 const f=fixture();f.queue.items[1].filingDate="2026-09-13";
 const r=auditT0EvidenceClocks(f);assert.equal(r.clocks.definitivelyFiledAfterT0,2);
});
test("pre-cutoff filings are never auto-authenticated",()=>{
 const f=fixture();f.queue.items[1].filingDate="2026-09-11";
 const r=auditT0EvidenceClocks(f);assert.equal(r.clocks.historicalEvidenceAutomaticallyAdmitted,0);
 assert.match(r.frontier.originalSecSourceAddressedButUnreviewed[1].sourceAdmissibility,/not_authenticated/);
});
test("rejects inconsistent global pending counts",()=>{
 const f=fixture();f.queue.unresolved=1;assert.throws(()=>auditT0EvidenceClocks(f),/raw_queue_unresolved_mismatch/);
});
test("rejects inconsistent formal disposition counters",()=>{
 const f=fixture();f.qualification.pendingUnreviewed=1;assert.throws(()=>auditT0EvidenceClocks(f),/formal_review_counter_mismatch/);
});
test("rejects fake qualification gate counts",()=>{
 const f=fixture();f.qualification.unresolvedMaterialOrUnreviewed=0;assert.throws(()=>auditT0EvidenceClocks(f),/formal_review_gate_counter_mismatch/);
});
test("duplicate filing IDs fail closed",()=>{
 const f=fixture();f.queue.items.push({...f.queue.items[0]});f.queue.unresolved=3;f.qualification.totalFilings=3;f.qualification.rawPending=3;f.qualification.pendingUnreviewed=3;f.qualification.unresolvedMaterialOrUnreviewed=3;
 assert.throws(()=>auditT0EvidenceClocks(f),/invalid_or_duplicate_evidence_queue_identity/);
});
test("invalid cutoff and filing dates fail closed",()=>{
 const f=fixture();f.manifest.evidenceWindowEnd="Sept 12";assert.throws(()=>auditT0EvidenceClocks(f),/invalid_historical_t0_cutoff/);
 f.manifest.evidenceWindowEnd="2026-09-12T23:59:59-04:00";f.queue.items[0].filingDate="2026-02-30";
 assert.throws(()=>auditT0EvidenceClocks(f),/invalid_filing_date/);
});
test("unknown forms are never exempt",()=>{
 const f=fixture();f.queue.items[0].form="4";f.queue.items[1].form="144";
 const r=auditT0EvidenceClocks(f);assert.equal(r.clocks.formalUnreviewed,2);
 assert.deepEqual(r.byForm,{"144":1,"4":1});
});
test("the independent audit does not publish, write, or grant worker restart",()=>{
 const r=auditT0EvidenceClocks(fixture());assert.equal(r.authority.readOnly,true);
 for(const prop of ["sourceAdmission","dispositionWrite","automaticClearance","t0GateChange","canonicalPromotion","workerRestart","tickQualification"])assert.equal(r.authority[prop],false);
 assert.ok(r.governanceDecisionRequired);
});
test("live repository queue is distinguished from the immutable T0 cutoff",async()=>{
 const names=["data/baselines/earth2036-official-t0-2026-09-12/manifest.json","data/runtime/evidence-review-queue.json","data/runtime/evidence-qualification.json","data/runtime/workgraph/worker-view/closure-frontier.json"];
 const [manifest,queue,qualification,frontier]=await Promise.all(names.map(p=>readFile(new URL("../"+p,import.meta.url),"utf8").then(JSON.parse)));
 const r=auditT0EvidenceClocks({manifest,queue,qualification,frontier});
 const cutoffDay=manifest.evidenceWindowEnd.slice(0,10);
 const selected=new Set((frontier.selected||[]).map(x=>x.ticker));
 assert.equal(r.totalItems,queue.items.length);
 assert.equal(r.clocks.historicalEvidenceAutomaticallyAdmitted,0);
 assert.equal(r.clocks.definitivelyFiledAfterT0,queue.items.filter(x=>x.filingDate>cutoffDay).length);
 assert.equal(r.frontier.postCutoffSelectedFilings,queue.items.filter(x=>selected.has(x.ticker)&&x.filingDate>cutoffDay).length);
 assert.equal(r.clocks.formalGatePassed,qualification.gatePassed);
});

test("legitimate T0 publication and trial do not break historical clock monitoring",()=>{
 const f=fixture();f.manifest.published=true;f.manifest.status="published";
 const r=auditT0EvidenceClocks(f);
 assert.equal(r.clocks.definitivelyFiledAfterT0,1);
 assert.equal(r.clocks.historicalEvidenceAutomaticallyAdmitted,0);
 assert.equal(r.authority.t0GateChange,false);
});
