#!/usr/bin/env node
// Phoenix P7G: bounded AEVA issuer SEC filing window since the dated 10-Q
// cover share count. It DOES NOT reconcile actual September share ownership.
import {HISTORICAL_T0_CUTOFF} from "./lib/phoenix-historical-filing-precheck.mjs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const COVER_DATE="2026-07-30";
export const SEC_ISSUER_CIK="0001789029";
const sourceUrl="https://data.sec.gov/submissions/CIK"+SEC_ISSUER_CIK+".json";
export function reviewAevaFilingWindow(secData){
 if(!secData || String(Number(secData.cik))!=="1789029")
  throw Error("SEC_issuer_identity_unverified");
 const recent=secData?.filings?.recent;
 const required=["accessionNumber","filingDate","acceptanceDateTime","form","primaryDocument"];
 if(required.some(k=>!Array.isArray(recent?.[k])))
  throw Error("SEC_recent_filing_columns_missing");
 const minRecords=Math.min(...required.map(k=>recent[k].length));
 if(minRecords<recent.accessionNumber.length)
  throw Error("SEC_recent_filing_column_lengths_mismatch");
 if(!recent.filingDate.some(x=>typeof x==="string"&&x<=COVER_DATE))
  throw Error("SEC_recent_filing_window_not_complete");
 const cutoffMs=Date.parse(HISTORICAL_T0_CUTOFF);
 const records=[],held=[];
 for(let i=0;i<recent.accessionNumber.length;i++){
  const acc=recent.accessionNumber[i],date=recent.filingDate[i],
   accepted=recent.acceptanceDateTime[i],form=recent.form[i],
   primaryDocument=recent.primaryDocument[i];
  if(typeof date!=="string"||date<COVER_DATE||date>HISTORICAL_T0_CUTOFF.slice(0,10))
   continue;
  if(!/^\d{10}-\d{2}-\d{6}$/.test(acc)||typeof form!=="string")
   throw Error("invalid_SEC_accession_or_form_in_window");
  const isoOk=typeof accepted==="string"&&
   /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(accepted)&&
   Number.isFinite(Date.parse(accepted));
  const receipt={accessionNumber:acc,form,filingDate:date,
   acceptedAt:isoOk?accepted:null,primaryDocument:primaryDocument??null,
   sourceUrl,additionalSourceReviewRequired:true,
   issuerNewShareIssuanceProven:false,
   amendmentReviewRequired:form.endsWith("/A"),
   afterCoverDate:date>COVER_DATE};
  if(isoOk&&Date.parse(accepted)<=cutoffMs)records.push(receipt);
  else held.push({...receipt,disposition:!isoOk?
   "missing_precise_sec_acceptance":"accepted_after_cutoff"});
 }
 records.sort((a,b)=>a.filingDate.localeCompare(b.filingDate)||
  a.accessionNumber.localeCompare(b.accessionNumber));
 const forms={};
 for(const x of records)forms[x.form]=(forms[x.form]??0)+1;
 return {
  contract:"earth2036-phoenix-p7g-aeva-sec-issuer-filing-window-v1",
  ticker:"AEVA",cik:SEC_ISSUER_CIK,
  mode:"noncanonical_read_only",cutoff:HISTORICAL_T0_CUTOFF,
  coverShareDate:COVER_DATE,shareCountAsOfCutoffAuthenticated:false,
  issuerCapitalizationEventsExhaustivelyReviewed:false,
  beneficialOwnerFormsAndTransferAgentReconciled:false,
  secIssuerSubmissionsHistoryCoversWindow:true,
  issuerFilingCountWithinWindow:records.length,forms,
  records,heldRecords:held,
  warnings:[
   "SEC issuer submissions records cannot establish all new shares issued or all insider transactions",
   "Filings without acceptedAt precision are quarantined; no acceptance time or after-cutoff data inferred",
   "A Form 4 or insider sale is not necessarily an issuer equity issuance; separate owner-CIK filings require review",
   "Absence of a disclosed issuer capital event is not positive proof that shares outstanding were unchanged",
   "As-of-cutoff share count and forward financial valuation are not authenticated"
  ],
  historicalT0EvidenceAdmitted:0,
  marketValuationOpportunity:null,
  chiefReadyAuthorized:false,canonicalWriteAuthority:false,
  workerRestartAuthorized:false
 };
}
export async function fetchAevaFilingWindow({
 fetcher=fetch,agent=process.env.SEC_USER_AGENT
}={}){
 if(!agent||agent.length<20)throw Error("SEC_USER_AGENT_required");
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),18000);
 try{
  const res=await fetcher(sourceUrl,{signal:controller.signal,
   headers:{"User-Agent":agent,Accept:"application/json"}});
  if(!res.ok)throw Error("SEC_submission_http_"+res.status);
  if(Number(res.headers.get("content-length")||0)>10_000_000)
   throw Error("SEC_submission_oversized");
  const data=await res.text();
  if(data.length>10_000_000)throw Error("SEC_submission_oversized");
  return reviewAevaFilingWindow(JSON.parse(data));
 }finally{clearTimeout(timeout)}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log(JSON.stringify(await fetchAevaFilingWindow(),null,2));
}
