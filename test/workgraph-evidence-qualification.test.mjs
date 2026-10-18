import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fetchSecDocumentArtifact } from "../scripts/lib/sec-document-authentication.mjs";
import { persistSecDocumentArtifact } from "../scripts/lib/sec-review-archive.mjs";
import { qualifyEvidenceForWorkgraph } from "../scripts/lib/workgraph-evidence-qualification.mjs";

const filing = {
  id:"MRVL:0001628280-26-065570",
  ticker:"MRVL",cik:"0001835632",
  accessionNumber:"0001628280-26-065570",
  primaryDocument:"xslF345X06/wk-form4_1791591056.xml",
  sourceUrl:"https://www.sec.gov/Archives/edgar/data/1835632/000162828026065570/xslF345X06/wk-form4_1791591056.xml",
  detectedAt:"2026-10-09T20:00:00Z",form:"4",status:"pending"
};
const NOW="2026-10-10T04:00:00Z";
const source=()=>fetchSecDocumentArtifact(filing,{
  userAgent:"Earth2036 research contact@example.org",
  now:()=> "2026-10-10T00:00:00Z",
  fetchImpl:async url=>({status:200,redirected:false,url,
    headers:new Headers({"content-type":"application/xml"}),
    body:new Response("<ownershipDocument><issuer>MRVL</issuer></ownershipDocument>").body})
});
const review=(artifact,disposition="non_gating")=>({
  version:1,reviewId:"review:MRVL:verified:1",itemId:filing.id,ticker:filing.ticker,
  accessionNumber:filing.accessionNumber,disposition,
  reviewer:"council-alpha:audit",reviewedAt:"2026-10-10T03:00:00Z",
  primarySourceUrl:filing.sourceUrl,sourceDocumentSha256:artifact.sourceDocumentSha256,
  rationale:"Primary SEC source inspected: the original record had already been represented in source-addressed canonical evidence."
});
const audit=(root,ledgerText)=>qualifyEvidenceForWorkgraph({
  queue:{items:[filing],unresolved:1},ledgerText,archiveRoot:root,asOf:NOW
});
test("current empty disposition ledger remains fail-closed and productive",async()=>{
  const r=await audit("/does-not-exist","");
  assert.equal(r.pendingUnreviewed,1);assert.equal(r.gatePassed,false);
  assert.equal(r.archiveIntegrityError,undefined);
});
test("valid archived SEC bytes and reviewed disposition are accepted by Workgraph",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"t0-proof-"));
  try{
    const a=await source();await persistSecDocumentArtifact(filing,a,root,NOW);
    const r=await audit(root,JSON.stringify(review(a))+"\n");
    assert.equal(r.reviewedNonGating,1);assert.equal(r.pendingUnreviewed,0);
    assert.equal(r.unresolvedMaterialOrUnreviewed,0);assert.equal(r.gatePassed,true);
    assert.equal(r.archiveIntegrityError,undefined);
  }finally{await rm(root,{recursive:true,force:true});}
});
test("valid material_open review stays blocking without any archive",async()=>{
  const a=await source();const r=await audit("/does-not-exist",JSON.stringify(review(a,"material_open")));
  assert.equal(r.reviewedMaterialOpen,1);assert.equal(r.unresolvedMaterialOrUnreviewed,1);
  assert.equal(r.gatePassed,false);
});
test("review pointing at nonexistent archive is held without stopping routing",async()=>{
  const a=await source();const r=await audit("/does-not-exist",JSON.stringify(review(a)));
  assert.equal(r.pendingUnreviewed,1);assert.equal(r.reviewedNonGating,0);
  assert.equal(r.gatePassed,false);assert.match(r.archiveIntegrityError,/archive_missing/);
});
test("a tampered original archive cannot be accepted through Workgraph",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"t0-proof-"));
  try{
    const a=await source();const saved=await persistSecDocumentArtifact(filing,a,root,NOW);
    const raw=JSON.parse(await readFile(saved.file,"utf8"));
    await writeFile(saved.file,JSON.stringify({...raw,bodyBase64:Buffer.from("falsified").toString("base64")}));
    const r=await audit(root,JSON.stringify(review(a)));
    assert.equal(r.pendingUnreviewed,1);assert.equal(r.gatePassed,false);
    assert.match(r.archiveIntegrityError,/sec_document_/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test("malformed ledger remains fail-closed, no synthetic review",async()=>{
  const r=await audit("/does-not-exist","{not-json");
  assert.equal(r.reviewEvents,0);assert.equal(r.pendingUnreviewed,1);
  assert.equal(r.gatePassed,false);assert.match(r.archiveIntegrityError,/Invalid evidence-disposition JSONL/);
});
test("wrong source URL cannot qualify even with legitimate archive bytes",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"t0-proof-"));
  try{
    const a=await source();await persistSecDocumentArtifact(filing,a,root,NOW);
    const r=await audit(root,JSON.stringify({...review(a),primarySourceUrl:"https://www.sec.gov/incorrect"}));
    assert.equal(r.reviewedNonGating,0);assert.equal(r.gatePassed,false);
    assert.ok(r.archiveIntegrityError);
  }finally{await rm(root,{recursive:true,force:true});}
});
test("Workgraph sync calls the authenticated proof-aware adapter",async()=>{
 const sync=await readFile(new URL("../scripts/workgraph-sync.mjs",import.meta.url),"utf8");
 assert.match(sync,/qualifyEvidenceForWorkgraph\(/);
 assert.match(sync,/sec-primary-archive/);
 assert.match(sync,/archiveIntegrityError: formalQualification\.archiveIntegrityError/);
 assert.doesNotMatch(sync,/evaluateEvidenceQualification\(\s*evidenceReviewQueue,\s*parseEvidenceDispositionLedger/);
});
