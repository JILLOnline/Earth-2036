#!/usr/bin/env node
// Phoenix P7I: original SEC Rule 144 notice versus pre-cutoff Form 4 sale match.
// Notices are proposals, not additional stock trades or share creation.
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {fetchBounded} from "./phoenix-edgar-primary-pilot.mjs";
import {HISTORICAL_T0_CUTOFF} from "./lib/phoenix-historical-filing-precheck.mjs";
export const RULE144_ACCESSIONS=Object.freeze({
 "0001950047-26-007999":{ownerCik:"0001830952",shares:2500,date:"2026-08-12"},
 "0001950047-26-008329":{ownerCik:"0001849806",shares:70000,date:"2026-08-18"}
});
const block=(s,tag)=>s.match(new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+tag+">"))?.[1]??null;
const parts=(s,tag)=>[...s.matchAll(new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+tag+">","g"))].map(x=>x[1]);
const val=(s,tag)=>block(s,tag)?.replace(/<[^>]+>/g,"").trim()??null;
const positiveInteger=(s,label)=>{
 if(!/^\d+$/.test(String(s??"")) || !Number.isSafeInteger(Number(s)))
  throw Error("rule144_invalid_numeric_"+label);
 return Number(s);
};
const isoDate=s=>{
 if(typeof s!=="string"||!/^\d{2}\/\d{2}\/\d{4}$/.test(s))throw Error("rule144_invalid_date");
 const [m,d,y]=s.split("/");
 const iso=y+"-"+m+"-"+d;
 if(new Date(iso+"T12:00:00Z").toISOString().slice(0,10)!==iso)
  throw Error("rule144_impossible_date");
 return iso;
};
const normalizeName=name=>String(name??"").toUpperCase().replace(/[^A-Z ]/g," ")
 .split(/\s+/).filter(Boolean).sort().join(" ");
export function parseRule144(xml,acc){
 if(typeof xml!=="string"||xml.length>150000 || /<!DOCTYPE|<!ENTITY/i.test(xml))
  throw Error("untrusted_oversize_or_dtd_rule144");
 const expected=RULE144_ACCESSIONS[acc];
 if(!expected)throw Error("rule144_accession_not_in_frozen_inventory");
 if(!xml.includes("<edgarSubmission")||val(xml,"submissionType")!=="144")
  throw Error("not_original_SEC_rule144_xml");
 const header=block(xml,"headerData"),form=block(xml,"formData");
 if(!header||!form)throw Error("rule144_missing_envelope");
 const filer=block(header,"filerCredentials");
 const ownerCik=val(filer,"cik");
 const issuer=block(form,"issuerInfo");
 const issuerCik=val(issuer,"issuerCik");
 if(String(Number(issuerCik))!=="1789029"||ownerCik!==expected.ownerCik)
  throw Error("rule144_issuer_or_owner_cik_mismatch");
 const reportingName=val(issuer,"nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold");
 const security=block(form,"securitiesInformation");
 const shares=positiveInteger(val(security,"noOfUnitsSold"),"proposed_shares");
 const reportedOutstanding=positiveInteger(val(security,"noOfUnitsOutstanding"),"filer_outstanding");
 const approxDate=isoDate(val(security,"approxSaleDate"));
 if(shares!==expected.shares||approxDate!==expected.date)
  throw Error("rule144_proposed_sale_identity_changed");
 const acquisition=parts(form,"securitiesToBeSold").map(x=>({
  acquiredDate:val(x,"acquiredDate"),nature:val(x,"natureOfAcquisitionTransaction"),
  acquiredFrom:val(x,"nameOfPersonfromWhomAcquired"),
  reportedSharesAcquired:positiveInteger(val(x,"amountOfSecuritiesAcquired"),"acquired_shares")
 }));
 const pastSales=parts(form,"securitiesSoldInPast3Months").map(x=>({
  date:val(x,"saleDate")?isoDate(val(x,"saleDate")):null,
  shares:positiveInteger(val(x,"amountOfSecuritiesSold"),"past_shares"),
  grossProceedsUSD:val(x,"grossProceeds")
 }));
 return {accessionNumber:acc,reportingName,reportingOwnerCik:ownerCik,
  issuerCik:"0001789029",securityClass:val(security,"securitiesClassTitle"),
  proposedShares:shares,approximateSaleDate:approxDate,
  filerReportedOutstandingShares:reportedOutstanding,
  filerReportedOutstandingSharesIssuerAuthenticated:false,
  sourceNoticeIsProposalNotTrade:true,
  acquisitions:acquisition,pastSales,remarks:val(form,"remarks"),
  noticeDate:val(block(form,"noticeSignature"),"noticeDate"),
  doubleCountedWithForm4:false,
  issuerIssuanceQuantified:false};
}
export function reconcileRule144ToForm4(notices,form4){
 if(form4?.contract!=="earth2036-phoenix-p7h-aeva-original-Form4-v1"||
    form4.cutoff!==HISTORICAL_T0_CUTOFF||form4.originalXmlVerified!==5||
    form4.canonicalWriteAuthority!==false||
    form4.historicalT0EvidenceAdmitted!==0||
    !Array.isArray(form4.filings))throw Error("untrusted_original_sec_form4_report");
 return notices.map(notice=>{
  const matches=[];
  for(const row of form4.filings){
   const parsed=row.originalXmlTransactionParse;
   if(!parsed || !parsed.reportingOwnerName ||
    normalizeName(parsed.reportingOwnerName)!==normalizeName(notice.reportingName)||
    String(Number(parsed.reportingOwnerCik))!==String(Number(notice.reportingOwnerCik)))
    continue;
   for(const transaction of parsed.transactions??[]){
    if(transaction.table==="non_derivative"&&transaction.code==="S"&&
       transaction.acquiredDisposed==="D"&&
       transaction.transactionDate===notice.approximateSaleDate&&
       transaction.shares===notice.proposedShares)
     matches.push({form4Accession:row.accession,
      transactionDate:transaction.transactionDate,code:transaction.code,
      shares:transaction.shares});
   }
  }
  const matched=matches.length===1;
  return {...notice,identicalForm4Sales:matches,
   matchedOneOriginalSale:matched,
   duplicateSaleWouldBeCountedTwice:matched,
   additionalIssuedSharesInferred:0,
   additionalIssuedSharesAuthenticated:false,
   confirmationNote:matched?
    "A matched Form 144 proposed quantity is NOT a new Form 4 transaction":
    "No unique Form 4 executed sale identified; hold for owner-level review"};
 });
}
export async function runRule144Overlap(windowFile,form4File,{
 agent=process.env.SEC_USER_AGENT,fetcher=fetchBounded,delayMs=300
}={}){
 if(!agent||agent.length<20)throw Error("SEC_USER_AGENT_required");
 const [window,form4]=await Promise.all([windowFile,form4File].map(x=>
  readFile(x,"utf8").then(JSON.parse)));
 if(window?.contract!=="earth2036-phoenix-p7g-aeva-sec-issuer-filing-window-v1" ||
   window.cutoff!==HISTORICAL_T0_CUTOFF ||window.canonicalWriteAuthority!==false ||
   window.historicalT0EvidenceAdmitted!==0 || !Array.isArray(window.records))
  throw Error("untrusted_issuer_sec_window");
 const candidates=window.records.filter(x=>x.form==="144");
 if(candidates.length!==2 || Object.keys(RULE144_ACCESSIONS).some(x=>
     !candidates.some(y=>y.accessionNumber===x)))throw Error("rule144_source_inventory_changed");
 const items=[],errors=[];
 for(const row of candidates){
  if(row.primaryDocument!=="xsl144X01/primary_doc.xml" ||
    !/^0001950047-26-\d{6}$/.test(row.accessionNumber) ||
    !row.acceptedAt || Date.parse(row.acceptedAt)>Date.parse(HISTORICAL_T0_CUTOFF))
   throw Error("untrusted_rule144_original_locator");
  const url="https://www.sec.gov/Archives/edgar/data/1789029/"+
   row.accessionNumber.replaceAll("-","")+"/primary_doc.xml";
  try{
   const source=await fetcher(url,agent,150000);
   const originalSha256=createHash("sha256").update(source.bytes).digest("hex");
   const parsed=parseRule144(source.bytes.toString("utf8"),row.accessionNumber);
   items.push({...parsed,originalUrl:url,originalSha256,originalBytes:source.bytes.length});
  }catch(e){errors.push({accessionNumber:row.accessionNumber,
    failure:String(e?.message??e).slice(0,150)})}
  if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));
 }
 const matched=reconcileRule144ToForm4(items,form4);
 return {contract:"earth2036-phoenix-p7i-aeva-rule144-overlap-v1",
  mode:"noncanonical_read_only",cutoff:HISTORICAL_T0_CUTOFF,
  noticesExpected:2,originalsVerified:items.length,errors,
  exactForm4OverlapCount:matched.filter(x=>x.matchedOneOriginalSale).length,
  duplicatedSaleSharesAvoided:matched.filter(x=>x.matchedOneOriginalSale)
   .reduce((sum,x)=>sum+x.proposedShares,0),
  july30SharesRestatedInNotices:matched.every(x=>x.filerReportedOutstandingShares===69705758),
  july30ReportedSharesAsOfSeptember12Verified:false,
  companyWideRsuVestingReconciled:false,
  shareCountAsOfCutoffAuthenticated:false,
  historicalT0EvidenceAdmitted:0,marketValuationOpportunity:null,
  chiefReadyAuthorized:false,workerRestartAuthorized:false,canonicalWriteAuthority:false,
  notices:matched};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==4)
  throw Error("Usage: node scripts/phoenix-aeva-rule144-overlap.mjs <filing-window.json> <original-form4.json>");
 console.log(JSON.stringify(await runRule144Overlap(process.argv[2],process.argv[3]),null,2));
}
