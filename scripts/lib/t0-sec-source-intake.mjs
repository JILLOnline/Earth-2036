import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { verifySecDocumentArchive } from "./sec-document-authentication.mjs";
import { T0_ORIGINAL_CANDIDATES, T0_SOURCE_CUTOFF, validateT0PrimaryCandidate } from "./t0-primary-original-candidates.mjs";

// Workgraph-facing source provenance ONLY. A document being retrievable today
// cannot establish its first public availability at frozen September 12 T0.
// Never map a source hash into a review disposition or Methodology score.
export const SEC_INTAKE_CONTRACT="earth2036-t0-sec-original-source-intake-v1";
const SHA=/^[a-f0-9]{64}$/;
const priorIndependentObservations=Object.freeze({
  "SWKS:0000004127-26-000049":{
    source:"GitHub Actions 39128255744 P7D original-primary-report",
    sha256:"643d8f161c6daa0a050eef7cb8194548931550471bfaf8286d84101dde08e107",
  },
});

const readJson=async filename=>JSON.parse(await readFile(filename,"utf8"));
async function optionalJson(filename) {
  try { return await readJson(filename); }
  catch(e) { if(e.code==="ENOENT")return null; throw e; }
}
function normalizeArchive(filing,filename,artifact,receipt,manifest,now){
  if(!filename.endsWith(".json")||filename.slice(0,-5)!==artifact?.sourceDocumentSha256||!SHA.test(artifact.sourceDocumentSha256||""))
    throw new Error("source_intake_archive_filename_sha_mismatch");
  const valid=verifySecDocumentArchive(filing,artifact,{now});
  if(!receipt||receipt.contract!=="earth2036-t0-primary-original-acquisition-v1"||
      receipt.filingId!==filing.id||receipt.sourceUrl!==filing.sourceUrl||
      receipt.originalByteSha256!==valid.sourceDocumentSha256||
      receipt.byteLength!==valid.byteLength||receipt.fetchedAt!==valid.fetchedAt||
      receipt.historicalCutoff!==manifest.evidenceWindowEnd||
      receipt.primaryBytesAuthenticated!==true||
      receipt.t0HistoricalAdmission!==false||
      receipt.historicalFirstPublicAvailabilityVerified!==false||
      receipt.reviewed!==false||receipt.materialityDisposition!==null||
      receipt.canonicalWriteAuthority!==false||receipt.qualifiedTickAuthority!==false)
    throw new Error("source_intake_archive_receipt_mismatch");
  return valid;
}
export async function loadT0SecSourceIntake({root,manifest,now=new Date().toISOString(),candidates=T0_ORIGINAL_CANDIDATES}){
  if(!root||!Array.isArray(candidates)||manifest?.evidenceWindowEnd!==T0_SOURCE_CUTOFF)
    throw new Error("source_intake_bad_historical_context");
  const rows=[];
  const archiveRoot=path.join(root,"data","operations","sec-primary-archive");
  const receiptRoot=path.join(root,"data","operations","phoenix","t0-source-acquisition");
  for(const candidate of candidates) {
    const filing=validateT0PrimaryCandidate(candidate,manifest);
    const relativeArchive=path.join("data","operations","sec-primary-archive",filing.ticker,filing.accessionNumber);
    const rootArchive=path.join(root,relativeArchive);
    const files=(await readdir(rootArchive).catch(e=>e.code==="ENOENT"?[]:Promise.reject(e))).filter(name=>name.endsWith(".json")).sort();
    const holdRelative=path.join("data","operations","phoenix","t0-source-acquisition","holds",filing.ticker+"-"+filing.accessionNumber+".json");
    const hold=await optionalJson(path.join(root,holdRelative));
    const row={
      ticker:filing.ticker,accessionNumber:filing.accessionNumber,id:filing.id,
      originalSourceUrl:filing.sourceUrl,filingDate:candidate.filingDate,
      historicalCutoff:manifest.evidenceWindowEnd,
      asOfPublicAvailabilityAuthenticated:false,historicalAdmission:false,
      formalReviewed:false,canonicalWriteAuthority:false,workerRestartAuthorized:false,
      primarySha256:null,priorObservedSha256:priorIndependentObservations[filing.id]?.sha256||candidate.expectedDocumentSha256||null,
      priorObservationSource:priorIndependentObservations[filing.id]?.source||
        (candidate.expectedDocumentSha256?"Pinned original-source SHA in existing P7J source review":null),
      archivePath:null,receiptPath:null,holdPath:hold?holdRelative:null,
      status:"not_yet_acquired",discrepancies:[],
    };
    if(hold){
      if(hold.contract!=="earth2036-t0-primary-original-acquisition-v1"||
          hold.filingId!==filing.id||hold.sourceUrl!==filing.sourceUrl||
          hold.acquisitionPermitted!==false||hold.historicalAdmission!==false||
          hold.primaryOriginalBytesVerified!==false)
        row.discrepancies.push("invalid_immutable_source_hold");
      row.discrepancies.push("immutable_source_integrity_hold:"+String(hold.error||"unknown"));
    }
    if(files.length>1)row.discrepancies.push("ambiguous_primary_archive_multiple_files");
    if(files.length===1){
      const file=files[0],archiveRelative=path.join(relativeArchive,file);
      try{
        const artifact=await readJson(path.join(root,archiveRelative));
        const receiptRelative=path.join("data","operations","phoenix","t0-source-acquisition",
          filing.ticker+"-"+filing.accessionNumber+"-"+artifact.sourceDocumentSha256+".json");
        const receipt=await optionalJson(path.join(root,receiptRelative));
        const verified=normalizeArchive(filing,file,artifact,receipt,manifest,now);
        row.primarySha256=verified.sourceDocumentSha256;
        row.archivePath=archiveRelative;
        row.receiptPath=receiptRelative;
        if(candidate.expectedDocumentSha256&&verified.sourceDocumentSha256!==candidate.expectedDocumentSha256)
          row.discrepancies.push("pinned_original_sha_disagreement");
        if(priorIndependentObservations[filing.id]&&verified.sourceDocumentSha256!==priorIndependentObservations[filing.id].sha256)
          row.discrepancies.push("independent_original_sha_disagreement");
      }catch(e){row.discrepancies.push("original_byte_or_receipt_integrity_error:"+String(e.message).slice(0,160));}
    }
    if(row.discrepancies.length)row.status="source_integrity_review_required";
    else if(row.primarySha256)row.status="authenticated_now_asof_unverified";
    rows.push(row);
  }
  const counts={
    candidateOriginals:rows.length,
    authenticatedNow:rows.filter(x=>x.primarySha256!==null).length,
    authenticatedNoKnownContradiction:rows.filter(x=>x.status==="authenticated_now_asof_unverified").length,
    integrityReviewRequired:rows.filter(x=>x.status==="source_integrity_review_required").length,
    notYetAcquired:rows.filter(x=>x.status==="not_yet_acquired").length,
    historicallyAdmitted:0,formallyReviewed:0,
  };
  return {
    contract:SEC_INTAKE_CONTRACT,generatedAt:now,
    authority:{canonicalWriteAuthority:false,sourceAdmission:false,
      materialityReview:false,factorScoring:false,workerRestart:false,tickQualification:false},
    scope:"source candidate index only; not a first-public timestamp proof, formal reviewer disposition, score or Chief-ready certificate",
    historicalCutoff:manifest.evidenceWindowEnd,
    counts,items:rows
  };
}
