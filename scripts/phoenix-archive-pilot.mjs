#!/usr/bin/env node
// P7B archive inspection only; NEVER writes source, scores, or canonical state.
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
  index?.trialEligible!==false || health?.canonicalWriteAuthority!==false)
 throw new Error("untrusted_or_inconsistent_bridge_metadata");

const checksum=await new Promise((resolve,reject)=>{
 const h=createHash("sha256");
 createReadStream(file).on("data",x=>h.update(x)).on("error",reject)
 .on("end",()=>resolve(h.digest("hex")));
});
if(checksum!==health.archiveSha256)throw new Error("archive_binary_sha256_mismatch");

const report={
 contract:"earth2036-phoenix-p7b-archive-pilot-v2",
 mode:"noncanonical_read_only",
 archiveSha256:checksum,archiveBytesAuthenticated:true,
 sourceCycle:index.asOf,cutoff:HISTORICAL_T0_CUTOFF,
 historicalT0EvidenceAdmitted:0,canonicalWriteAuthority:false,
 researchWorkerRestartAuthorized:false,companies:[]
};

for(const ticker of ["AEVA","SWKS"]){
 const ref=index.entries?.[ticker]?.reference;
 if(ref?.status!=="valid")throw new Error("bridge_reference_invalid:"+ticker);
 const entry="bridge/source/"+ref.cik+"/"+ref.sourcePayloadHash+".json";
 if(!/^bridge\/source\/\d{10}\/[a-f0-9]{64}\.json$/.test(entry))
  throw new Error("unsafe_archive_path:"+ticker);
 let bytes;
 try {bytes=execFileSync("tar",["-xOzf",file,entry],{maxBuffer:64*1024*1024,stdio:["ignore","pipe","pipe"]});}
 catch(e){
  // Some tarballs prefix members with './', which is not a different source.
  try{bytes=execFileSync("tar",["-xOzf",file,"./"+entry],{maxBuffer:64*1024*1024,stdio:["ignore","pipe","pipe"]});}
  catch {throw new Error("archive_source_entry_absent:"+ticker);}
 }
 const source=JSON.parse(bytes.toString("utf8"));
 const sourceCik=String(source?.cik??"").replace(/\D/g,"").padStart(10,"0");
 if(sourceCik!==ref.cik)throw new Error("archived_cik_mismatch:"+ticker);
 const rebuilt=buildFundamentalsTruth(source,{ticker,cik:ref.cik,asOf:index.asOf,
  retrievedAt:index.asOf});
 const sourceHash=truthHash(source);
 if(rebuilt.sourcePayloadHash!==ref.sourcePayloadHash ||
    rebuilt.rawTruth.factsHash!==ref.rawFactsHash ||
    rebuilt.rawTruth.factCount!==ref.rawFactCount ||
    rebuilt.cik!==ref.cik)
  throw new Error("archive_raw_source_reference_mismatch:"+ticker);
 const facts=extractAllStandardFacts(source,HISTORICAL_T0_CUTOFF);
 const accessions=[...new Set(facts.map(x=>x.accn).filter(Boolean))].sort();
 report.companies.push({
  ticker,cik:ref.cik,sourcePayloadDigestSha256:sourceHash,
  sourceReferenceReconstructed:true,archiveEntry:entry,
  cutoffFilteredFactCount:facts.length,distinctAccessions:accessions.length,
  accessionNumbers:accessions,
  acceptanceTimestampAttested:false,publicAvailabilityAttested:false,
  amendmentReviewAttested:false,historicalEligibility:"not_admitted",
  nextStep:"Authenticate original SEC filing bytes, acceptance/public availability times and amendments before admitting T0 evidence."
 });
}
console.log(JSON.stringify(report,null,2));
