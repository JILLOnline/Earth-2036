import test from "node:test";
import assert from "node:assert/strict";
import {
 AEVA_SOURCE_2026_Q2,AEVA_LAST_T0_SESSION_PRICE_CANDIDATE,buildAevaValuationBridge
} from "../scripts/lib/phoenix-aeva-valuation-bridge.mjs";

const findCase=(r,note,warrant)=>r.mutuallyExclusiveSettlementScenarios.find(x=>
 x.noteSettlement===note&&x.warrantSettlement===warrant);

test("dated primary financial source and secondary price never become canonical evidence",()=>{
 const a=buildAevaValuationBridge();
 assert.equal(a.contract,"earth2036-phoenix-p7g-aeva-valuation-bridge-v1");
 assert.equal(a.cutoff,"2026-09-12T23:59:59-04:00");
 assert.equal(a.reconciliation.juneEndLiquidityUSD,177889000);
 assert.equal(a.reconciliation.notePrincipalUSD,100000000);
 assert.equal(a.reconciliation.noteCarryingUSD,96896000);
 assert.equal(a.reconciliation.noteDisclosedFairValueUSD,192843000);
 assert.equal(a.reconciliation.warrantDisclosedFairValueUSD,73961000);
 assert.equal(a.reconciliation.potentialSharesExcludedFromEps,20589228);
 assert.equal(a.reconciliation.potentialShareComponentsReconcile,true);
 assert.equal(a.marketPriceCandidate.quoteDate,"2026-09-11");
 assert.equal(a.marketPriceCandidate.closeUSD,15.52);
 assert.equal(a.marketPriceCandidate.pointInTimeProvenanceVerified,false);
 for(const key of ["marketValuationOpportunity","numericalEarthScore"])assert.equal(a[key],null);
 for(const key of ["methodologyFactorSatisfied","canonicalWriteAuthority","chiefReadyAuthorized",
  "canonicalPromotionAuthorized","workerRestartAuthorized","stockExchangePriceTapeAuthenticated",
  "SeptemberCapitalizationAuthenticated","firstPublicAvailabilityAuthenticated"])
  assert.equal(a[key],false);
 assert.equal(a.historicalT0EvidenceAdmitted,0);
});

test("four exclusive conversion/exercise scenarios adjust equity, note principal and exercise cash once",()=>{
 const a=buildAevaValuationBridge();
 assert.equal(a.mutuallyExclusiveSettlementScenarios.length,4);
 const basic=findCase(a,"principal_outstanding","unexercised");
 const convertible=findCase(a,"hypothetical_as_converted","unexercised");
 const exercised=findCase(a,"principal_outstanding","hypothetical_fully_exercised");
 const both=findCase(a,"hypothetical_as_converted","hypothetical_fully_exercised");
 assert.equal(basic.assumedCommonShares,69705758);
 assert.equal(basic.convertibleNotePrincipalRetainedUSD,100000000);
 assert.equal(basic.hypotheticalWarrantProceedsUSD,0);
 assert.equal(convertible.assumedCommonShares,basic.assumedCommonShares+6303480);
 assert.equal(convertible.convertibleNotePrincipalRetainedUSD,0);
 assert.equal(convertible.hypotheticalWarrantProceedsUSD,0);
 assert.equal(exercised.assumedCommonShares,basic.assumedCommonShares+3000000);
 assert.equal(exercised.hypotheticalWarrantProceedsUSD,15000000);
 assert.equal(exercised.juneEndLiquidityPlusHypotheticalProceedsUSD,192889000);
 assert.equal(both.assumedCommonShares,basic.assumedCommonShares+6303480+3000000);
 assert.equal(both.convertibleNotePrincipalRetainedUSD,0);
 assert.equal(both.hypotheticalWarrantProceedsUSD,15000000);
 for(const scenario of a.mutuallyExclusiveSettlementScenarios){
  assert.equal(scenario.hypotheticalEquityUSD,
    Number((scenario.assumedCommonShares*15.52).toFixed(2)));
  assert.equal(scenario.mixedDateUnadjustedEVReferenceUSD,
    Number((scenario.hypotheticalEquityUSD+
      scenario.convertibleNotePrincipalRetainedUSD-
      scenario.juneEndLiquidityPlusHypotheticalProceedsUSD).toFixed(2)));
  assert.equal(scenario.currentAsOfCutoffEnterpriseValueValidated,false);
 }
});

test("SEC EPS excluded shares are not falsely assumed to be the active market denominator",()=>{
 const a=buildAevaValuationBridge();
 assert.equal(a.reconciliation.employeeAndEquityAwardsPotentialShares,11285748);
 assert.equal(a.reconciliation.convertiblePotentialShares,6303480);
 assert.equal(a.reconciliation.seriesAWarrantPotentialShares,3000000);
 assert.equal(a.reconciliation.employeeAndEquityAwardsPotentialShares+
  a.reconciliation.convertiblePotentialShares+
  a.reconciliation.seriesAWarrantPotentialShares,20589228);
 assert.ok(!a.mutuallyExclusiveSettlementScenarios.some(x=>
  x.assumedCommonShares===69705758+20589228));
});

test("fails closed on forged quote, share count, SEC filing hash or moved cutoff",()=>{
 const corruptShares=structuredClone(AEVA_SOURCE_2026_Q2);
 corruptShares.coverShares.count+=1000000;
 assert.throws(()=>buildAevaValuationBridge({source:corruptShares}),
  /unverified_snapshot_or_secondary_quote_override/);
 const corruptedHash=structuredClone(AEVA_SOURCE_2026_Q2);
 corruptedHash.primarySha256="0".repeat(64);
 assert.throws(()=>buildAevaValuationBridge({source:corruptedHash}),
  /unverified_snapshot_or_secondary_quote_override/);
 const quote=structuredClone(AEVA_LAST_T0_SESSION_PRICE_CANDIDATE);
 quote.closeUSD+=1;
 assert.throws(()=>buildAevaValuationBridge({quote}),
  /unverified_snapshot_or_secondary_quote_override/);
 assert.throws(()=>buildAevaValuationBridge({cutoff:"2026-10-18T00:00:00-04:00"}),
  /historical_t0_cutoff_immutable/);
});
