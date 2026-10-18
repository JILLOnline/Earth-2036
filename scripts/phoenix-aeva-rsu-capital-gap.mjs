#!/usr/bin/env node
// Phoenix P7J: date-aligned AEVA issuer share roll-forward, owner-level RSU
// tax-sale, and pre-cutoff CFO-transition source check. READ ONLY.
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {fetchBounded} from "./phoenix-edgar-primary-pilot.mjs";
import {PINNED_ORIGINAL_FORM4_HASHES} from "./phoenix-aeva-form4-audit.mjs";
import {HISTORICAL_T0_CUTOFF} from "./lib/phoenix-historical-filing-precheck.mjs";

export const Q2_URL="https://www.sec.gov/Archives/edgar/data/1789029/000119312526338179/aeva-20260630.htm";
export const Q2_SHA256="50a50d985259e53b3aa25eddcdc0fa1a654d724d8c079d7030261a43de7b0b35";
export const TRANSITION_8K_URL="https://www.sec.gov/Archives/edgar/data/1789029/000119312526335102/aeva-20260730.htm";
export const TRANSITION_8K_SHA256="b050086dad483b12be4c2bf5cccc7dafb70f3bb89a859d3236b92de7233708c0";
const sha256=b=>createHash("sha256").update(b).digest("hex");
const normalize=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
 .replace(/<[^>]{0,1000}>/g," ").replace(/&nbsp;|&#160;|\u00a0/g," ")
 .replace(/&amp;/g,"&").replace(/\s+/g," ").trim();

const amounts=Object.freeze({
 dec2025:61580151,mar2026:62984603,jun2026:68682947,jul30:69705758,
 q1Rsu:1395300,q1Options:9152,
 q2Rsu:377268,q2Options:3500,q2FollowOn:5168539,q2NotesInterest:149037,
 firstHalfReleasedRsu:1772568
});
export function deriveAevaHistoricShares(){
 const marchMovement=amounts.mar2026-amounts.dec2025;
 const juneMovement=amounts.jun2026-amounts.mar2026;
 if(marchMovement!==amounts.q1Rsu+amounts.q1Options ||
    juneMovement!==amounts.q2Rsu+amounts.q2Options+
      amounts.q2FollowOn+amounts.q2NotesInterest ||
    amounts.firstHalfReleasedRsu!==amounts.q1Rsu+amounts.q2Rsu)
  throw Error("issuer_equity_statement_share_rollforward_failed");
 return {
  datedIssuerBalances:[
   {date:"2025-12-31",shares:amounts.dec2025,source:"SEC_10Q_equity_statement"},
   {date:"2026-03-31",shares:amounts.mar2026,source:"SEC_10Q_equity_statement"},
   {date:"2026-06-30",shares:amounts.jun2026,source:"SEC_10Q_equity_statement"},
   {date:"2026-07-30",shares:amounts.jul30,source:"SEC_10Q_cover"}
  ],
  q1NetShareIncrease:marchMovement,
  q1Sources:{releasedRsu:amounts.q1Rsu,exercisedOptions:amounts.q1Options},
  q2NetShareIncrease:juneMovement,
  q2Sources:{releasedRsu:amounts.q2Rsu,exercisedOptions:amounts.q2Options,
   followOnShares:amounts.q2FollowOn,convertibleInterestShares:amounts.q2NotesInterest},
  firstHalfRsuReleaseReconciles:true,
  june30ToJuly30SharesIncrease:amounts.jul30-amounts.jun2026,
  june30ToJuly30CauseEstablished:false,
  july30ToSeptember12ShareChange:null,
  sharesOutstandingSeptember12:null
 };
}
export function crosscheckIssuerTexts(q2Html,eightKHtml){
 if(typeof q2Html!=="string"||typeof eightKHtml!=="string")
  throw Error("issuer_source_text_unavailable");
 const q=normalize(q2Html),k=normalize(eightKHtml);
 for(const token of [
  "69,705,758","68,682,947","62,984,603","61,580,151",
  "1,395,300","9,152","377,268","3,500","5,168,539","149,037",
  "1,772,568","Restricted Stock Units"
 ])if(!q.includes(token))throw Error("issuer_10Q_equity_leaf_not_found:"+token);
 if(!k.includes("0001193125")&& !k.includes("Saurabh Sinha"))
  throw Error("issuer_8K_transition_identity_not_found");
 for(const token of ["Saurabh Sinha","Rupesh Maheshwari","September 05, 2026"])
  if(!k.includes(token))throw Error("issuer_8K_CFO_transition_leaf_not_found:"+token);
 const q2={requiredIssuerEquityValuesFound:true,sourcePeriod:"2026-06-30",
  coverShareDate:"2026-07-30"};
 const transition={form:"8-K",accession:"0001193125-26-335102",
  filingDate:"2026-08-05",notifiedCompanyAt:"2026-07-30",
  plannedSinhaResignationEffective:"2026-09-05",
  interimCfoRupeshMaheshwariEffective:"2026-09-05",
  completedDepartureIndependentlyAuthenticated:false,
  personnelEventCausedRsuVestingProven:false};
 return {q2,transition};
}
export function reconcileSinhaReportedHoldings(form4){
 if(form4?.contract!=="earth2036-phoenix-p7h-aeva-original-Form4-v1"||
  form4.cutoff!==HISTORICAL_T0_CUTOFF||form4.canonicalWriteAuthority!==false||
  form4.historicalT0EvidenceAdmitted!==0||form4.originalXmlVerified!==5||
  !Array.isArray(form4.filings))throw Error("untrusted_form4_receipt");
 const expected=[
  {acc:"0001193125-26-359631",date:"2026-08-18",sold:70000,after:581372},
  {acc:"0001193125-26-383903",date:"2026-09-02",sold:34146,after:547226}
 ];
 const matches=expected.map(e=>{
  const rows=form4.filings.filter(x=>x.accession===e.acc);
  if(rows.length!==1)throw Error("missing_or_duplicated_original_owner_record");
  const f=rows[0],p=f.originalXmlTransactionParse;
  if(f.originalXmlSha256!==PINNED_ORIGINAL_FORM4_HASHES[e.acc]||
     String(Number(p?.reportingOwnerCik))!=="1849806"||
     p?.nonDerivativeTransactions!==1 || p?.derivativeTransactions!==0 ||
     p.transactions?.length!==1)
    throw Error("form4_original_owner_receipt_invalid");
  const t=p.transactions[0];
  if(t.table!=="non_derivative"||t.code!=="S"||t.acquiredDisposed!=="D"||
    t.transactionDate!==e.date ||t.shares!==e.sold ||
    t.postTransactionBeneficialShares!==e.after)
    throw Error("form4_post_trade_holding_or_sale_disagreement");
  return {accession:e.acc,date:e.date,reportedSaleShares:e.sold,
   postTransactionBeneficialShares:e.after,
   reportingOwnerCik:p.reportingOwnerCik,originalXmlSha256:f.originalXmlSha256};
 });
 const delta=matches[1].postTransactionBeneficialShares-
  matches[0].postTransactionBeneficialShares;
 const attributable=-matches[1].reportedSaleShares;
 if(delta!==attributable)throw Error("owner_reported_holding_change_not_explained_by_sale");
 return {
  reportingOwner:"Saurabh Sinha",ownerCik:"0001849806",filings:matches,
  ownerHoldingsChangeBetweenReportedEndpoints:delta,
  September2SaleShares:matches[1].reportedSaleShares,
  changeMatchesReportedSeptember2Sale:true,
  noOtherBeneficialOwnerMovementsProven:false,
  grossRsuSharesVestedSeptember2:null,
  netNewIssuerSharesFromRsu:null,
  reportedOwnerSharesAreIssuerOutstandingShares:false,
  originalIssuerShareCountSeptember12Authenticated:false
 };
}
export async function auditAevaRsuTransition(form4File,{
 agent=process.env.SEC_USER_AGENT,fetcher=fetchBounded}={}){
 if(!agent||agent.length<20)throw Error("SEC_USER_AGENT_required");
 const form4=JSON.parse(await readFile(form4File,"utf8"));
 const owner=reconcileSinhaReportedHoldings(form4);
 const q2=await fetcher(Q2_URL,agent,18*1024*1024);
 if(sha256(q2.bytes)!==Q2_SHA256)throw Error("issuer_10Q_primary_source_hash_mismatch");
 const eightK=await fetcher(TRANSITION_8K_URL,agent,2*1024*1024);
 if(!eightK?.bytes?.length)throw Error("issuer_8K_unretrievable");
 if(sha256(eightK.bytes)!==TRANSITION_8K_SHA256)
  throw Error("issuer_8K_primary_source_hash_mismatch");
 const primary=crosscheckIssuerTexts(q2.bytes.toString("utf8"),eightK.bytes.toString("utf8"));
 return {
  contract:"earth2036-phoenix-p7j-aeva-rsu-capital-gap-v1",
  mode:"read_only_noncanonical",cutoff:HISTORICAL_T0_CUTOFF,
  sources:{
   q2:{url:Q2_URL,sha256:Q2_SHA256,bytes:q2.bytes.length,
    accession:"0001193125-26-338179"},
   eightK:{url:TRANSITION_8K_URL,sha256:TRANSITION_8K_SHA256,
    bytes:eightK.bytes.length,accession:"0001193125-26-335102"}
  },issuerPrimaryCrosscheck:primary,
  issuerShares:deriveAevaHistoricShares(),
  ownerRsuSale:owner,
  temporalGuard:"no_Q3_issuer_share_count_inferred_from_Q2_or_owner_holdings",
  September12IssuerShares:null,
  September2GrossRsuSharesVested:null,
  September2NetSharesNewlyIssued:null,
  historicalT0EvidenceAdmitted:0,marketValuationOpportunity:null,
  stockExchangePriceTapeAuthenticated:false,
  sourceIntegrityReviewComplete:false,
  capitalDenominatorAuthenticated:false,
  chiefReadyAuthorized:false,canonicalWriteAuthority:false,workerRestartAuthorized:false
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)
  throw Error("Usage: node scripts/phoenix-aeva-rsu-capital-gap.mjs <original-form4-audit.json>");
 console.log(JSON.stringify(await auditAevaRsuTransition(process.argv[2]),null,2));
}
