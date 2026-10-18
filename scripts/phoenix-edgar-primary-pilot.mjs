#!/usr/bin/env node
// Phoenix P7D: bounded, read-only EDGAR original-document retrieval.
// An EDGAR document retrievable TODAY does not prove when it first became public.
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {HISTORICAL_T0_CUTOFF} from "./lib/phoenix-historical-filing-precheck.mjs";

export const PILOT_TICKERS=Object.freeze({AEVA:"0001789029",SWKS:"0000004127"});
export const MAX_DOCUMENT_BYTES=18*1024*1024;
const sha256=b=>createHash("sha256").update(b).digest("hex");
const accessionValid=s=>typeof s==="string"&&/^\d{10}-\d{2}-\d{6}$/.test(s);
const safeDocName=s=>typeof s==="string"&&s.length<=220&&
 /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(s)&&s!=="."&&s!==".."&&
 !s.startsWith(".")&&!s.includes("..");
export function selectPilotFilings(acceptance){
 if(acceptance?.contract!=="earth2036-phoenix-sec-acceptance-triage-v1" ||
   acceptance.cutoff!==HISTORICAL_T0_CUTOFF ||
   acceptance.historicalT0EvidenceAdmitted!==0 ||
   acceptance.originalFilingBytesAuthenticated!==false ||
   acceptance.publicAvailabilityAuthenticated!==false ||
   acceptance.canonicalWriteAuthority!==false ||
   !Array.isArray(acceptance.companies) || acceptance.companies.length!==2)
  throw Error("untrusted_source_acceptance_audit");
 const output=[];
 for(const ticker of ["AEVA","SWKS"]){
  const company=acceptance.companies.find(x=>x.ticker===ticker);
  if(company?.cik!==PILOT_TICKERS[ticker] ||
    company.archivePayloadVerified!==true ||
    !Array.isArray(company.accessions))
   throw Error("invalid_company_filing_inventory:"+ticker);
  const candidates=company.accessions.filter(x=>
   x.acceptanceDisposition==="accepted_by_historical_cutoff"&&
   typeof x.acceptedAt==="string"&&Date.parse(x.acceptedAt)<=Date.parse(HISTORICAL_T0_CUTOFF)&&
   accessionValid(x.accessionNumber)&&safeDocName(x.primaryDocument));
  const selected=new Map();
  for(const form of ["10-Q","10-K","10-K/A"]){
   const matches=candidates.filter(x=>x.form===form)
    .sort((a,b)=>Date.parse(b.acceptedAt)-Date.parse(a.acceptedAt));
   if(matches.length)selected.set(matches[0].accessionNumber,matches[0]);
  }
  output.push(...selected.values().map(x=>({
   ticker,cik:company.cik,accessionNumber:x.accessionNumber,
   acceptedAt:x.acceptedAt,form:x.form,filingDate:x.filingDate,
   primaryDocument:x.primaryDocument,secMetadataUrl:x.secMetadataUrl
  })));
 }
 if(output.length>6)throw Error("pilot_selection_exceeds_bounded_6_documents");
 return output;
}
export function buildEdgarUrls(row){
 if(PILOT_TICKERS[row?.ticker]!==row?.cik ||
   !accessionValid(row.accessionNumber)||!safeDocName(row.primaryDocument))
  throw Error("untrusted_edgar_document_location");
 const cik=String(Number(row.cik));
 const noDash=row.accessionNumber.replace(/-/g,"");
 const base="https://www.sec.gov/Archives/edgar/data/"+cik+"/"+noDash+"/";
 return {
  primaryDocumentUrl:base+row.primaryDocument,
  headerUrl:base+row.accessionNumber+".hdr.sgml"
 };
}
export async function fetchBounded(url,agent,limit){
 if(!url.startsWith("https://www.sec.gov/Archives/edgar/data/"))
  throw Error("unsupported_edgar_origin");
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(url,{headers:{"User-Agent":agent,Accept:"*/*"},signal:controller.signal});
  if(!response.ok)throw Error("edgar_http_"+response.status);
  if(Number(response.headers.get("content-length")||0)>limit)
   throw Error("edgar_document_too_large");
  const chunks=[];let size=0;
  if(!response.body)throw Error("edgar_empty_response_stream");
  for await(const chunk of response.body){
   size+=chunk.length;
   if(size>limit){controller.abort();throw Error("edgar_document_too_large")}
   chunks.push(chunk);
  }
  const bytes=Buffer.concat(chunks);
  if(bytes.length===0)throw Error("edgar_zero_byte_document");
  return {bytes,sha256:sha256(bytes),size:bytes.length,
   responseType:response.headers.get("content-type")??null};
 }finally{clearTimeout(timeout)}
}
function eastHeaderTime(iso){
 const d=new Date(iso);
 if(!Number.isFinite(d.getTime()))return null;
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
  timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
 }).formatToParts(d).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
 return parts.year+parts.month+parts.day+parts.hour+parts.minute+parts.second;
}
export function compareHeaderAcceptance(headerText,acceptedAt){
 const value=headerText.match(/<ACCEPTANCE-DATETIME>\s*(\d{14})/i)?.[1]??null;
 return {headerAcceptanceLocal:value,
  metadataAcceptanceLocal:eastHeaderTime(acceptedAt),
  matches:value!==null&&value===eastHeaderTime(acceptedAt)};
}
export async function runPrimaryPilot(file,{fetchDocument=fetchBounded,agent=process.env.SEC_USER_AGENT}={}){
 if(!agent||agent.length<20)throw Error("SEC_USER_AGENT_required");
 const acceptance=JSON.parse(await readFile(file,"utf8"));
 const selection=selectPilotFilings(acceptance);
 const report={
  contract:"earth2036-phoenix-p7d-original-edgar-document-v1",
  mode:"read_only_noncanonical",cutoff:HISTORICAL_T0_CUTOFF,
  originalCacheSha256:acceptance.originalArchiveSha256,
  chosenFilingCount:selection.length,
  originalPrimaryDocumentsVerifiedNow:0,
  acceptanceHeaderMatches:0,
  publicAvailabilityAtT0Authenticated:false,
  amendmentAndSupersessionReviewed:false,
  methodologyFactorValidated:false,historicalT0EvidenceAdmitted:0,
  canonicalWriteAuthority:false,workerRestartAuthorized:false,
  scope:"latest_10q_10k_and_amendment_per_ticker",filings:[]
 };
 for(const row of selection){
  const urls=buildEdgarUrls(row);
  const item={...row,...urls,primarySha256:null,primaryBytes:null,
   headerSha256:null,headerAcceptedAtLocal:null,
   primaryRetrievalStatus:"unverified",headerAcceptanceStatus:"unverified",
   firstPublicAvailabilityAt:null,publicAvailabilityAtT0Authenticated:false,
   originalFilingT0Admission:false,amendmentSupersessionReviewed:false};
  try{
   const primary=await fetchDocument(urls.primaryDocumentUrl,agent,MAX_DOCUMENT_BYTES);
   const start=primary.bytes.subarray(0,1000).toString("utf8");
   if(/Access Denied|Request Rate Threshold|automated tool.*blocked|Unauthorized Access/i.test(start))
    throw Error("sec_access_denied_content");
   item.primarySha256=primary.sha256;item.primaryBytes=primary.size;
   item.primaryRetrievalStatus="verified_retrievable_now";
   report.originalPrimaryDocumentsVerifiedNow++;
  }catch(e){
   item.primaryRetrievalStatus="not_verified:"+String(e?.message??e).slice(0,95);
  }
  // Cross-check the separate SEC SGML header, not solely submissions metadata.
  try{
   const header=await fetchDocument(urls.headerUrl,agent,2*1024*1024);
   item.headerSha256=header.sha256;
   const check=compareHeaderAcceptance(header.bytes.toString("utf8"),row.acceptedAt);
   item.headerAcceptedAtLocal=check.headerAcceptanceLocal;
   item.headerAcceptanceStatus=check.matches?"matches_sec_submissions":
     "header_timestamp_missing_or_disagrees";
   if(check.matches)report.acceptanceHeaderMatches++;
  }catch(e){
   item.headerAcceptanceStatus="not_verified:"+String(e?.message??e).slice(0,95);
  }
  report.filings.push(item);
  await new Promise(ok=>setTimeout(ok,350));
 }
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const file=process.argv[2];
 if(!file||process.argv.length!==3)throw Error("Usage: node scripts/phoenix-edgar-primary-pilot.mjs <sec-acceptance-report.json>");
 console.log(JSON.stringify(await runPrimaryPilot(file),null,2));
}
