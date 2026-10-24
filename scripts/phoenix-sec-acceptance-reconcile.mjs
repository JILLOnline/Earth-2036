#!/usr/bin/env node
// Phoenix P7F: reconcile SEC filing-detail display vs original SGML header,
// preserving raw submissions JSON. Neither is proof of first-public availability.
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {buildEdgarUrls,fetchBounded} from "./phoenix-edgar-primary-pilot.mjs";
import {HISTORICAL_T0_CUTOFF} from "./lib/phoenix-historical-filing-precheck.mjs";

export function parseSecFilingDetailAccepted(html){
 if(typeof html!=="string"||html.length>3_000_000)return null;
 const normalized=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ")
  .replace(/\s+/g," ");
 const match=normalized.match(/\bAccepted\s+(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\b/i);
 return match?match.slice(1).join(""):null;
}
function easternClockFromFeed(iso){
 if(typeof iso!=="string"||!Number.isFinite(Date.parse(iso)))return null;
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",
  year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",
  second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso));
 const mapped=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
 return mapped.year+mapped.month+mapped.day+mapped.hour+mapped.minute+mapped.second;
}
export function reconcileAcceptance({sgmlLocal,indexLocal,feedISO}={}){
 const valid=x=>typeof x==="string"&&/^\d{14}$/.test(x);
 const matchingPrimary=valid(sgmlLocal)&&valid(indexLocal)&&sgmlLocal===indexLocal;
 const feedEastern=easternClockFromFeed(feedISO);
 const submitted=valid(feedEastern);
 return {sgmlLocal:valid(sgmlLocal)?sgmlLocal:null,
  secIndexLocal:valid(indexLocal)?indexLocal:null,
  submissionsRawISO:feedISO??null,
  submissionsInterpretedEastern:submitted?feedEastern:null,
  primarySecAgreement:matchingPrimary,
  submissionsAgreesWithPrimary:matchingPrimary && submitted && feedEastern===sgmlLocal,
  submissionsDisagreesWithPrimary:matchingPrimary && submitted && feedEastern!==sgmlLocal,
  primarySecAcceptanceByT0:matchingPrimary && sgmlLocal<=HISTORICAL_T0_CUTOFF.replace(/[-:T]/g,"").slice(0,14),
  historicalT0EvidenceAdmitted:false,originalFirstPublicAvailabilityAuthenticated:false};
}
export async function runAcceptanceReconciliation(file,{
 agent=process.env.SEC_USER_AGENT,fetcher=fetchBounded,delay=250}={}){
 if(!agent||agent.length<20)throw Error("SEC_USER_AGENT_required");
 const input=JSON.parse(await readFile(file,"utf8"));
 if(input?.contract!=="earth2036-phoenix-p7d-original-edgar-document-v1"||
    input.cutoff!==HISTORICAL_T0_CUTOFF||input.canonicalWriteAuthority!==false||
    input.historicalT0EvidenceAdmitted!==0||!Array.isArray(input.filings)||
    input.filings.length!==6||input.originalPrimaryDocumentsVerifiedNow!==6)
  throw Error("untrusted_original_document_pilot");
 const result={contract:"earth2036-phoenix-p7f-acceptance-source-reconciliation-v1",
  mode:"read_only_noncanonical",cutoff:HISTORICAL_T0_CUTOFF,
  filingsCompared:input.filings.length,primarySecAgreementCount:0,
  submissionsDiscrepancyCount:0,
  originalFirstPublicAvailabilityAuthenticated:false,
  historicalT0EvidenceAdmitted:0,canonicalWriteAuthority:false,
  workerRestartAuthorized:false,results:[]};
 for(const row of input.filings){
  const urls=buildEdgarUrls(row);
  const detailUrl=urls.primaryDocumentUrl.slice(0,urls.primaryDocumentUrl.lastIndexOf("/")+1)+
   row.accessionNumber+"-index.html";
  let indexLocal=null,indexDigest=null,indexStatus="unverified";
  try{
   const file=await fetcher(detailUrl,agent,3_000_000);
   const html=file.bytes.toString("utf8");
   if(!html.includes(row.accessionNumber))throw Error("SEC_filing_detail_accession_mismatch");
   indexLocal=parseSecFilingDetailAccepted(html);
   indexDigest=file.sha256;
   indexStatus=indexLocal?"SEC_filing_detail_acceptance_parsed":"missing_filing_detail_acceptance";
  }catch(e){indexStatus="not_verified:"+String(e?.message??e).slice(0,100)}
  const reconciliation=reconcileAcceptance({sgmlLocal:row.headerAcceptedAtLocal,indexLocal,feedISO:row.acceptedAt});
  if(reconciliation.primarySecAgreement)result.primarySecAgreementCount++;
  if(reconciliation.submissionsDisagreesWithPrimary)result.submissionsDiscrepancyCount++;
  result.results.push({ticker:row.ticker,cik:row.cik,accessionNumber:row.accessionNumber,
   form:row.form,secFilingDetailUrl:detailUrl,secFilingDetailSha256:indexDigest,
   indexStatus,...reconciliation});
  if(delay)await new Promise(done=>setTimeout(done,delay));
 }
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw Error("Usage: node scripts/phoenix-sec-acceptance-reconcile.mjs <original-primary-report.json>");
 console.log(JSON.stringify(await runAcceptanceReconciliation(process.argv[2]),null,2));
}
