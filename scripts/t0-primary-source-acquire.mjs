#!/usr/bin/env node
// One-shot bounded SEC original-document acquisition; writes ONLY immutable
// SEC byte archives and separately labeled unreviewed source receipts.
// Does not interact with Workgraph evidence/receipts or with canonical scores.
import {readFile,readdir,mkdir,writeFile,appendFile} from "node:fs/promises";
import path from "node:path";
import {fetchSecDocumentArtifact,verifySecDocumentArchive} from "./lib/sec-document-authentication.mjs";
import {persistSecDocumentArtifact} from "./lib/sec-review-archive.mjs";
import {T0_ORIGINAL_CANDIDATES,validateT0PrimaryCandidate,assertOriginalSourceBytes,
  T0_SOURCE_ACQUISITION_CONTRACT} from "./lib/t0-primary-original-candidates.mjs";

const root=process.cwd();
const manifest=JSON.parse(await readFile(path.join(root,"data/baselines/earth2036-official-t0-2026-09-12/manifest.json"),"utf8"));
const archiveRoot=path.join(root,"data/operations/sec-primary-archive");
const receiptRoot=path.join(root,"data/operations/phoenix/t0-source-acquisition");
const userAgent=process.env.SEC_USER_AGENT;
const maxAttempts=3;
const summary={contract:T0_SOURCE_ACQUISITION_CONTRACT,authority:{
  historicalAdmission:false,reviewApproval:false,scoreWrites:false,
  canonicalPromotion:false,tickQualification:false,workerRestart:false,
  retriesOfRejectedWorkerPayload:false},
  examined:0,downloaded:[],alreadyVerified:[],holds:[],failures:[],attemptedFetches:0};
const eligible=[];
for(const row of T0_ORIGINAL_CANDIDATES){
  const filing=validateT0PrimaryCandidate(row,manifest);
  const accessionRoot=path.join(archiveRoot,filing.ticker,filing.accessionNumber);
  const existing=(await readdir(accessionRoot).catch(e=>{
    if(e.code==="ENOENT")return [];
    throw e;
  })).filter(name=>name.endsWith(".json"));
  summary.examined++;
  if(existing.length>1)throw new Error("t0_source_ambiguous_immutable_archive:"+filing.id);
  if(existing.length===1){
    const raw=await readFile(path.join(accessionRoot,existing[0]),"utf8");
    const verified=JSON.parse(raw);
    verifySecDocumentArchive(filing,verified);
    assertOriginalSourceBytes(row,verified);
    summary.alreadyVerified.push({id:filing.id,sha256:verified.sourceDocumentSha256});
    continue;
  }
  const holdPath=path.join(receiptRoot,"holds",filing.ticker+"-"+filing.accessionNumber+".json");
  let hold=null;
  try { hold=JSON.parse(await readFile(holdPath,"utf8")); }
  catch(e) { if(e.code!=="ENOENT")throw e; }
  if(hold){
    if(hold.contract!==T0_SOURCE_ACQUISITION_CONTRACT||hold.filingId!==filing.id||hold.acquisitionPermitted!==false)
      throw new Error("t0_source_invalid_persisted_hold:"+filing.id);
    summary.holds.push({id:filing.id,error:hold.error,reason:"persisted_original_source_integrity_hold"});
    continue;
  }
  eligible.push({row,filing});
}
for(const {row,filing} of eligible.slice(0,maxAttempts)){
  summary.attemptedFetches++;
  try{
    const artifact=await fetchSecDocumentArtifact(filing,{
      userAgent,maxBytes:2*1024*1024,timeoutMs:15000});
    assertOriginalSourceBytes(row,artifact);
    const persisted=await persistSecDocumentArtifact(filing,artifact,archiveRoot);
    if(!persisted.created){
      summary.alreadyVerified.push({id:filing.id,sha256:artifact.sourceDocumentSha256});
      continue;
    }
    const receipt={
      contract:T0_SOURCE_ACQUISITION_CONTRACT,filingId:filing.id,
      sourceUrl:filing.sourceUrl,filingDate:row.filingDate,
      originalByteSha256:artifact.sourceDocumentSha256,
      byteLength:artifact.byteLength,fetchedAt:artifact.fetchedAt,
      historicalCutoff:manifest.evidenceWindowEnd,
      primaryBytesAuthenticated:true,
      historicalFirstPublicAvailabilityVerified:false,
      t0HistoricalAdmission:false,reviewed:false,materialityDisposition:null,
      canonicalWriteAuthority:false,qualifiedTickAuthority:false,
    };
    await mkdir(receiptRoot,{recursive:true});
    const dest=path.join(receiptRoot,filing.ticker+"-"+filing.accessionNumber+"-"+artifact.sourceDocumentSha256+".json");
    await writeFile(dest,JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
    summary.downloaded.push({id:filing.id,sha256:artifact.sourceDocumentSha256,bytes:artifact.byteLength});
  }catch(e){
    const error=String(e?.message||e).slice(0,240);
    const persistentHold=/t0_source_pinned_original_byte_hash_changed|sec_document_source_identity_mismatch|sec_document_hash_or_length_mismatch|sec_document_response_too_large/.test(error);
    const fail={
      contract:T0_SOURCE_ACQUISITION_CONTRACT,filingId:filing.id,sourceUrl:filing.sourceUrl,
      recordedAt:new Date().toISOString(),error,
      primaryOriginalBytesVerified:false,sourceReviewCompleted:false,
      historicalAdmission:false,workerEvidenceWrite:false,
      acquisitionPermitted:!persistentHold,
      disposition:persistentHold?"blocked_pending_original_source_integrity_review":"retry_only_bounded_source_fetch",
    };
    const destination=persistentHold
      ? path.join(receiptRoot,"holds",filing.ticker+"-"+filing.accessionNumber+".json")
      : path.join(receiptRoot,"failed-attempts",filing.ticker+"-"+filing.accessionNumber+"-"+fail.recordedAt.replace(/[:.]/g,"-")+".json");
    await mkdir(path.dirname(destination),{recursive:true});
    await writeFile(destination,JSON.stringify(fail,null,2)+"\n",{flag:"wx"});
    summary.failures.push({id:filing.id,error,disposition:fail.disposition});
  }
}
console.log(JSON.stringify(summary,null,2));
if(process.env.GITHUB_STEP_SUMMARY){
  await appendFile(process.env.GITHUB_STEP_SUMMARY,[
    "## T0 original SEC source acquisition (strict research-only)",
    "Fetched "+summary.downloaded.length+" original sources; "+summary.alreadyVerified.length+
    " previously byte-authenticated; "+summary.failures.length+" failures.",
    ...summary.downloaded.map(x=>"- "+x.id+" SHA256 "+x.sha256),
    ...summary.failures.map(x=>"- BLOCKED "+x.id+": "+x.error),
    "No historical first-public timestamp was authenticated; zero admissions, reviews, company promotions, or ticks."
  ].join("\n")+"\n");
}
if(summary.failures.length||(!summary.downloaded.length&&!summary.alreadyVerified.length))
  process.exitCode=1;
