import test from "node:test";
import assert from "node:assert/strict";
import {parseSecFilingDetailAccepted,reconcileAcceptance} from "../scripts/phoenix-sec-acceptance-reconcile.mjs";
test("parse exact original SEC filing-detail time, not metadata nearby",()=>{
 const html='<div class="infoHead">Accepted</div><div class="info">2026-07-28 16:48:13</div>';
 assert.equal(parseSecFilingDetailAccepted(html),"20260728164813");
 assert.equal(parseSecFilingDetailAccepted("<div>not Accepted</div>"),null);
});
test("reproduce SWKS 2026-07-28 submissions-vs-primary four-hour drift",()=>{
 const x=reconcileAcceptance({
  sgmlLocal:"20260728164813",indexLocal:"20260728164813",
  feedISO:"2026-07-29T00:48:13.000Z"});
 assert.equal(x.primarySecAgreement,true);
 assert.equal(x.submissionsDisagreesWithPrimary,true);
 assert.equal(x.primarySecAcceptanceByT0,true);
 assert.equal(x.originalFirstPublicAvailabilityAuthenticated,false);
 assert.equal(x.historicalT0EvidenceAdmitted,false);
});
test("reproduce winter five-hour drift, do not assume single daylight offset",()=>{
 const x=reconcileAcceptance({sgmlLocal:"20260130160648",
  indexLocal:"20260130160648",feedISO:"2026-01-31T02:06:48.000Z"});
 assert.equal(x.submissionsDisagreesWithPrimary,true);
 assert.equal(x.primarySecAgreement,true);
});
test("AEVA normal feed agrees with matching original SEC header/index",()=>{
 const x=reconcileAcceptance({sgmlLocal:"20260806162705",
  indexLocal:"20260806162705",feedISO:"2026-08-06T20:27:05.000Z"});
 assert.equal(x.submissionsAgreesWithPrimary,true);
 assert.equal(x.primarySecAcceptanceByT0,true);
});
test("missing SEC detail, conflicting source or future local acceptance stays unverified",()=>{
 assert.equal(reconcileAcceptance({sgmlLocal:"20260728164813",
  indexLocal:null,feedISO:"2026-07-29T00:48:13Z"}).primarySecAgreement,false);
 assert.equal(reconcileAcceptance({sgmlLocal:"20260728164813",
  indexLocal:"20260728164814",feedISO:"2026-07-29T00:48:13Z"}).primarySecAcceptanceByT0,false);
 assert.equal(reconcileAcceptance({sgmlLocal:"20260913010000",
  indexLocal:"20260913010000",feedISO:"2026-09-13T05:00:00Z"}).primarySecAcceptanceByT0,false);
});
