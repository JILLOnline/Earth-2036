import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFundamentalsTruth,
  extractAllStandardFacts,
  extractMetricFacts,
  normalizeMetric,
  validateFundamentalsTruth,
} from "../scripts/lib/sec-fundamentals-truth.mjs";

function payload(overrides={}){
  return {
    cik:1551182,
    entityName:"Truth Test Corp",
    facts:{
      "us-gaap":{
        RevenueFromContractWithCustomerExcludingAssessedTax:{
          label:"Revenue",units:{USD:[
            {start:"2025-01-01",end:"2025-12-31",val:100,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY",frame:"CY2025"},
            {start:"2025-01-01",end:"2025-12-31",val:105,filed:"2026-03-01",accn:"A2",form:"10-K/A",fy:2025,fp:"FY",frame:"CY2025"},
            {start:"2026-01-01",end:"2026-03-31",val:30,filed:"2026-05-01",accn:"Q1",form:"10-Q",fy:2026,fp:"Q1",frame:"CY2026Q1"},
            {start:"2026-01-01",end:"2026-06-30",val:65,filed:"2026-08-01",accn:"Q2",form:"10-Q",fy:2026,fp:"Q2"}
          ]}
        },
        GrossProfit:{label:"Gross Profit",units:{USD:[
          {start:"2025-01-01",end:"2025-12-31",val:40,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        OperatingIncomeLoss:{label:"Operating Income",units:{USD:[
          {start:"2025-01-01",end:"2025-12-31",val:15,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        NetIncomeLoss:{label:"Net Income",units:{USD:[
          {start:"2025-01-01",end:"2025-12-31",val:12,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        NetCashProvidedByUsedInOperatingActivities:{label:"OCF",units:{USD:[
          {start:"2025-01-01",end:"2025-12-31",val:20,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        PaymentsToAcquirePropertyPlantAndEquipment:{label:"Capex",units:{USD:[
          {start:"2025-01-01",end:"2025-12-31",val:5,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        CashAndCashEquivalentsAtCarryingValue:{label:"Cash",units:{USD:[
          {end:"2025-12-31",val:40,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        LongTermDebtCurrent:{label:"Current Debt",units:{USD:[
          {end:"2025-12-31",val:10,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        LongTermDebtNoncurrent:{label:"Noncurrent Debt",units:{USD:[
          {end:"2025-12-31",val:30,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        ResearchAndDevelopmentExpense:{label:"R&D",units:{USD:[
          {start:"2025-01-01",end:"2025-12-31",val:7,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        InventoryNet:{label:"Inventory",units:{USD:[
          {end:"2025-12-31",val:9,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}}
      },
      dei:{
        EntityCommonStockSharesOutstanding:{label:"Shares",units:{shares:[
          {end:"2025-12-31",val:1000,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}}
      }
    },
    ...overrides
  };
}

test("raw truth preserves standard facts we did not choose as named metrics",()=>{
  const facts=extractAllStandardFacts(payload(),"2026-04-01T00:00:00Z");
  assert.ok(facts.some(f=>f.tag==="ResearchAndDevelopmentExpense"));
  assert.ok(facts.some(f=>f.tag==="InventoryNet"));
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.equal(truth.primaryLearningAuthority,"rawTruth.facts");
  assert.equal(truth.rawTruth.learningAuthority,true);
  assert.equal(truth.normalizedProjection.learningAuthority,false);
  assert.ok(truth.rawTruth.facts.every((fact)=>!("label" in fact)&&!("description" in fact)));
});

test("future-filed facts are excluded point-in-time",()=>{
  const facts=extractAllStandardFacts(payload(),"2026-02-15T00:00:00Z");
  assert.equal(facts.some(f=>f.accn==="A2"),false);
  assert.equal(facts.some(f=>f.accn==="A1"),true);
});

test("same-day facts are conservatively unavailable until UTC day end",()=>{
  const noon=extractAllStandardFacts(payload(),"2026-02-01T12:00:00Z");
  const next=extractAllStandardFacts(payload(),"2026-02-02T00:00:00Z");
  assert.equal(noon.some(f=>f.accn==="A1"),false);
  assert.equal(next.some(f=>f.accn==="A1"),true);
});

test("same-context amendments supersede current view but immutable history remains",()=>{
  const metric=normalizeMetric(payload(),"revenue","2026-04-01T00:00:00Z");
  assert.equal(metric.currentFacts.some(f=>f.accn==="A2"),true);
  assert.equal(metric.currentFacts.some(f=>f.accn==="A1"),false);
  assert.ok(metric.supersededFacts.some(f=>f.accn==="A1"&&f.supersededBy==="A2"));
  assert.equal(metric.latest.annual.selected.val,105);
});

test("conflicting standard concepts become unknown instead of silently reconciled",()=>{
  const sample=payload();
  sample.facts["us-gaap"].Revenues={label:"Revenues",units:{USD:[
    {start:"2025-01-01",end:"2025-12-31",val:99,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
  ]}};
  const metric=normalizeMetric(sample,"revenue","2026-04-01T00:00:00Z");
  assert.equal(metric.latest.annual.status,"ambiguous_concepts");
  assert.equal(metric.latest.annual.selected,null);
});

test("8-K remains in raw truth but cannot silently supersede normalized periodic fundamentals",()=>{
  const sample=payload();
  sample.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(
    {start:"2025-01-01",end:"2025-12-31",val:999,filed:"2026-03-15",accn:"E1",form:"8-K",fy:2025,fp:"FY"}
  );
  const raw=extractAllStandardFacts(sample,"2026-04-01T00:00:00Z");
  const normalized=extractMetricFacts(sample,"revenue","2026-04-01T00:00:00Z");
  assert.ok(raw.some(f=>f.accn==="E1"));
  assert.equal(normalized.some(f=>f.accn==="E1"),false);
  assert.equal(normalizeMetric(sample,"revenue","2026-04-01T00:00:00Z").latest.annual.selected.val,105);
});

test("derived values require same period unit and accession",()=>{
  const early=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-02-15T00:00:00Z"});
  const late=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.equal(early.normalizedProjection.derived.gross_margin.observations.find(x=>x.end==="2025-12-31").value,0.4);
  assert.equal(early.normalizedProjection.derived.free_cash_flow.observations.find(x=>x.end==="2025-12-31").value,15);
  assert.equal(late.normalizedProjection.derived.gross_margin.observations.find(x=>x.end==="2025-12-31"),undefined);
});

test("different currencies are never silently combined",()=>{
  const sample=payload();
  sample.facts["us-gaap"].PaymentsToAcquirePropertyPlantAndEquipment.units={
    EUR:[{start:"2025-01-01",end:"2025-12-31",val:5,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}]
  };
  const truth=buildFundamentalsTruth(sample,{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.equal(truth.normalizedProjection.derived.free_cash_flow.observations.length,0);
});

test("raw truth contains no Earth rank score or methodology context",()=>{
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.equal(truth.earthContextIncluded,false);
  assert.equal("earthScore" in truth,false);
  assert.equal("rank" in truth,false);
  assert.equal(truth.identity.learningEligible,false);
  assert.equal(truth.source.learningEligible,false);
  assert.deepEqual(validateFundamentalsTruth(truth),[]);
});

test("tampering raw source facts is caught by independent hashes",()=>{
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  truth.rawTruth.facts[0].val=999999;
  const errors=validateFundamentalsTruth(truth);
  assert.ok(errors.includes("raw facts hash mismatch"));
  assert.ok(errors.includes("fact-state hash mismatch"));
});

test("nine-month 10-Q remains year-to-date not annual",()=>{
  const sample=payload();
  sample.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(
    {start:"2026-01-01",end:"2026-09-30",val:300,filed:"2026-11-01",accn:"Q3",form:"10-Q",fy:2026,fp:"Q3"}
  );
  const metric=normalizeMetric(sample,"revenue","2026-11-15T00:00:00Z");
  assert.equal(metric.latest.annual.selected.val,105);
  assert.equal(metric.latest.yearToDate.selected.val,300);
});

test("comparative refilings supersede the same economic context even when fy metadata changes",()=>{
  const sample=payload();
  sample.facts["us-gaap"].GrossProfit.units.USD.push(
    {start:"2025-01-01",end:"2025-12-31",val:41,filed:"2027-02-01",accn:"A3",form:"10-K",fy:2026,fp:"FY"}
  );
  const metric=normalizeMetric(sample,"gross_profit","2027-03-01T00:00:00Z");
  assert.equal(metric.currentFacts.filter(f=>f.start==="2025-01-01"&&f.end==="2025-12-31").length,1);
  assert.equal(metric.currentFacts.find(f=>f.end==="2025-12-31").accn,"A3");
});

test("metric freshness is mechanical metadata only",()=>{
  const metric=normalizeMetric(payload(),"cash_and_equivalents","2026-04-01T12:00:00Z");
  assert.equal(metric.freshness.latestPeriodEnd,"2025-12-31");
  assert.equal(metric.freshness.periodEndAgeDays,91);
  assert.equal("stale" in metric.freshness,false);
});


test("future additions to a modern Company Facts payload cannot alter an earlier truth state",()=>{
  const base=payload();
  const historical=buildFundamentalsTruth(base,{
    ticker:"TEST",asOf:"2026-02-15T23:59:59Z"
  });

  const later=structuredClone(base);
  later.entityName="Future Renamed Corp";
  later.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.label="Future taxonomy label";
  later.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(
    {start:"2027-01-01",end:"2027-12-31",val:9999,filed:"2028-02-01",accn:"FUTURE",form:"10-K",fy:2027,fp:"FY"}
  );

  const reconstructed=buildFundamentalsTruth(later,{
    ticker:"FUTR",asOf:"2026-02-15T23:59:59Z"
  });

  assert.equal(reconstructed.factStateHash,historical.factStateHash);
  assert.equal(reconstructed.rawTruth.factsHash,historical.rawTruth.factsHash);
  assert.deepEqual(reconstructed.rawTruth.facts,historical.rawTruth.facts);
  assert.notEqual(reconstructed.identity.entityName,historical.identity.entityName);
  assert.notEqual(reconstructed.identity.ticker,historical.identity.ticker);
});

test("our normalized projection can change without redefining or mutating source truth",()=>{
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  const originalFactStateHash=truth.factStateHash;
  const originalRawFacts=structuredClone(truth.rawTruth.facts);
  truth.normalizedProjection.metrics.revenue.latest.annual.selected.val=123456;
  const errors=validateFundamentalsTruth(truth);
  assert.deepEqual(truth.rawTruth.facts,originalRawFacts);
  assert.equal(truth.factStateHash,originalFactStateHash);
  assert.ok(errors.includes("projection hash mismatch"));
  assert.equal(errors.includes("raw facts hash mismatch"),false);
  assert.equal(errors.includes("fact-state hash mismatch"),false);
});

test("unchanged eligible facts reuse the same content-addressed fact state across later snapshots",()=>{
  const a=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  const b=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-02T00:00:00Z"});
  assert.equal(a.factStateHash,b.factStateHash);
  assert.notEqual(a.snapshotHash,b.snapshotHash);
});

test("raw version index is compact and reconstructs current/superseded counts",()=>{
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.equal(truth.rawTruth.currentFactCount,truth.rawTruth.currentFactIndexes.length);
  assert.equal(truth.rawTruth.supersededFactCount,truth.rawTruth.supersessions.length);
  assert.equal("currentFacts" in truth.rawTruth,false);
  assert.equal("supersededFacts" in truth.rawTruth,false);
  assert.ok(truth.rawTruth.currentFactIndexes.every((index)=>Number.isInteger(index)&&index>=0&&index<truth.rawTruth.facts.length));
});

test("historical truth never contains facts filed after the requested cutoff",()=>{
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-02-15T23:59:59Z"});
  assert.ok(truth.rawTruth.facts.length>0);
  assert.ok(truth.rawTruth.facts.every((fact)=>fact.filed<="2026-02-15"));
  assert.ok(!truth.rawTruth.facts.some((fact)=>fact.accn==="A2"||fact.accn==="Q1"||fact.accn==="Q2"));
});


test("same-day conflicting versions remain jointly current instead of inventing accession order",()=>{
  const sample=payload();
  sample.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(
    {start:"2025-01-01",end:"2025-12-31",val:106,filed:"2026-03-01",accn:"A2B",form:"10-K/A",fy:2025,fp:"FY"}
  );
  const metric=normalizeMetric(sample,"revenue","2026-04-01T00:00:00Z");
  assert.equal(metric.latest.annual.status,"ambiguous_concepts");
  assert.equal(metric.latest.annual.selected,null);
  const truth=buildFundamentalsTruth(sample,{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  const current=truth.rawTruth.currentFactIndexes.map((index)=>truth.rawTruth.facts[index])
    .filter((fact)=>fact.tag==="RevenueFromContractWithCustomerExcludingAssessedTax"&&fact.end==="2025-12-31");
  assert.deepEqual(current.map((fact)=>fact.accn).sort(),["A2","A2B"]);
});
