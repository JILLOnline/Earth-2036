#!/usr/bin/env node
// Phoenix P7E: audited, bounded 10-K amendment-family inventory.
// Fetches SEC primary documents without persisting data or granting any authority.
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {buildEdgarUrls,fetchBounded} from "./phoenix-edgar-primary-pilot.mjs";
import {HISTORICAL_T0_CUTOFF} from "./lib/phoenix-historical-filing-precheck.mjs";

const allowedCiks={AEVA:"0001789029",SWKS:"0000004127"};
const validAccession=x=>typeof x==="string"&&/^\d{10}-\d{2}-\d{6}$/.test(x);
function usable(f){
 return validAccession(f?.accessionNumber)&&
  ["10-K","10-K/A"].includes(f.form)&&
  f.acceptanceDisposition==="accepted_by_historical_cutoff"&&
  typeof f.acceptedAt==="string"&&
  Number.isFinite(Date.parse(f.acceptedAt))&&
  Date.parse(f.acceptedAt)<=Date.parse(HISTORICAL_T0_CUTOFF);
}
// Deliberately match by SEC reporting period; proximity by date is NOT a substitute.
export function selectAmendmentFamilies(report){
 if(report?.contract!=="earth2036-phoenix-sec-acceptance-triage-v1" ||
    report.cutoff!==HISTORICAL_T0_CUTOFF ||report.historicalT0EvidenceAdmitted!==0 ||
    report.canonicalWriteAuthority!==false ||report.publicAvailabilityAuthenticated!==false ||
    !Array.isArray(report.companies)||report.companies.length!==2)
   throw Error("untrusted_original_sec_acceptance_report");
 const families=[];
 for(const ticker of ["AEVA","SWKS"]){
  const c=report.companies.find(x=>x.ticker===ticker);
  if(!c ||c.cik!==allowedCiks[ticker] ||c.archivePayloadVerified!==true ||
     !Array.isArray(c.accessions))throw Error("invalid_amendment_issuer:"+ticker);
  const filings=c.accessions.filter(usable);
  const annual=filings.filter(x=>x.form==="10-K");
  const amendments=filings.filter(x=>x.form==="10-K/A").sort((a,b)=>a.acceptedAt.localeCompare(b.acceptedAt));
  for(const amendment of amendments){
   const samePeriod=annual.filter(x=>x.reportDate &&amendment.reportDate &&
    x.reportDate===amendment.reportDate &&
    Date.parse(x.acceptedAt)<Date.parse(amendment.acceptedAt))
    .sort((a,b)=>b.acceptedAt.localeCompare(a.acceptedAt));
   const latestPrior=annual.filter(x=>Date.parse(x.acceptedAt)<Date.parse(amendment.acceptedAt))
    .sort((a,b)=>b.acceptedAt.localeCompare(a.acceptedAt))[0]??null;
   const original=samePeriod.length===1?samePeriod[0]:null;
   families.push({
    ticker,cik:c.cik,
    amendment:{ticker,cik:c.cik,accessionNumber:amendment.accessionNumber,
      form:amendment.form,filingDate:amendment.filingDate,
      acceptedAt:amendment.acceptedAt,reportDate:amendment.reportDate??null,
      primaryDocument:amendment.primaryDocument??null},
    sourcePeriodMatchStatus:!amendment.reportDate?"missing_amendment_report_period":
     samePeriod.length===0?"no_preceding_same_period_10k":
     samePeriod.length>1?"ambiguous_same_period_originals":"exact_same_period_10k",
    original:original?{
      ticker,cik:c.cik,accessionNumber:original.accessionNumber,
      form:original.form,filingDate:original.filingDate,acceptedAt:original.acceptedAt,
      reportDate:original.reportDate??null,primaryDocument:original.primaryDocument??null
    }:null,
    unverifiedPriorAnnualCandidate:original?null:latestPrior?{
      accessionNumber:latestPrior.accessionNumber,reportDate:latestPrior.reportDate??null,
      explanation:"Chronologically prior; NOT established as the amended original"
    }:null,
    amendmentScopeReviewed:false,financialRestatementEstablished:false,
    supersessionDisposition:"not_reviewed"
   });
  }
 }
 if(families.length!==9 ||
    families.filter(x=>x.ticker==="AEVA").length!==2 ||
    families.filter(x=>x.ticker==="SWKS").length!==7)
  throw Error("historical_amendment_inventory_changed_review_required");
 return families;
}

function signals(bytes){
 const raw=bytes.toString("utf8").slice(0,5_000_000);
 const norm=raw.replace(/<[^>]{0,2000}>/g," ").replace(/\s+/g," ");
 return {hasExplanatoryNote:/explanatory\s+note/i.test(norm),
   containsPartIII:/part\s+iii/i.test(norm),
   containsFinancialStatementsHeading:/item\s+8[.:\s]+financial\s+statements/i.test(norm),
   containsCorrectionOrRestatementTerm:/restat(?:e|ed|ement)|correct(?:ion|ed)/i.test(norm),
   interpretation:"keyword_presence_only_not_amendment_scope_or_restatement_proof"};
}
export async function reviewAmendmentFamilies(report,{agent=process.env.SEC_USER_AGENT,
 fetcher=fetchBounded,delay=250}={}){
 if(!agent||agent.length<20)throw Error("SEC_USER_AGENT_required");
 const families=selectAmendmentFamilies(report);
 const fileOut={contract:"earth2036-phoenix-p7e-amendment-family-v1",
  mode:"read_only_noncanonical",cutoff:HISTORICAL_T0_CUTOFF,
  totalAmendments:families.length,originalPeriodMatched:0,
  amendmentPrimaryDocumentsRetrieved:0,originalPrimaryDocumentsRetrieved:0,
  amendmentContentReviewComplete:false,publicAvailabilityAtT0Authenticated:false,
  historicalT0EvidenceAdmitted:0,canonicalWriteAuthority:false,
  chiefPromotionAuthorized:false,workerRestartAuthorized:false,
  families:[]};
 const cache=new Map();
 async function inspect(row){
  const urls=buildEdgarUrls(row);
  let result=cache.get(urls.primaryDocumentUrl);
  if(result)return result;
  try{
   const payload=await fetcher(urls.primaryDocumentUrl,agent,18*1024*1024);
   const first=payload.bytes.subarray(0,1000).toString("utf8");
   if(/Access Denied|Request Rate Threshold|Unauthorized Access/i.test(first))
    throw Error("sec_access_denied_content");
   result={url:urls.primaryDocumentUrl,status:"retrieved_now",
    sha256:payload.sha256,bytes:payload.size,keywordSignals:signals(payload.bytes)};
  }catch(e){
   result={url:urls.primaryDocumentUrl,status:"unverified:"+String(e?.message??e).slice(0,110),
    sha256:null,bytes:null,keywordSignals:null};
  }
  cache.set(urls.primaryDocumentUrl,result);
  if(delay)await new Promise(done=>setTimeout(done,delay));
  return result;
 }
 for(const family of families){
  const amendment=await inspect(family.amendment);
  const original=family.original?await inspect(family.original):null;
  if(family.sourcePeriodMatchStatus==="exact_same_period_10k")fileOut.originalPeriodMatched++;
  if(amendment.status==="retrieved_now")fileOut.amendmentPrimaryDocumentsRetrieved++;
  if(original?.status==="retrieved_now")fileOut.originalPrimaryDocumentsRetrieved++;
  fileOut.families.push({...family,amendmentDocument:amendment,
    originalDocument:original,originalComparisonDisposition:
      original&&amendment.status==="retrieved_now"&&original.status==="retrieved_now"?
       "original_and_amendment_bytes_retrieved_no_scope_adjudication":"incomplete_or_ambiguous",
    historicalAdmissibility:false});
 }
 return fileOut;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw Error("Usage: node scripts/phoenix-edgar-amendment-family.mjs <sec-acceptance-report.json>");
 const receipt=JSON.parse(await readFile(process.argv[2],"utf8"));
 console.log(JSON.stringify(await reviewAmendmentFamilies(receipt),null,2));
}
