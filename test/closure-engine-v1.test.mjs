import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildAssistRequests } from "../scripts/lib/assist-bus.mjs";
import { buildClosureFrontier, deriveCapacityPlan } from "../scripts/lib/value-allocator.mjs";
import { applyPacketState, buildRoutingQueues } from "../scripts/lib/workgraph-v2.mjs";

function graphFor(tickers) {
  return {
    version: 2,
    phase: "t0-bootstrap",
    companies: Object.fromEntries(tickers.map((ticker) => [ticker, {
      ticker,
      state: "researching",
      sourceState: "ready_for_chief",
      attempts: 0,
      lastTransitionAt: "2026-09-25T00:00:00.000Z",
      updatedAt: "2026-09-25T00:00:00.000Z",
      workId: "t0:" + ticker,
      evidencePath: null,
      preflight: null,
    }])),
  };
}

function packetFor(ticker, failures = ["missing_numeric_score_record"]) {
  const owner = (failure) => failure === "missing_causal_mapping"
    ? "council-beta"
    : failure.startsWith("unresolved_")
      ? "deep-resolver"
      : "council-alpha";
  return {
    version: 2,
    ticker,
    workId: "t0:" + ticker,
    sourceState: "ready_for_chief",
    evidenceWindow: { latestEvidenceGeneratedAt: "2026-09-25T01:00:00.000Z" },
    evidencePaths: ["data/runtime/workgraph/evidence/" + ticker + "-seed.json"],
    sourceLineage: { uniqueSourceCount: 4 },
    specialistCoverage: { required: ["a"], present: ["a"], missing: [], complete: true },
    gatingIssues: [],
    unknowns: [],
    contradictions: [],
    scoreReadiness: { complete: false },
    preflight: {
      passed: failures.length === 0,
      failures,
      routing: failures.map((failure) => ({ failure, owner: owner(failure) })),
    },
  };
}

test("T0 capacity is 80/15/5 and automatically reverts at 250/250", () => {
  const t0 = deriveCapacityPlan({ total: 250, counts: { canonical: 143 } }, "t0-bootstrap", 250);
  assert.equal(t0.closure, 0.80);
  assert.equal(t0.expansion, 0.15);
  assert.equal(t0.futureLearning, 0.05);
  const complete = deriveCapacityPlan({ total: 250, counts: { canonical: 250 } }, "t0-bootstrap", 250);
  assert.equal(complete.closure, 0.60);
  assert.equal(complete.expansion, 0.25);
  assert.equal(complete.futureLearning, 0.15);
});

test("closure frontier is deterministic, bounded to ten, and removes repeated unchanged inputs from prime capacity", () => {
  const tickers = Array.from({ length: 12 }, (_, i) => "C" + String(i).padStart(2, "0"));
  const graph = graphFor(tickers);
  const packets = tickers.map((ticker) => packetFor(ticker));
  const first = buildClosureFrontier(
    graph,
    packets,
    { requests: [] },
    { total: 250, counts: { canonical: 143 } },
    [{ role: "council-alpha", generatedAt: "2026-09-25T02:00:00.000Z", companiesInspected: ["C00"] }],
    null,
    "2026-09-25T02:05:00.000Z",
    { limit: 10 }
  );
  assert.equal(first.selectedCount, 10);
  assert.equal(first.canonicalWriteAuthority, false);

  const previous = structuredClone(first);
  const priorC00 = previous.candidates.find((row) => row.ticker === "C00");
  priorC00.unchangedAttempts = 1;
  priorC00.latestAttemptAt = "2026-09-25T02:00:00.000Z";

  const second = buildClosureFrontier(
    graph,
    packets,
    { requests: [] },
    { total: 250, counts: { canonical: 143 } },
    [{ role: "council-alpha", generatedAt: "2026-09-25T03:00:00.000Z", companiesInspected: ["C00"] }],
    previous,
    "2026-09-25T03:05:00.000Z",
    { limit: 10 }
  );
  const c00 = second.candidates.find((row) => row.ticker === "C00");
  assert.equal(c00.status, "repeated_unchanged_input");
  assert.equal(c00.primeEligible, false);
  assert.equal(second.selected.some((row) => row.ticker === "C00"), false);
  assert.equal(second.selectedCount, 10);
});

test("frontier-first routing defers stalled input and gives Alpha an all-owned-failures closure objective", () => {
  const tickers = ["AAA", "BBB", "CCC"];
  const graph = graphFor(tickers);
  const packets = [
    packetFor("AAA", ["missing_numeric_score_record", "missing_score_risk_evidence"]),
    packetFor("BBB", ["missing_numeric_score_record"]),
    packetFor("CCC", ["missing_numeric_score_record"]),
  ];
  const queues = buildRoutingQueues(graph, packets, "2026-09-25T03:00:00.000Z", {
    frontierFirst: true,
    frontierTickers: ["BBB", "AAA"],
    stalledTickers: ["AAA"],
    operationalStatusByTicker: {
      AAA: "repeated_unchanged_input",
      BBB: "needs_underwriting",
      CCC: "needs_underwriting",
    },
  });
  assert.equal(queues["council-alpha"].selectionPolicy, "closure-frontier-v1");
  assert.equal(queues["council-alpha"].items[0].ticker, "BBB");
  assert.equal(queues["council-alpha"].items.some((row) => row.ticker === "AAA"), false);
  assert.equal(queues["council-alpha"].deferredItems[0].ticker, "AAA");
  assert.match(queues["council-alpha"].runObjective, /remove every Alpha-owned failure/i);
});

test("legacy ready_for_chief sourceState is lineage only; failed preflight cannot become chief_ready", () => {
  const graph = graphFor(["LEG"]);
  const failed = packetFor("LEG", ["missing_numeric_score_record"]);
  applyPacketState(graph, failed);
  assert.equal(graph.companies.LEG.state, "packet_ready");
  assert.notEqual(graph.companies.LEG.state, "chief_ready");

  const passed = packetFor("LEG", []);
  applyPacketState(graph, passed);
  assert.equal(graph.companies.LEG.state, "chief_ready");
  assert.equal(passed.preflight.passed, true);
});

test("assist bus sleeps unchanged failures and archives obsolete requests without deleting history", () => {
  const graph = graphFor(["AST"]);
  const packet = packetFor("AST", ["missing_primary_source"]);
  const first = buildAssistRequests(graph, [packet], [], "2026-09-25T01:00:00.000Z");
  const req = first.requests.find((row) => row.helperRole === "earth-scout");
  assert.ok(req);

  const run = {
    role: "earth-scout",
    generatedAt: "2026-09-25T02:00:00.000Z",
    assistAttempts: [{
      requestId: req.requestId,
      inputSignature: req.inputSignature,
      outcome: "no_new_evidence",
    }],
  };
  const second = buildAssistRequests(graph, [packet], [run], "2026-09-25T02:01:00.000Z", first);
  const sleeping = second.requests.find((row) => row.requestId === req.requestId);
  assert.equal(sleeping.status, "dormant_until_input_changes");

  const cleanPacket = packetFor("AST", []);
  const third = buildAssistRequests(graph, [cleanPacket], [run], "2026-09-25T03:00:00.000Z", second);
  assert.equal(third.requests.length, 0);
  assert.ok(third.archive.some((row) => row.requestId === req.requestId));
});



test("shadow mode preserves legacy worker controls while producing separate frontier proposals", () => {
  const graph = graphFor(["AAA", "BBB"]);
  const packets = [
    packetFor("AAA", ["missing_numeric_score_record"]),
    packetFor("BBB", ["unresolved_material_contradiction"]),
  ];

  const legacyQueues = buildRoutingQueues(graph, packets, "2026-09-25T03:00:00.000Z");
  assert.equal(legacyQueues["council-alpha"].selectionPolicy, "closure-first-deterministic");
  assert.equal(legacyQueues["council-alpha"].runObjective, null);
  assert.equal(legacyQueues["council-alpha"].items[0].frontier, false);
  assert.equal(legacyQueues["deep-resolver"].items[0].adjudicationPacket, null);

  const proposedQueues = buildRoutingQueues(graph, packets, "2026-09-25T03:00:00.000Z", {
    frontierFirst: true,
    frontierTickers: ["BBB", "AAA"],
    stalledTickers: [],
    operationalStatusByTicker: {
      AAA: "needs_underwriting",
      BBB: "needs_contradiction_resolution",
    },
  });
  assert.equal(proposedQueues["council-alpha"].selectionPolicy, "closure-frontier-v1");
  assert.match(proposedQueues["council-alpha"].runObjective, /Frontier first/i);
  assert.equal(proposedQueues["deep-resolver"].items[0].adjudicationPacket?.contract, "earth2036-resolver-adjudication-v1");
});

test("shadow assist lifecycle does not consume worker behavior until routing is activated", () => {
  const graph = graphFor(["AST"]);
  const packet = packetFor("AST", ["missing_primary_source"]);
  const first = buildAssistRequests(
    graph,
    [packet],
    [],
    "2026-09-25T01:00:00.000Z",
    null,
    { lifecycleEnabled: false }
  );
  const req = first.requests.find((row) => row.helperRole === "earth-scout");
  assert.ok(req);

  const roleRuns = [{
    role: "earth-scout",
    generatedAt: "2026-09-25T02:00:00.000Z",
    assistAttempts: [{
      requestId: req.requestId,
      inputSignature: req.inputSignature,
      outcome: "not_retried_unchanged_input_signature",
    }],
  }];

  const legacy = buildAssistRequests(
    graph,
    [packet],
    roleRuns,
    "2026-09-25T02:01:00.000Z",
    first,
    { lifecycleEnabled: false }
  );
  const proposed = buildAssistRequests(
    graph,
    [packet],
    roleRuns,
    "2026-09-25T02:01:00.000Z",
    first,
    {
      lifecycleEnabled: true,
      frontierTickers: ["AST"],
      operationalStatusByTicker: { AST: "needs_new_source" },
    }
  );

  assert.equal(legacy.policy.frontierFirst, false);
  assert.equal(legacy.policy.lifecycleEnabled, false);
  assert.equal(legacy.requests[0].status, "active");
  assert.equal(proposed.policy.frontierFirst, true);
  assert.equal(proposed.policy.lifecycleEnabled, true);
  assert.equal(proposed.requests[0].status, "dormant_until_input_changes");
});

test("protected runtime baseline never regresses below 143 canonical or away from 250 represented companies", async () => {
  const state = JSON.parse(await readFile(new URL("../data/runtime/workgraph/state.json", import.meta.url), "utf8"));
  const rows = Object.values(state.companies || {});
  const canonical = rows.filter((row) => row.state === "canonical").length;
  assert.equal(rows.length, 250);
  assert.ok(canonical >= 143, "canonical baseline regressed below protected 143");
  assert.ok(rows.filter((row) => row.state === "canonical").every((row) => row.evidencePath));
});
