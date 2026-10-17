#!/usr/bin/env node
// P7B local archive analysis only: NEVER writes source, scores, or canonical state.
import {readFile} from "node:fs/promises";
import {createReadStream} from "node:fs";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {extractAllStandardFacts} from "./lib/sec-fundamentals-truth.mjs";
import {HISTORICAL_T0_CUTOFF} from "./lib/phoenix-historical-filing-precheck.mjs";
const file=process.argv[2];
if(!file){console.error("Usage: node scripts/phoenix-archive-pilot.mjs <locally-verified-bridge-cache.tar.gz>");process.exit(2)}
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const [index,health]=await Promise.all([
 read("data/runtime/workgraph/shadow/fundamentals-bridge-index.json"),
 read("data/runtime/workgraph/shadow/fundamentals-bridge-health.json")
]);
const checksum=await new Promise((resolve,reject)=>{
 const h=createHash("sha256");createReadStream(file).on("data",x=>h.update(x))
 .on("error",reject).on("end",()=>resolve(h.digest("hex")));
});
if(checksum!==health.archiveSha256) throw new Error("archive_binary_sha256_mismatch");
const report={contract:"earth2036-phoenix-p7b-archive-pilot-v1",mode:"noncanonical_read_only",
 archiveSha256:checksum,archiveBytesAuthenticated:true,cutoff:HISTORICAL_T0_CUTOFF,
 historicalT0EvidenceAdmitted:0,canonicalWriteAuthority:false,
 companies:[]};
for(const ticker of ["AEVA","SWKS"]){
 const ref=index.entries[ticker]?.reference;
 if(ref?.status!=="valid")throw new Error("bridge_reference_invalid:"+ticker);
 const entry="bridge/source/"+ref.cik+"/"+ref.sourcePayloadHash+".json";
 // tar only sees a constant, validated name constructed from trusted local indexed descriptors.
 if(!/^bridge\\/source\\/\\d{10}\\/[a-f0-9]{64}\\.json$/.test(entry))
   throw new Error("unsafe_archive_path");
 const content=execFileSync("tar",["-xOzf",file,entry],{maxBuffer:60*1024*1024});
 const source=JSON.parse(content.toString("utf8"));
 const normalizeCik=v=>String(v??"").replace(/\\D/g,"").padStart(10,"0");
 if(normalizeCik(source.cik)!==ref.cik)throw new Error("archived_cik_mismatch:"+ticker);
 const facts=extractAllStandardFacts(source,HISTORICAL_T0_CUTOFF);
 const accessions=[...new Set(facts.map(x=>x.accn).filter(Boolean))].sort();
 report.companies.push({ticker,cik:ref.cik,archiveEntry:entry,
  cutoffFilteredFactCount:facts.length,distinctAccessions:accessions.length,
  acceptanceTimestampAttested:false,publicAvailabilityAttested:false,
  amendmentReviewAttested:false,historicalEligibility:"not_admitted",
  nextStep:"Cross-verify accession-specific original filing bytes and SEC acceptance/publication timestamps before using any fact."});
}
console.log(JSON.stringify(report,null,2));
