import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fetchSecDocumentArtifact } from '../scripts/lib/sec-document-authentication.mjs';
import { persistSecDocumentArtifact, loadVerifiedSecReviewProofs } from '../scripts/lib/sec-review-archive.mjs';
import { evaluateEvidenceQualification } from '../scripts/lib/evidence-qualification.mjs';

const filing={
  id:'MRVL:0001628280-26-065570',ticker:'MRVL',cik:'0001835632',
  accessionNumber:'0001628280-26-065570',
  primaryDocument:'xslF345X06/wk-form4_1791591056.xml',
  sourceUrl:'https://www.sec.gov/Archives/edgar/data/1835632/000162828026065570/xslF345X06/wk-form4_1791591056.xml',
  detectedAt:'2026-10-09T20:00:00Z',form:'4',status:'pending'
};
const NOW='2026-10-10T04:00:00Z';
const acquire=()=>fetchSecDocumentArtifact(filing,{
 userAgent:'Earth2036 research contact@example.org',
 now:()=> '2026-10-10T00:00:00Z',
 fetchImpl:async url=>({status:200,redirected:false,url,
  headers:new Headers({'content-type':'application/xml'}),
  body:new Response('<ownershipDocument><issuer>MRVL</issuer></ownershipDocument>').body})
});
const reviewed=artifact=>({
 version:1,reviewId:'review:MRVL:1',itemId:filing.id,ticker:filing.ticker,
 accessionNumber:filing.accessionNumber,disposition:'non_gating',reviewer:'council-alpha:audit',
 reviewedAt:'2026-10-10T03:00:00Z',primarySourceUrl:filing.sourceUrl,
 sourceDocumentSha256:artifact.sourceDocumentSha256,
 rationale:'Real primary SEC source reviewed; unchanged and independently checked canonical company evidence.'
});

test('persist source bytes only once, read and validate for review, but never auto-clear without decision',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'earth-sec-'));
 try{
  const artifact=await acquire();
  const first=await persistSecDocumentArtifact(filing,artifact,root,NOW);
  assert.equal(first.created,true);
  const second=await persistSecDocumentArtifact(filing,artifact,root,NOW);
  assert.equal(second.created,false);
  const raw=JSON.parse(await readFile(first.file,'utf8'));
  assert.equal(raw.reviewStatus,'unreviewed');
  const decision=reviewed(artifact);
  const proofs=await loadVerifiedSecReviewProofs({items:[filing]},[decision],root,NOW);
  assert.equal(proofs.get(decision.reviewId).verified,true);
  assert.equal(evaluateEvidenceQualification({items:[filing]},[decision],NOW,proofs).reviewedNonGating,1);
  assert.throws(()=>evaluateEvidenceQualification({items:[filing]},[decision],NOW),/authenticated SEC source archive/);
  await writeFile(first.file,JSON.stringify({...raw,bodyBase64:Buffer.from('forged').toString('base64')}));
  await assert.rejects(()=>loadVerifiedSecReviewProofs({items:[filing]},[decision],root,NOW),/sec_document_/);
  await assert.rejects(()=>persistSecDocumentArtifact(filing,artifact,root,NOW),/sec_document_/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('missing, future-fetched, mismatched review source and incorrect hash fail closed',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'earth-sec-'));
 try{
  const a=await acquire(), d=reviewed(a);
  await assert.rejects(()=>loadVerifiedSecReviewProofs({items:[filing]},[d],root,NOW),/archive_missing/);
  await persistSecDocumentArtifact(filing,a,root,NOW);
  await assert.rejects(()=>loadVerifiedSecReviewProofs({items:[filing]},[{...d,sourceDocumentSha256:'b'.repeat(64)}],root,NOW));
  await assert.rejects(()=>loadVerifiedSecReviewProofs({items:[filing]},[{...d,primarySourceUrl:'https://www.sec.gov/unrelated'}],root,NOW));
  await assert.rejects(()=>loadVerifiedSecReviewProofs({items:[filing]},[{...d,reviewedAt:'2026-10-09T22:00:00Z'}],root,NOW));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('material-open remains blocking with or without archive',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'earth-sec-'));
 try{
  const a=await acquire(), d={...reviewed(a),disposition:'material_open'};
  const proofs=await loadVerifiedSecReviewProofs({items:[filing]},[d],root,NOW);
  assert.equal(proofs.size,0);
  const result=evaluateEvidenceQualification({items:[filing]},[d],NOW,proofs);
  assert.equal(result.unresolvedMaterialOrUnreviewed,1);
  assert.equal(result.gatePassed,false);
 }finally{await rm(root,{recursive:true,force:true});}
});
