import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFundamentalsTruth,
  extractMetricFacts,
  normalizeMetric,
  validateFundamentalsTruth,
} from "../scripts/lib/sec-fundamentals-truth.mjs";

function payload(overrides = {}) {
  return {
    cik: 1551182,
    entityName: "Truth Test Corp",
    facts: {
      "us-gaap": {
        RevenueFromContractWithCustomerExcludingAssessedTax: {
          label: "Revenue",
          units: { USD: [
            { start: "2025-01-01", end: "2025-12-31", val: 100, filed: "2026-02-01", accn: "A1", form: "10-K", fy: 2025, fp: "FY", frame: "CY2025" },
            { start: "2025-01-01", end: "2025-12-31", val: 105, filed: "2026-03-01", accn: "A2", form: "10-K/A", fy: 2025, fp: "FY", frame: "CY2025" },
            { start: "2026-01-01", end: "2026-03-31", val: 30, filed: "2026-05-01", accn: "Q1", form: "10-Q", fy: 2026, fp: "Q1", frame: "CY2026Q1" },
            { start: "2026-01-01", end: "2026-06-30", val: 65, filed: "2026-08-01", accn: "Q2", form: "10-Q", fy: 2026, fp: "Q2" }
          ] }
        },
        GrossProfit: {
          label: "Gross Profit",
          units: { USD: [
            { start: "2025-01-01", end: "2025-12-31", val: 40, filed: "2026-02-01", accn: "A1", form: "10-K", fy: 2025, fp: "FY", frame: "CY2025" }
          ] }
        },
        OperatingIncomeLoss: {
          label: "Operating Income",
          units: { USD: [
            { start: "2025-01-01", end: "2025-12-31", val: 15, filed: "2026-02-01", accn: "A1", form: "10-K", fy: 2025, fp: "FY", frame: "CY2025" }
          ] }
        },
        NetIncomeLoss: {
          label: "Net Income",
          units: { USD: [
            { start: "2025-01-01", end: "2025-12-31", val: 12, filed: "2026-02-01", accn: "A1", form: "10-K", fy: 2025, fp: "FY", frame: "CY2025" }
          ] }
        },
        NetCashProvidedByUsedInOperatingActivities: {
          label: "Operating Cash Flow",
          units: { USD: [
            { start: "2025-01-01", end: "2025-12-31", val: 20, filed: "2026-02-01", accn: "A1", form: "10-K", fy: 2025, fp: "FY", frame: "CY2025" }
          ] }
        },
        PaymentsToAcquirePropertyPlantAndEquipment: {
          label: "Capex",
          units: { USD: [
            { start: "2025-01-01", end: "2025-12-31", val: 5, filed: "2026-02-01", accn: "A1", form: "10-K", fy: 2025, fp: "FY", frame: "CY2025" }
          ] }
        },
        CashAndCashEquivalentsAtCarryingValue: {
          label: "Cash",
          units: { USD: [
            { end: "2025-12-31", val: 40, filed: "2026-02-01", accn: "A1", form: "10-K", fy: 2025, fp: "FY", frame: "CY2025Q4I" }
          ] }
        },
        LongTermDebtCurrent: {
          label: "Current Debt",
          units: { USD: [
            { end: "2025-12-31", val: 10, filed: "2026-02-01", accn: "A1", form: "10-K", fy: 2025, fp: "FY", frame: "CY2025Q4I" }
          ] }
        },
        LongTermDebtNoncurrent: {
          label: "Noncurrent Debt",
          units: { USD: [
            { end: "2025-12-31", val: 30, filed: "2026-02-01", accn: "A1", form: "10-K", fy: 2025, fp: "FY", frame: "CY2025Q4I" }
          ] }
        }
      },
      dei: {
        EntityCommonStockSharesOutstanding: {
          label: "Shares Outstanding",
          units: { shares: [
            { end: "2025-12-31", val: 1000, filed: "2026-02-01", accn: "A1", form: "10-K", fy: 2025, fp: "FY", frame: "CY2025Q4I" }
          ] }
        }
      }
    },
    ...overrides
  };
}

test("future-filed facts are excluded by the point-in-time cutoff", () => {
  const facts = extractMetricFacts(payload(), "revenue", "2026-02-15T00:00:00Z");
  assert.equal(facts.some((fact) => fact.accn === "A2"), false);
  assert.equal(facts.some((fact) => fact.accn === "A1"), true);
});

test("same-context amendments supersede mechanically but history remains", () => {
  const metric = normalizeMetric(payload(), "revenue", "2026-04-01T00:00:00Z");
  assert.equal(metric.currentFacts.some((fact) => fact.accn === "A2"), true);
  assert.equal(metric.currentFacts.some((fact) => fact.accn === "A1"), false);
  assert.equal(metric.supersededFacts.some((fact) => fact.accn === "A1" && fact.supersededBy === "A2"), true);
  assert.equal(metric.latest.annual.selected.val, 105);
});

test("conflicting standard concepts never get silently reconciled", () => {
  const sample = payload();
  sample.facts["us-gaap"].Revenues = {
    label: "Revenues",
    units: { USD: [
      { start: "2025-01-01", end: "2025-12-31", val: 99, filed: "2026-02-01", accn: "A1", form: "10-K", fy: 2025, fp: "FY", frame: "CY2025" }
    ] }
  };
  const metric = normalizeMetric(sample, "revenue", "2026-04-01T00:00:00Z");
  assert.equal(metric.latest.annual.status, "ambiguous_concepts");
  assert.equal(metric.latest.annual.selected, null);
});

test("free cash flow, margins and total debt are mechanical and source-addressed", () => {
  const truth = buildFundamentalsTruth(payload(), {
    ticker: "TEST",
    cik: "0001551182",
    asOf: "2026-04-01T00:00:00Z",
    retrievedAt: "2026-04-01T01:00:00Z",
    sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0001551182.json"
  });

  const fcf = truth.derived.free_cash_flow.observations.find((row) => row.end === "2025-12-31");
  const grossMargin = truth.derived.gross_margin.observations.find((row) => row.end === "2025-12-31");
  const operatingMargin = truth.derived.operating_margin.observations.find((row) => row.end === "2025-12-31");
  const totalDebt = truth.derived.total_debt.observations.find((row) => row.end === "2025-12-31");

  assert.equal(fcf.value, 15);
  assert.equal(fcf.inputs.length, 2);
  assert.equal(grossMargin.value, 0.4);
  assert.equal(operatingMargin.value, 0.15);
  assert.equal(totalDebt.value, 40);
});

test("different currencies are preserved and never combined", () => {
  const sample = payload();
  sample.facts["us-gaap"].PaymentsToAcquirePropertyPlantAndEquipment.units = {
    EUR: [
      { start: "2025-01-01", end: "2025-12-31", val: 5, filed: "2026-02-01", accn: "A1", form: "10-K", fy: 2025, fp: "FY", frame: "CY2025" }
    ]
  };
  const truth = buildFundamentalsTruth(sample, { ticker: "TEST", asOf: "2026-04-01T00:00:00Z" });
  assert.equal(truth.derived.free_cash_flow.observations.length, 0);
});

test("truth record contains no Earth score/rank context and validates cleanly", () => {
  const truth = buildFundamentalsTruth(payload(), { ticker: "TEST", asOf: "2026-04-01T00:00:00Z" });
  assert.equal(truth.earthContextIncluded, false);
  assert.equal("earthScore" in truth, false);
  assert.equal("rank" in truth, false);
  assert.deepEqual(validateFundamentalsTruth(truth), []);
});

test("tampering with a source fact is caught by the truth hash", () => {
  const truth = buildFundamentalsTruth(payload(), { ticker: "TEST", asOf: "2026-04-01T00:00:00Z" });
  truth.metrics.revenue.allEligibleFacts[0].val = 999;
  assert.ok(validateFundamentalsTruth(truth).includes("fundamentals truth hash mismatch"));
});


test("8-K facts cannot silently supersede periodic fundamentals", () => {
  const sample = payload();
  sample.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(
    { start: "2025-01-01", end: "2025-12-31", val: 999, filed: "2026-03-15", accn: "E1", form: "8-K", fy: 2025, fp: "FY", frame: "CY2025" }
  );
  const metric = normalizeMetric(sample, "revenue", "2026-04-01T00:00:00Z");
  assert.equal(metric.latest.annual.selected.val, 105);
  assert.equal(metric.allEligibleFacts.some((fact) => fact.accn === "E1"), false);
});

test("FCF treats capex source concepts as cash-outflow magnitude", () => {
  const sample = payload();
  sample.facts["us-gaap"].PaymentsToAcquirePropertyPlantAndEquipment.units.USD[0].val = -5;
  const truth = buildFundamentalsTruth(sample, { ticker: "TEST", asOf: "2026-04-01T00:00:00Z" });
  const fcf = truth.derived.free_cash_flow.observations.find((row) => row.end === "2025-12-31");
  assert.equal(fcf.value, 15);
});
