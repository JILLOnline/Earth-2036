import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {T0_ORIGINAL_CANDIDATES,T0_SOURCE_CUTOFF,
 validateT0PrimaryCandidate,assertOriginalSourceBytes} from "../scripts/lib/t0-primary-original-candidates.mjs";
import {fetchSecDocumentArtifact,verifySecDocumentArchive} from "../scripts/lib/sec-document-authentication.mjs";

const manifest={baselineId:"earth2036-official-t0-2026-09-12",
 methodologyVersion:"1.0.0",expectedCompanies:250,
 evidenceWindowEnd:T0_SOURCE_CUTOFF};
const row=T0_ORIGINAL_CANDIDATES[0];
test("known verified original-source candidates have bounded source-identity and pre-cutoff dates",()=>{
 assert.equal(T0_ORIGINAL_CANDIDATES.length,4);
 for(const c of T0_ORIGINAL_CANDIDATES){
   const x=validateT0PrimaryCandidate(c,manifest);
   assert.ok(x.sourceUrl.startsWith("https://www.sec.gov/Archives/edgar/data/"));
   assert.ok(c.filingDate<T0_SOURCE_CUTOFF.slice(0,10));
   assert.equal(x.id,c.ticker+":"+c.accessionNumber);
 }
});
test("changed official cutoff is an explicit governance stop",()=>{
 assert.throws(()=>validateT0PrimaryCandidate(row,{...manifest,evidenceWindowEnd:"2026-10-19T00:00:00Z"}),/governance_mismatch/);
});
test("later filings may not enter historic T0 acquisition",()=>{
 assert.throws(()=>validateT0PrimaryCandidate({...row,filingDate:"2026-10-19"},manifest),/not_proven_pre_cutoff/);
});
test("same-day historical date is not proof of first-public availability",()=>{
 const c=validateT0PrimaryCandidate({...row,filingDate:"2026-09-12"},manifest);
 assert.ok(c.id);
 assert.deepEqual(assertOriginalSourceBytes({...row,expectedDocumentSha256:null},{sourceDocumentSha256:"a".repeat(64)}),
 {historicalAdmission:false,reviewed:false,firstPublicAsOfCutoffVerified:false});
});
test("original source pins prevent content substitution",()=>{
 assert.throws(()=>assertOriginalSourceBytes(row,{sourceDocumentSha256:"a".repeat(64)}),/pinned_original_byte_hash_changed/);
});
test("arbitrary SEC URLs or path traversal never accepted",()=>{
 assert.throws(()=>validateT0PrimaryCandidate({...row,primaryDocument:"../secret.xml"},manifest));
});
test("invalid calendar days fail closed",()=>{
 assert.throws(()=>validateT0PrimaryCandidate({...row,filingDate:"2026-02-30"},manifest),/not_proven_pre_cutoff/);
});
test("bounded original acquisition returns unreviewed bytes not source authorization",async()=>{
 const c={...row,expectedDocumentSha256:null};
 const f=validateT0PrimaryCandidate(c,manifest);
 const bytes="<ownershipDocument><issuer>AEVA</issuer></ownershipDocument>";
 const archive=await fetchSecDocumentArtifact(f,{userAgent:"Earth2036 contact@example.org",
 now:()=>"2026-10-19T12:00:00Z",
 fetchImpl:async url=>({status:200,redirected:false,url,
 headers:new Headers({"content-type":"application/xml"}),
 body:new Response(bytes).body})});
 assert.equal(verifySecDocumentArchive(f,archive).verified,true);
 assert.equal(archive.reviewStatus,"unreviewed");
 assert.equal(assertOriginalSourceBytes(c,archive).historicalAdmission,false);
});
test("source acquisition cannot write rankings, review dispositions or task receipts",async()=>{
 const s=await readFile(new URL("../scripts/t0-primary-source-acquire.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(s,/promote-chief-ready|finalize-qualified-tick|evidence-dispositions.jsonl/);
 assert.match(s,/data\/operations\/sec-primary-archive/);
 assert.match(s,/data\/operations\/phoenix\/t0-source-acquisition/);
});
test("the historical T0 evidence cutoff comes from the committed baseline",async()=>{
 const m=JSON.parse(await readFile(new URL("../data/baselines/earth2036-official-t0-2026-09-12/manifest.json",import.meta.url),"utf8"));
 for(const c of T0_ORIGINAL_CANDIDATES) assert.ok(validateT0PrimaryCandidate(c,m));
});
