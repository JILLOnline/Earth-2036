#!/usr/bin/env node
// Phoenix P7H: original pre-T0 AEVA SEC Form 4 transaction-code audit.
// NONCANONICAL; Form 4 owner transactions never establish issuer share counts.
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {fetchBounded} from "./phoenix-edgar-primary-pilot.mjs";
import {HISTORICAL_T0_CUTOFF} from "./lib/phoenix-historical-filing-precheck.mjs";

const CIK="0001789029";
export const PINNED_ORIGINAL_FORM4_HASHES=Object.freeze({
 "0001193125-26-347439":"630550f28193a85ca7095e9186d073cc941adbec6f440e9bf0052cec2de330c7",
 "0001193125-26-347443":"15e523f42e8959b9ce638bdfd12da9f2f97aa68da709ac0bc1f6b7731c48f521",
 "0001193125-26-352272":"5384536320a695109a08d55dd74cf7882c48768b509ab7cf91c1604b8aa5b5da",
 "0001193125-26-359631":"8fed58031bfcfc1a03ce1348da00477fe50a985c7e4c8c9c5b625ce5772a7411",
 "0001193125-26-383903":"efabd3b407d3d0a1ee90e4bfe913f9e220e71e7ad495c1db5fba7d8597eec07f"
});
export const EXPECTED_FORM4_ACCESSIONS=Object.freeze([
 "0001193125-26-347439","0001193125-26-347443","0001193125-26-352272",
 "0001193125-26-359631","0001193125-26-383903"
]);
const value=(xml,tag)=> {
 const x=xml.match(new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+tag+">"));
 return x?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").trim()??null;
};
const blocks=(xml,tag)=>[...xml.matchAll(new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+tag+">","g"))].map(x=>x[1]);
const nested=(xml,path)=>{
 let cursor=xml;
 for(const segment of path) {
  cursor=value(cursor,segment);
  if(cursor===null)return null;
 }
 return cursor;
};
const numeric=x=>x!==null&&/^\d+(?:\.\d+)?$/.test(x)?Number(x):null;
function transaction(block,table){
 const code=nested(block,["transactionCoding","transactionCode"]);
 const shares=numeric(nested(block,["transactionAmounts","transactionShares","value"]));
 const date=nested(block,["transactionDate","value"]);
 const acquiredDisposed=nested(block,["transactionAmounts","transactionAcquiredDisposedCode","value"]);
 const after=numeric(nested(block,["postTransactionAmounts",
    "sharesOwnedFollowingTransaction","value"]));
 const security=nested(block,["securityTitle","value"]);
 const footnoteIds=[...block.matchAll(/<footnoteId\s+id="([^"]+)"\s*\/>/g)].map(m=>m[1]);
 return {
  table,security,transactionDate:date,code,
  acquiredDisposed,shares,postTransactionBeneficialShares:after,
  relatedFootnoteIds:[...new Set(footnoteIds)].sort(),
  codeInterpretation:({S:"reported_sale",P:"reported_purchase",
   M:"reported_option_exercise_or_conversion",F:"reported_tax_or_exercise_price_withholding",
   A:"reported_grant_or_award",C:"reported_derivative_conversion",
   G:"reported_gift",D:"reported_disposition_to_issuer"})[code]??"requires_manual_code_review",
  issuanceFromIssuerConfirmed:false,
  denominatorChangeQuantified:false
 };
}
export function parseOwnershipXml(xml,{expectedAccession}={}){
 if(typeof xml!=="string"||xml.length>1_200_000 ||/<!DOCTYPE|<!ENTITY/i.test(xml))
  throw Error("untrusted_or_unbounded_Form4_XML");
 if(!xml.includes("<ownershipDocument")||value(xml,"documentType")!=="4")
  throw Error("not_original_Form4_ownership_document");
 const issuerCik=nested(xml,["issuer","issuerCik"]);
 if(String(Number(issuerCik))!=="1789029")throw Error("Form4_issuer_CIK_mismatch");
 const reportedOwnerCik=nested(xml,["reportingOwner","reportingOwnerId","rptOwnerCik"]);
 const reportedOwnerName=nested(xml,["reportingOwner","reportingOwnerId","rptOwnerName"]);
 const reportingPeriod=value(xml,"periodOfReport");
 const nonDerivative=blocks(xml,"nonDerivativeTransaction").map(x=>transaction(x,"non_derivative"));
 const derivative=blocks(xml,"derivativeTransaction").map(x=>transaction(x,"derivative"));
 const transactions=[...nonDerivative,...derivative];
 const allFootnotes=blocks(xml,"footnote").slice(0,100).map(block=>
  block.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,1300));
 const codeCounts={};
 for(const t of transactions){
  if(!t.code||!t.transactionDate||!Number.isFinite(Date.parse(t.transactionDate+"T12:00:00Z")))
   throw Error("Form4_transaction_critical_fields_missing");
  codeCounts[t.code]=(codeCounts[t.code]??0)+1;
 }
 if(!reportedOwnerCik || !reportedOwnerName)
  throw Error("Form4_reporting_owner_identity_missing");
 return {issuerCik:CIK,reportingOwnerCik:reportedOwnerCik,
  reportingOwnerName:reportedOwnerName,reportingPeriod,
  expectedAccession:expectedAccession??null,
  nonDerivativeTransactions:nonDerivative.length,
  derivativeTransactions:derivative.length,
  codeCounts,transactions,
  footnoteExcerptsForManualReview:allFootnotes,
  issuerShareIssuanceAuthenticated:false,
  outstandingSharesAtT0Authenticated:false};
}
export function choosePreT0Forms4(window){
 if(window?.contract!=="earth2036-phoenix-p7g-aeva-sec-issuer-filing-window-v1"||
  window.cutoff!==HISTORICAL_T0_CUTOFF||window.cik!==CIK||
  window.canonicalWriteAuthority!==false ||
  window.historicalT0EvidenceAdmitted!==0||
  !Array.isArray(window.records))throw Error("untrusted_issuer_filing_window");
 const selected=window.records.filter(x=>x.form==="4");
 const found=selected.map(x=>x.accessionNumber).sort();
 if(JSON.stringify(found)!==JSON.stringify([...EXPECTED_FORM4_ACCESSIONS].sort()))
  throw Error("AEVA_Form4_historical_inventory_changed");
 for(const row of selected){
  if(row.filingDate>"2026-09-12"||
    typeof row.acceptedAt!=="string"||
    Date.parse(row.acceptedAt)>Date.parse(HISTORICAL_T0_CUTOFF)||
    row.primaryDocument!=="xslF345X06/ownership.xml")
    throw Error("unsafe_or_incomplete_original_Form4_locator");
 }
 return selected;
}
export async function auditAevaForm4(file,{
 agent=process.env.SEC_USER_AGENT,fetcher=fetchBounded,delayMs=250}={}){
 if(!agent||agent.length<20)throw Error("SEC_USER_AGENT_required");
 const window=JSON.parse(await readFile(file,"utf8"));
 const rows=choosePreT0Forms4(window);
 const result={
  contract:"earth2036-phoenix-p7h-aeva-original-Form4-v1",
  mode:"read_only_noncanonical",
  cutoff:HISTORICAL_T0_CUTOFF,expectedFilings:5,
  originalXmlVerified:0,ownerTransactionRows:0,
  saleTransactions:0,reportedSaleShares:0,
  reportedSalesProveNetIssuerShareCountChange:false,
  issuerShareIssuanceAuthenticated:false,
  outstandingSharesAtT0Authenticated:false,
  stockExchangePriceTapeAuthenticated:false,
  historicalT0EvidenceAdmitted:0,marketValuationOpportunity:null,
  workerRestartAuthorized:false,chiefReadyAuthorized:false,
  canonicalWriteAuthority:false,filings:[]
 };
 for(const row of rows){
  const base="https://www.sec.gov/Archives/edgar/data/1789029/"+
   row.accessionNumber.replaceAll("-","")+"/";
  // SEC submissions points at an XSL-rendered path; retrieve its raw source XML.
  // The SEC filing-detail document listing separately identifies ownership.xml.
  const url=base+"ownership.xml";
  const entry={accession:row.accessionNumber,sourceUrl:url,
   filingDate:row.filingDate,acceptedAtFromSubmissions:row.acceptedAt,
   originalXmlSha256:null,originalXmlBytes:null,status:"unverified",
   originalXmlTransactionParse:null,issuanceAuthorized:false};
  try{
   const response=await fetcher(url,agent,1_200_000);
   const bytes=response.bytes;
   const parsed=parseOwnershipXml(bytes.toString("utf8"),
     {expectedAccession:row.accessionNumber});
   entry.originalXmlSha256=createHash("sha256").update(bytes).digest("hex");
   if(entry.originalXmlSha256!==PINNED_ORIGINAL_FORM4_HASHES[row.accessionNumber])
    throw Error("historical_Form4_original_XML_digest_changed");
   entry.originalXmlBytes=bytes.length;
   entry.originalXmlTransactionParse=parsed;
   entry.status="original_SEC_Form4_XML_verified_now";
   result.originalXmlVerified++;
   result.ownerTransactionRows+=parsed.transactions.length;
   for(const t of parsed.transactions){
    if(t.table==="non_derivative"&&t.code==="S"&&t.acquiredDisposed==="D"){
     result.saleTransactions++;
     if(Number.isSafeInteger(t.shares)&&t.shares>=0)
      result.reportedSaleShares+=t.shares;
    }
   }
  }catch(error){
   entry.status="unverified:"+String(error?.message??error).slice(0,150);
  }
  result.filings.push(entry);
  if(delayMs)await new Promise(done=>setTimeout(done,delayMs));
 }
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)
  throw Error("Usage: node scripts/phoenix-aeva-form4-audit.mjs <filing-window.json>");
 console.log(JSON.stringify(await auditAevaForm4(process.argv[2]),null,2));
}
