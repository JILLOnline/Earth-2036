import test from "node:test";
import assert from "node:assert/strict";
import {deriveAevaHistoricShares,crosscheckIssuerTexts,reconcileSinhaReportedHoldings}
 from "../scripts/phoenix-aeva-rsu-capital-gap.mjs";
import {PINNED_ORIGINAL_FORM4_HASHES}
 from "../scripts/phoenix-aeva-form4-audit.mjs";
import {AEVA_SOURCE_2026_Q2} from "../scripts/lib/phoenix-aeva-valuation-bridge.mjs";
const receipt=()=>({
 contract:"earth2036-phoenix-p7h-aeva-original-Form4-v1",
 cutoff:"2026-09-12T23:59:59-04:00",
 originalXmlVerified:5,canonicalWriteAuthority:false,
 historicalT0EvidenceAdmitted:0,
 filings:[
  {accession:"0001193125-26-359631",
   originalXmlSha256:PINNED_ORIGINAL_FORM4_HASHES["0001193125-26-359631"],
   originalXmlTransactionParse:{
    reportingOwnerCik:"0001849806",reportingOwnerName:"Sinha Saurabh",
    nonDerivativeTransactions:1,derivativeTransactions:0,
    transactions:[{table:"non_derivative",code:"S",acquiredDisposed:"D",
      transactionDate:"2026-08-18",shares:70000,postTransactionBeneficialShares:581372}]}},
  {accession:"0001193125-26-383903",
   originalXmlSha256:PINNED_ORIGINAL_FORM4_HASHES["0001193125-26-383903"],
   originalXmlTransactionParse:{
    reportingOwnerCik:"0001849806",reportingOwnerName:"Sinha Saurabh",
    nonDerivativeTransactions:1,derivativeTransactions:0,
    transactions:[{table:"non_derivative",code:"S",acquiredDisposed:"D",
      transactionDate:"2026-09-02",shares:34146,postTransactionBeneficialShares:547226}]}}
 ]
});
test("financial statement shares reconcile to cover via distinct dated observations",()=>{
 const x=deriveAevaHistoricShares();
 assert.equal(x.q1NetShareIncrease,1404452);
 assert.equal(x.q2NetShareIncrease,5698344);
 assert.equal(x.q2Sources.followOnShares,5168539);
 assert.equal(x.q2Sources.convertibleInterestShares,149037);
 assert.equal(x.june30ToJuly30SharesIncrease,1022811);
 assert.equal(x.june30ToJuly30CauseEstablished,false);
 assert.equal(x.july30ToSeptember12ShareChange,null);
 assert.equal(x.sharesOutstandingSeptember12,null);
 assert.equal(x.firstHalfRsuReleaseReconciles,true);
});
test("original Sinha two filings reconcile beneficial-owner holdings but never issuer outstanding",()=>{
 const x=reconcileSinhaReportedHoldings(receipt());
 assert.equal(x.ownerHoldingsChangeBetweenReportedEndpoints,-34146);
 assert.equal(x.September2SaleShares,34146);
 assert.equal(x.changeMatchesReportedSeptember2Sale,true);
 assert.equal(x.noOtherBeneficialOwnerMovementsProven,false);
 assert.equal(x.grossRsuSharesVestedSeptember2,null);
 assert.equal(x.netNewIssuerSharesFromRsu,null);
 assert.equal(x.originalIssuerShareCountSeptember12Authenticated,false);
});
test("original SEC Q2 accounting values and 8-K transition dates must appear",()=>{
 const q="<html>69,705,758 68,682,947 62,984,603 61,580,151 "+
  "1,395,300 9,152 377,268 3,500 5,168,539 149,037 1,772,568 "+
  "Restricted Stock Units</html>";
 const k="<html>Saurabh Sinha will resign effective September 05, 2026. "+
  "Rupesh Maheshwari interim CFO effective September 05, 2026</html>";
 const parsed=crosscheckIssuerTexts(q,k);
 assert.equal(parsed.q2.requiredIssuerEquityValuesFound,true);
 assert.equal(parsed.transition.notifiedCompanyAt,"2026-07-30");
 assert.equal(parsed.transition.plannedSinhaResignationEffective,"2026-09-05");
 assert.equal(parsed.transition.personnelEventCausedRsuVestingProven,false);
 assert.equal(parsed.transition.completedDepartureIndependentlyAuthenticated,false);
 assert.throws(()=>crosscheckIssuerTexts(q.replace("149,037","159,037"),k),
  /issuer_10Q_equity_leaf_not_found/);
 assert.throws(()=>crosscheckIssuerTexts(q,k.replace("Rupesh Maheshwari","Other")),
  /issuer_8K_CFO_transition_leaf_not_found/);
});
test("edited original Form4 digest, sale amount or owner holdings cannot pass",()=>{
 const a=receipt();a.filings[1].originalXmlSha256="0".repeat(64);
 assert.throws(()=>reconcileSinhaReportedHoldings(a),/form4_original_owner_receipt_invalid/);
 const b=receipt();b.filings[1].originalXmlTransactionParse.transactions[0].shares=90000;
 assert.throws(()=>reconcileSinhaReportedHoldings(b),/form4_post_trade_holding_or_sale_disagreement/);
 const c=receipt();c.filings[1].originalXmlTransactionParse.transactions[0].postTransactionBeneficialShares=559999;
 assert.throws(()=>reconcileSinhaReportedHoldings(c),/form4_post_trade_holding_or_sale_disagreement/);
 const d=receipt();d.historicalT0EvidenceAdmitted=1;
 assert.throws(()=>reconcileSinhaReportedHoldings(d),/untrusted_form4_receipt/);
});

test("capital sensitivity uses exact issuer June 30 common shares, not rounded proxy",()=>{
 const snapshot=deriveAevaHistoricShares();
 assert.equal(AEVA_SOURCE_2026_Q2.basicJuneShares.count,68682947);
 assert.equal(snapshot.datedIssuerBalances[2].shares,
  AEVA_SOURCE_2026_Q2.basicJuneShares.count);
 assert.equal(AEVA_SOURCE_2026_Q2.coverShares.count,69705758);
});
