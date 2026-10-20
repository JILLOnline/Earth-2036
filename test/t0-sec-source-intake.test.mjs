import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,rm,readFile} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {loadT0SecSourceIntake,SEC_INTAKE_CONTRACT} from "../scripts/lib/t0-sec-source-intake.mjs";
import {T0_ORIGINAL_CANDIDATES,T0_SOURCE_CUTOFF} from "../scripts/lib/t0-primary-original-candidates.mjs";
const manifest={
  baselineId:"earth2036-official-t0-2026-09-12",
  methodologyVersion:"1.0.0",evidenceWindowEnd:T0_SOURCE_CUTOFF,
  expectedCompanies:250,published:false
};
const NOW="2026-10-20T01:00:00.000Z";
test("real source archives become noncanonical Workgraph source handoffs, not evidence approvals",async()=>{
 const actual=JSON.parse(await readFile(new URL("../data/baselines/earth2036-official-t0-2026-09-12/manifest.json",import.meta.url),"utf8"));
 const r=await loadT0SecSourceIntake({root:process.cwd(),manifest:actual,now:NOW});
 assert.equal(r.contract,SEC_INTAKE_CONTRACT);
 assert.equal(r.counts.candidateOriginals,T0_ORIGINAL_CANDIDATES.length);
 assert.ok(r.counts.authenticatedNow>=3);
 for(const k of ["canonicalWriteAuthority","sourceAdmission","materialityReview","factorScoring","workerRestart","tickQualification"])assert.equal(r.authority[k],false);
 assert.equal(r.counts.historicallyAdmitted,0);
 assert.equal(r.counts.formallyReviewed,0);
 assert.ok(r.items.every(x=>x.asOfPublicAvailabilityAuthenticated===false&&x.historicalAdmission===false&&x.formalReviewed===false));
});
test("known original SHA disagreement is surfaced independently, not silently accepted",async()=>{
 const r=await loadT0SecSourceIntake({root:process.cwd(),manifest,now:NOW});
 const x=r.items.find(item=>item.id==="SWKS:0000004127-26-000049");
 assert.equal(x.status,"source_integrity_review_required");
 assert.ok(x.discrepancies.includes("independent_original_sha_disagreement"));
 assert.equal(x.priorObservedSha256,"643d8f161c6daa0a050eef7cb8194548931550471bfaf8286d84101dde08e107");
 assert.equal(x.primarySha256,"a9f6d9805c3836e79821110384b3c84727e298a167c68473761142c8fd4182f8");
});
test("both known AEVA holds remain explicit review dependencies without retry",async()=>{
 const r=await loadT0SecSourceIntake({root:process.cwd(),manifest,now:NOW});
 for(const acc of ["0001193125-26-335102","0001193125-26-338179"]){
   const x=r.items.find(item=>item.accessionNumber===acc);
   assert.equal(x.status,"source_integrity_review_required");
   assert.equal(x.primarySha256,null);
   assert.ok(x.holdPath&&x.discrepancies.some(y=>y.startsWith("immutable_source_integrity_hold:")));
 }
});
test("AEVA original owner filings are verifiable with matching prior independent digests",async()=>{
 const r=await loadT0SecSourceIntake({root:process.cwd(),manifest,now:NOW});
 for(const acc of ["0001193125-26-359631","0001193125-26-383903"]){
   const x=r.items.find(item=>item.accessionNumber===acc);
   assert.equal(x.status,"authenticated_now_asof_unverified");
   assert.equal(x.primarySha256,x.priorObservedSha256);
   assert.ok(x.archivePath&&x.receiptPath);
 }
});
test("unarchived sources have no invented receipt or authentication",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"t0-intake-"));
 try{
  const r=await loadT0SecSourceIntake({root,manifest,now:NOW,candidates:[T0_ORIGINAL_CANDIDATES[1]]});
  assert.equal(r.counts.authenticatedNow,0);
  assert.equal(r.counts.notYetAcquired,1);
  assert.equal(r.items[0].primarySha256,null);
  assert.equal(r.items[0].historicalAdmission,false);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("tampered hold fails closed rather than authorizing research",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"t0-intake-"));
 try{
   const row=T0_ORIGINAL_CANDIDATES[0];
   const dir=path.join(root,"data/operations/phoenix/t0-source-acquisition/holds");
   await mkdir(dir,{recursive:true});
   await writeFile(path.join(dir,row.ticker+"-"+row.accessionNumber+".json"),
    JSON.stringify({contract:"incorrect",filingId:row.ticker+":"+row.accessionNumber,
      sourceUrl:"https://www.sec.gov/Archives/edgar/data/1789029/000119312526335102/aeva-20260730.htm",
      acquisitionPermitted:false,historicalAdmission:false,primaryOriginalBytesVerified:false}));
   const r=await loadT0SecSourceIntake({root,manifest,now:NOW,candidates:[row]});
   assert.ok(r.items[0].discrepancies.includes("invalid_immutable_source_hold"));
   assert.equal(r.items[0].status,"source_integrity_review_required");
 }finally{await rm(root,{recursive:true,force:true});}
});
test("immutable historical cutoff mismatch is rejected",async()=>{
 await assert.rejects(()=>loadT0SecSourceIntake({root:process.cwd(),manifest:{...manifest,evidenceWindowEnd:"2026-10-19T00:00:00Z"},now:NOW}),/bad_historical_context/);
});
test("Workgraph actually projects and describes independent SEC archive provenance",async()=>{
 const sync=await readFile(new URL("../scripts/workgraph-sync.mjs",import.meta.url),"utf8");
 assert.match(sync,/loadT0SecSourceIntake\(/);
 assert.match(sync,/sec-primary-source-intake\.json/);
 assert.match(sync,/allOriginalsStillNoncanonical:true/);
 assert.doesNotMatch(sync,/sourceIntake\.items\.map\([^)]*scoreRecord/);
});
