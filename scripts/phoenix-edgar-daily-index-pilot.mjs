#!/usr/bin/env node
// P7D supporting source: SEC EDGAR date-specific public index, read-only.
// The currently retrievable dated index is NOT a cryptographic historical snapshot.
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {HISTORICAL_T0_CUTOFF} from "./lib/phoenix-historical-filing-precheck.mjs";
const sha256=b=>createHash("sha256").update(b).digest("hex");
export function indexLocator(filing){
 const date=filing?.filingDate;
 if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
   !Number.isFinite(Date.parse(date+"T12:00:00Z")) ||
   !/^[0-9]{10}$/.test(filing.cik??"") ||
   !/^\d{10}-\d{2}-\d{6}$/.test(filing.accessionNumber??""))
  throw Error("invalid_edgar_dated_index_identity");
 const [year,month,day]=date.split("-");
 const quarter=Math.floor((Number(month)-1)/3)+1;
 if(![1,2,3,4].includes(quarter))throw Error("invalid_index_quarter");
 return {
  indexUrl:"https://www.sec.gov/Archives/edgar/daily-index/"+year+"/QTR"+quarter+"/master."+year+month+day+".idx",
  expectedPath:"edgar/data/"+Number(filing.cik)+"/"+filing.accessionNumber+".txt"
 };
}
export function verifyDailyMasterIndex(text,filing){
 const expected=indexLocator(filing).expectedPath;
 const alternative="edgar/data/"+Number(filing.cik)+"/"+
  filing.accessionNumber.replace(/-/g,"")+"/"+filing.accessionNumber+".txt";
 const matchingAccessionLines=text.split(/\r?\n/).filter(line=>
  line.includes(filing.accessionNumber+".txt"));
 const matches=matchingAccessionLines.filter(line=>{
  const fields=line.split("|");
  return fields.length===5&&
   String(Number(fields[0]))===String(Number(filing.cik))&&
   fields[2].trim()===filing.form&&
   fields[3].trim()===filing.filingDate&&
   (fields[4].trim()===expected || fields[4].trim()===alternative);
 });
 return {matchingRows:matches.length,verifiedUniqueMatch:matches.length===1,
  accessionCandidateLines:matchingAccessionLines.length,
  candidatePaths:matchingAccessionLines.slice(0,3).map(line=>line.split("|").at(-1)?.trim()??null),
  candidateFieldSamples:matchingAccessionLines.slice(0,2).map(line=>line.split("|").map(field=>field.trim()).slice(0,5))};
}
async function getIndex(url,agent){
 if(!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/daily-index\/\d{4}\/QTR[1-4]\/master\.\d{8}\.idx$/.test(url))
  throw Error("untrusted_sec_index_url");
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const r=await fetch(url,{signal:controller.signal,headers:{"User-Agent":agent,Accept:"text/plain"}});
  if(!r.ok)throw Error("sec_daily_index_http_"+r.status);
  if(Number(r.headers.get("content-length")||0)>4*1024*1024)throw Error("sec_daily_index_oversized");
  const buffer=Buffer.from(await r.arrayBuffer());
  if(buffer.length>4*1024*1024)throw Error("sec_daily_index_oversized");
  return {text:buffer.toString("utf8"),sha256:sha256(buffer),bytes:buffer.length};
 }finally{clearTimeout(timeout)}
}
export async function runIndexPilot(file,agent=process.env.SEC_USER_AGENT,fetcher=getIndex){
 const prev=JSON.parse(await readFile(file,"utf8"));
 if(prev?.contract!=="earth2036-phoenix-p7d-original-edgar-document-v1" ||
   prev.cutoff!==HISTORICAL_T0_CUTOFF ||prev.historicalT0EvidenceAdmitted!==0||
   prev.canonicalWriteAuthority!==false||!Array.isArray(prev.filings)||prev.filings.length>6)
  throw Error("untrusted_primary_document_report");
 if(!agent||agent.length<20)throw Error("SEC_USER_AGENT_required");
 const out={contract:"earth2036-phoenix-p7d-daily-index-corroboration-v1",
  mode:"read_only_noncanonical",cutoff:HISTORICAL_T0_CUTOFF,
  checkedFilings:prev.filings.length,matchingDatedIndexes:0,
  originalFirstPublicTimestampVerified:false,publicAvailabilityAtT0Authenticated:false,
  historicalT0EvidenceAdmitted:0,canonicalWriteAuthority:false,workerRestartAuthorized:false,
  records:[]};
 for(const filing of prev.filings){
  const {indexUrl,expectedPath}=indexLocator(filing);
  const item={ticker:filing.ticker,accessionNumber:filing.accessionNumber,
   form:filing.form,filingDate:filing.filingDate,
   indexUrl,expectedPath,indexSha256:null,indexBytes:null,
   status:"unverified",matchingRows:0,accessionCandidateLines:0,candidatePaths:[],candidateFieldSamples:[],originalFirstPublicTimestampVerified:false,
   historicalT0EvidenceAdmitted:false};
  try{
   const response=await fetcher(indexUrl,agent);
   item.indexSha256=response.sha256;item.indexBytes=response.bytes;
   const check=verifyDailyMasterIndex(response.text,filing);
   item.matchingRows=check.matchingRows;
   item.accessionCandidateLines=check.accessionCandidateLines;
   item.candidatePaths=check.candidatePaths;
   item.candidateFieldSamples=check.candidateFieldSamples;
   item.status=check.verifiedUniqueMatch?"dated_sec_master_index_match":"not_found_or_ambiguous";
   if(check.verifiedUniqueMatch)out.matchingDatedIndexes++;
  }catch(e){item.status="not_verified:"+String(e?.message??e).slice(0,100)}
  out.records.push(item);
  await new Promise(ok=>setTimeout(ok,350));
 }
 return out;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw Error("Usage: node scripts/phoenix-edgar-daily-index-pilot.mjs <original-primary-report.json>");
 console.log(JSON.stringify(await runIndexPilot(process.argv[2]),null,2));
}
