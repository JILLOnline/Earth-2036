#!/usr/bin/env node
// P7B bounded source reconstruction only; no SEC filing-time attestation or canonical writes.
import {readFile} from "node:fs/promises";
import {createReadStream} from "node:fs";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {buildFundamentalsTruth,extractAllStandardFacts,truthHash} from "./lib/sec-fundamentals-truth.mjs";
import {HISTORICAL_T0_CUTOFF} from "./lib/phoenix-historical-filing-precheck.mjs";

const file=process.argv[2];
if(!file||process.argv.length!==3){
 console.error("Usage: node scripts/phoenix-archive-pilot.mjs <verified-bridge-cache.tar.gz>");
 process.exit(2);
}
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const [index,health]=await Promise.all([
 read("data/runtime/workgraph/shadow/fundamentals-bridge-index.json"),
 read("data/runtime/workgraph/shadow/fundamentals-bridge-health.json")
]);
if(index?.asOf!==health?.asOf || index?.canonicalWriteAuthority!==false ||
  index?.trialEligible!==false || health?.canonicalWriteAuthority!==false ||
  !/^[a-f0-9]{64}$/.test(String(health.archiveSha256||"")) ||
  !/^[a-f0-9]{64}$/.test(String(health.archiveManifestSha256||"")))
 throw new Error("untrusted_or_inconsistent_bridge_metadata");

const checksum=await new Promise((resolve,reject)=>{
 const h=createHash("sha256");
 createReadStream(file).on("data",x=>h.update(x)).on("error",reject)
 .on("end",()=>resolve(h.digest("hex")));
});
if(checksum!==health.archiveSha256)throw new Error("archive_binary_sha256_mismatch");

// Source filenames use SHA256 of the ENTIRE retrieved SEC payload, NOT the
// point-in-time sourcePayloadHash from the live bridge index.
function archiveMember(path){
 const member="bridge/"+path;
 for(const candidate of [member,"./"+member]){
  try{return execFileSync("tar",["-xOzf",file,candidate],{
   maxBuffer:48*1024*1024,stdio:["ignore","pipe","pipe"]
  });}catch{}
 }
 throw new Error("archive_member_missing:"+path);
}
const manifestBytes=archiveMember("cache-manifest.json");
const manifestSha256=createHash("sha256").update(manifestBytes).digest("hex");
if(manifestSha256!==health.archiveManifestSha256)
 throw new Error("archive_manifest_sha256_mismatch");
const sourceManifest=JSON.parse(manifestBytes.toString("utf8"));
if(sourceManifest?.contract!=="earth2036-bridge-source-cache-v1" ||
  !sourceManifest.companies || typeof sourceManifest.companies!=="object")
 throw new Error("untrusted_archive_manifest_contract");

const report={
 contract:"earth2036-phoenix-p7b-archive-pilot-v3",
 mode:"noncanonical_read_only",archiveSha256:checksum,
 archiveManifestSha256:manifestSha256,archiveBytesAuthenticated:true,
 sourceCycle:index.asOf,cutoff:HISTORICAL_T0_CUTOFF,
 historicalT0EvidenceAdmitted:0,canonicalWriteAuthority:false,
 researchWorkerRestartAuthorized:false,companies:[]
};
for(const ticker of ["AEVA","SWKS"]){
 const ref=index.entries?.[ticker]?.reference;
 const cached=sourceManifest.companies[ticker];
 if(ref?.status!=="valid" || !cached)throw new Error("source_identity_missing:"+ticker);
 const cik=ref.cik;
 const archivedFullHash=cached.payloadHash;
 const expectedPath="source/"+cik+"/"+archivedFullHash+".json";
 if(!/^source\/\d{10}\/[a-f0-9]{64}\.json$/.test(expectedPath) ||
    cached.cik!==cik || cached.archivePath!==expectedPath)
  throw new Error("archived_source_path_or_cik_inconsistent:"+ticker);
 const source=JSON.parse(archiveMember(expectedPath).toString("utf8"));
 const sourceCik=String(source?.cik??"").replace(/\D/g,"").padStart(10,"0");
 if(sourceCik!==cik || truthHash(source)!==archivedFullHash)
  throw new Error("archived_original_payload_integrity_failure:"+ticker);
 const rebuilt=buildFundamentalsTruth(source,{ticker,cik,asOf:index.asOf,
  retrievedAt:index.asOf});
 const liveReferenceMatches=rebuilt.sourcePayloadHash===ref.sourcePayloadHash &&
  rebuilt.rawTruth.factsHash===ref.rawFactsHash &&
  rebuilt.rawTruth.factCount===ref.rawFactCount;
 // Source payload and point-in-time reference are verified separately. Archive
 // source changes or later live facts must remain visible as drift, not erased.
 const facts=extractAllStandardFacts(source,HISTORICAL_T0_CUTOFF);
 const accessions=[...new Set(facts.map(x=>x.accn).filter(Boolean))].sort();
 report.companies.push({
  ticker,cik,archiveEntry:"bridge/"+expectedPath,
  archivedFullPayloadHash:archivedFullHash,
  archivedFullPayloadVerified:true,liveReferenceMatches,
  liveReferenceMismatch:liveReferenceMatches?null:"archive_snapshot_differs_from_current_live_index",
  historicalFiledDateFilteredFacts:facts.length,
  distinctHistoricalAccessions:accessions.length,
  historicalAccessions:accessions,
  acceptanceTimestampAttested:false,publicAvailabilityAttested:false,
  amendmentReviewAttested:false,historicalEligibility:"not_admitted",
  nextStep:"Verify each original filing accession, SEC acceptance/publication timestamp, amendments and Methodology 1.0 factor linkage."
 });
}
console.log(JSON.stringify(report,null,2));
