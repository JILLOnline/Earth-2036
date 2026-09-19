import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERSPECTIVES, applyPacketState, buildRoutingQueues, compilePromotionPacket, computeWorkgraphMetrics, loadStructuredEvidence, migrateLegacyQueue, validateWorkgraph } from "../scripts/lib/workgraph-v2.mjs";
import { auditCalibrationRecord, calibrationBand } from "../scripts/lib/calibration-engine.mjs";
import { buildAssistRequests } from "../scripts/lib/assist-bus.mjs";
import { buildCompanyDigitalTwin } from "../scripts/lib/digital-twin-engine.mjs";
import { attentionPriority, deriveCapacityPlan } from "../scripts/lib/value-allocator.mjs";
import { buildDependencyShadow, detectRoleCycles } from "../scripts/lib/dependency-graph.mjs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const registryEntry = {
  ticker: "AAA",
  company: "AAA Corp",
  cik: "0000000001",
  exchange: "NASDAQ",
  exchangeName: "AAA Corp Common Stock",
  identityStatus: "validated",
  tradabilityStatus: "validated",
  validatedAt: "2026-09-16T00:00:00Z",
};

function completeEvidence() {
  return REQUIRED_PERSPECTIVES.map((perspective, index) => ({
    ticker: "AAA",
    workId: "t0:AAA",
    perspective,
    factors: perspective === "source-integrity" ? [{name:"Data Confidence"}] : [{name:`factor-${index}`}],
    sources: [{sourceId:`src-${index}`, primary:true, publishedAt:"2026-09-15", originFingerprint:`origin-${index}`}],
    causalEdges: perspective === "structural-causal" ? [{from:"need",to:"AAA"}] : [],
    contradictions: [],
    unknowns: [],
    gatingIssues: [],
    risks: perspective === "adversarial-red-team" ? [{risk:"material risk",gating:false}] : [],
    confidence: 80,
    scoreRecord: perspective === "company-underwriting" ? {
      ticker: "AAA",
      company: "AAA Corp",
      methodologyVersion: "1.0.0",
      earthScore: 75,
      risk: 30,
      dataConfidence: 80,
      components: {
        thesisQuality: 80,
        financialOperatingMomentum: 80,
        marketValuationOpportunity: 70,
        catalystScore: 75,
        governancePower: 75,
        alignment2036: 85,
        crossDivisionLeverage: 75,
        bottleneckControl: 75,
        scenarioRobustness: 75,
        substitutionResilience: 70,
        supplyChainResilience: 70,
        pricingPower: 75,
      },
      factorEvidence: {
        thesisQuality: { numericAssessment: 80, basis: "thesis evidence", sourceIds: ["src-1"] },
        financialOperatingMomentum: { numericAssessment: 80, basis: "momentum evidence", sourceIds: ["src-1"] },
        marketValuationOpportunity: { numericAssessment: 70, basis: "valuation evidence", sourceIds: ["src-1"] },
        catalystScore: { numericAssessment: 75, basis: "catalyst evidence", sourceIds: ["src-1"] },
        governancePower: { numericAssessment: 75, basis: "governance evidence", sourceIds: ["src-1"] },
        alignment2036: { numericAssessment: 85, basis: "alignment evidence", sourceIds: ["src-1"] },
        crossDivisionLeverage: { numericAssessment: 75, basis: "leverage evidence", sourceIds: ["src-1"] },
        bottleneckControl: { numericAssessment: 75, basis: "bottleneck evidence", sourceIds: ["src-1"] },
        scenarioRobustness: { numericAssessment: 75, basis: "scenario evidence", sourceIds: ["src-1"] },
        substitutionResilience: { numericAssessment: 70, basis: "substitution evidence", sourceIds: ["src-1"] },
        supplyChainResilience: { numericAssessment: 70, basis: "supply evidence", sourceIds: ["src-1"] },
        pricingPower: { numericAssessment: 75, basis: "pricing evidence", sourceIds: ["src-1"] },
      },
      riskEvidence: { numericAssessment: 30, basis: "risk evidence", sourceIds: ["src-1"] },
      dataConfidenceEvidence: { numericAssessment: 80, basis: "confidence evidence", sourceIds: ["src-1"] },
      primarySourceUrls: ["https://www.sec.gov/example"],
      causalMapped: true,
    } : null,
    path: `evidence/${perspective}.json`,
    generatedAt: "2026-09-16T00:00:00Z",
  }));
}

test("legacy queue hydrates aggregate queued remainder from canonical registry", () => {
  const legacy = {
    version: 1,
    cycleKey: "20260915T2000Z",
    policy: "parallel-batch-bootstrap-1.0",
    companies: {
      AAA: { status: "ready_for_chief", attempts: 2, lastUpdatedAt: "2026-09-15T20:00:00Z" },
      CCC: { status: "promoted", attempts: 1, evidencePath: "data/baseline-evidence/CCC.json", lastUpdatedAt: "2026-09-15T20:00:00Z" }
    }
  };
  const registry = { expected: 3, updatedAt: "2026-09-16T00:00:00Z", candidates: [{ticker:"AAA"},{ticker:"BBB"},{ticker:"CCC"}] };
  const graph = migrateLegacyQueue(legacy, registry, new Date("2026-09-16T00:00:00Z"));
  assert.equal(graph.companies.AAA.state, "evidence_complete");
  assert.equal(graph.companies.BBB.state, "observed");
  assert.equal(graph.companies.BBB.lineage.hydratedFrom, "data/runtime/entity-registry.json");
  assert.equal(graph.companies.CCC.state, "canonical");
  assert.deepEqual(validateWorkgraph(graph, 3), []);
});

test("packet v2 requires complete six-perspective structured evidence", () => {
  const graph = { version: 2, companies: { AAA: { ticker: "AAA", state: "evidence_complete", workId: "t0:AAA", attempts: 1, lastTransitionAt: "2026-09-15T20:00:00Z" } } };
  const packet = compilePromotionPacket("AAA", completeEvidence(), graph.companies.AAA, { registryEntry, methodologyVersion:"1.0.0" });
  assert.equal(packet.version, 2);
  assert.equal(packet.specialistCoverage.complete, true);
  assert.equal(packet.identityTradability.identityStatus, "validated");
  assert.equal(packet.primarySourcePresence.present, true);
  assert.equal(packet.dataConfidenceEvidence.available, true);
  assert.equal(packet.riskEvidence.present, true);
  assert.equal(packet.causalMapping.present, true);
  assert.equal(packet.preflight.passed, true);
  applyPacketState(graph, packet);
  assert.equal(graph.companies.AAA.state, "chief_ready");
});

test("packet fails closed when numeric score evidence is not source-addressed for Beast", () => {
  const rows = completeEvidence();
  const underwriting = rows.find((row) => row.perspective === "company-underwriting");
  underwriting.scoreRecord = {
    ...underwriting.scoreRecord,
    factorEvidence: { thesisQuality: 80 },
    riskEvidence: { numericAssessment: 30, basis: "risk without sources" },
    dataConfidenceEvidence: { numericAssessment: 80, basis: "confidence without sources" },
  };
  underwriting.factorEvidence = Object.fromEntries(
    Object.entries(underwriting.scoreRecord.components).map(([key, value]) => [key, { numericAssessment: value, basis: key }])
  );
  underwriting.riskEvidence = [{ numericAssessment: 30, basis: "risk without sources" }];
  underwriting.dataConfidenceEvidence = { numericAssessment: 80, basis: "confidence without sources" };
  const packet = compilePromotionPacket("AAA", rows, {ticker:"AAA",state:"researching",workId:"t0:AAA"}, { registryEntry, methodologyVersion:"1.0.0" });
  assert.equal(packet.preflight.passed, false);
  assert.equal(packet.scoreReadiness.complete, false);
  assert.ok(packet.preflight.failures.includes("missing_factor_evidence"));
  assert.ok(packet.preflight.failures.includes("missing_score_risk_evidence"));
  assert.equal(packet.preflight.routing.find((r) => r.failure === "missing_score_risk_evidence")?.owner, "council-alpha");
  assert.ok(packet.preflight.failures.includes("missing_data_confidence_evidence"));
});

test("legacy evidencePath cannot bypass v2 structured packet requirements", () => {
  const row = { ticker:"AAA", state:"evidence_complete", workId:"t0:AAA", evidencePath:"data/baseline-evidence/AAA.json" };
  const packet = compilePromotionPacket("AAA", [], row, { registryEntry, methodologyVersion:"1.0.0" });
  assert.equal(packet.preflight.passed, false);
  assert.ok(packet.preflight.failures.includes("missing_structured_evidence"));
  assert.ok(packet.preflight.failures.includes("missing_specialist_perspective:source-integrity"));
});

test("packet v2 collapses duplicate source origins deterministically", () => {
  const rows = completeEvidence();
  rows[1].sources = [{sourceId:"duplicate-doc",primary:true,publishedAt:"2026-09-15",originFingerprint:"origin-0"}];
  const packet = compilePromotionPacket("AAA", rows, {ticker:"AAA",state:"packet_ready",workId:"t0:AAA"}, { registryEntry, methodologyVersion:"1.0.0" });
  assert.equal(packet.sourceLineage.rawSourceCount, 6);
  assert.equal(packet.sourceLineage.uniqueSourceCount, 5);
  assert.equal(packet.sourceLineage.duplicatesCollapsed, 1);
});

test("missing specialist perspective fails closed and routes to its owner", () => {
  const rows = completeEvidence().filter((row) => row.perspective !== "company-underwriting");
  const packet = compilePromotionPacket("AAA", rows, {ticker:"AAA",state:"packet_ready",workId:"t0:AAA"}, { registryEntry, methodologyVersion:"1.0.0" });
  assert.equal(packet.preflight.passed, false);
  assert.ok(packet.preflight.failures.includes("missing_specialist_perspective:company-underwriting"));
  assert.deepEqual(packet.preflight.routing.find((r) => r.failure === "missing_specialist_perspective:company-underwriting"), { failure:"missing_specialist_perspective:company-underwriting", owner:"council-alpha" });
});

test("recompile does not reset transition age and failed chief_ready cannot remain promotable", () => {
  const oldTransition = "2026-09-15T20:00:00Z";
  const graph = { version:2, companies:{ AAA:{ticker:"AAA",state:"chief_ready",workId:"t0:AAA",lastTransitionAt:oldTransition,updatedAt:oldTransition} } };
  const passed = compilePromotionPacket("AAA", completeEvidence(), graph.companies.AAA, { registryEntry, methodologyVersion:"1.0.0" });
  applyPacketState(graph, passed);
  assert.equal(graph.companies.AAA.lastTransitionAt, oldTransition);
  const failed = compilePromotionPacket("AAA", [], graph.companies.AAA, { registryEntry, methodologyVersion:"1.0.0" });
  applyPacketState(graph, failed);
  assert.notEqual(graph.companies.AAA.state, "chief_ready");
  assert.equal(graph.companies.AAA.state, "researching");
  assert.notEqual(graph.companies.AAA.lastTransitionAt, oldTransition);
});

test("metrics expose queue distribution, age and preflight failure categories", () => {
  const graph = { version:2, companies:{ AAA:{ticker:"AAA",state:"chief_ready",attempts:2,lastTransitionAt:"2026-09-15T20:00:00Z",preflight:{failures:[]}}, BBB:{ticker:"BBB",state:"packet_ready",attempts:3,lastTransitionAt:"2026-09-15T22:00:00Z",preflight:{failures:["missing_causal_mapping"]}} } };
  const metrics = computeWorkgraphMetrics(graph, new Date("2026-09-16T00:00:00Z"));
  assert.equal(metrics.counts.chief_ready,1);
  assert.equal(metrics.counts.packet_ready,1);
  assert.equal(metrics.attempts.over3,1);
  assert.equal(metrics.oldestAgeHours.chief_ready,4);
  assert.equal(metrics.preflightFailures.missing_causal_mapping,1);
});


test("fresh role-run receipt prevents false stale-worker health alert without fabricated evidence", () => {
  const graph = {
    version: 2,
    companies: {
      AAA: {
        ticker: "AAA",
        state: "researching",
        attempts: 1,
        lastTransitionAt: "2026-09-18T05:00:00Z",
        preflight: {
          failures: ["unresolved_gating_issue"],
          routing: [{ failure: "unresolved_gating_issue", owner: "deep-resolver" }],
        },
      },
    },
  };
  const metrics = computeWorkgraphMetrics(
    graph,
    new Date("2026-09-18T09:00:00Z"),
    [],
    [{ role: "deep-resolver", generatedAt: "2026-09-18T08:35:00Z", result: "no_eligible_exception" }],
  );
  assert.equal(metrics.roleActivity["deep-resolver"].lastRunAt, "2026-09-18T08:35:00.000Z");
  assert.equal(metrics.roleActivity["deep-resolver"].runs1h, 1);
  assert.equal(metrics.healthAlerts.some((x) => x.startsWith("owner_stale_with_backlog:deep-resolver")), false);
});

test("loader preserves scoreRecord and normalizes disk evidence for packet compilation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "earth2036-workgraph-"));
  try {
    const dir = path.join(root, "data", "runtime", "workgraph", "evidence");
    await mkdir(dir, { recursive: true });
    const rows = completeEvidence();
    const underwriting = rows.find((row) => row.perspective === "company-underwriting");
    const flat = {
      ...underwriting,
      factors: undefined,
      affectedMethodologyFactors: ["thesisQuality", "financialOperatingMomentum"],
      scoreRecord: {
        ...underwriting.scoreRecord,
        components: undefined,
        thesisQuality: 80,
        financialOperatingMomentum: 80,
        marketValuationOpportunity: 70,
        catalystScore: 75,
        governancePower: 75,
        alignment2036: 85,
        crossDivisionLeverage: 75,
        bottleneckControl: 75,
        scenarioRobustness: 75,
        substitutionResilience: 70,
        supplyChainResilience: 70,
        pricingPower: 75,
      },
    };
    await writeFile(path.join(dir, "AAA.json"), JSON.stringify([rows[0], flat, ...rows.slice(2)]), "utf8");
    const loaded = await loadStructuredEvidence(root);
    const packet = compilePromotionPacket("AAA", loaded, { ticker:"AAA", state:"researching", workId:"t0:AAA" }, { registryEntry, methodologyVersion:"1.0.0" });
    assert.equal(packet.scoreReadiness.complete, true);
    assert.equal(packet.scoreRecord.components.thesisQuality, 80);
    assert.equal(packet.preflight.passed, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("append-only supersession removes stale gating defects without deleting history", () => {
  const base = completeEvidence();
  const underwriting = base.find((row) => row.perspective === "company-underwriting");
  const stalePath = "data/runtime/workgraph/evidence/AAA-old.json";
  const stale = {
    ...underwriting,
    path: stalePath,
    generatedAt: "2026-09-16T00:00:00Z",
    gatingIssues: [{ defect: "old defect" }],
    unknowns: [{ unknown: "old unknown", gating: true }],
    scoreRecord: null,
  };
  const current = {
    ...underwriting,
    path: "data/runtime/workgraph/evidence/AAA-new.json",
    generatedAt: "2026-09-16T01:00:00Z",
    lineage: { supersedes: stalePath },
    gatingIssues: [],
    unknowns: [{ unknown: "future uncertainty", gating: false }],
  };
  const evidence = [
    ...base.filter((row) => row.perspective !== "company-underwriting"),
    stale,
    current,
  ];
  const packet = compilePromotionPacket("AAA", evidence, { ticker:"AAA", state:"researching", workId:"t0:AAA" }, { registryEntry, methodologyVersion:"1.0.0" });
  assert.equal(packet.preflight.failures.includes("unresolved_gating_issue"), false);
  assert.equal(packet.preflight.failures.includes("unresolved_gating_unknown"), false);
  assert.ok(packet.evidenceResolution.supersededPaths.includes(stalePath));
});

test("Deep Resolver can explicitly close stale gating categories while history remains visible", () => {
  const evidence = completeEvidence();
  evidence[0] = {
    ...evidence[0],
    gatingIssues: [{ defect: "legacy issue" }],
    unknowns: [{ unknown: "legacy unknown", gating: true }],
  };
  evidence.push({
    version: 2,
    contract: "workgraph-v2-deep-resolver-evidence",
    ticker: "AAA",
    workId: "t0:AAA",
    role: "deep-resolver",
    perspective: null,
    generatedAt: "2026-09-16T02:00:00Z",
    claims: [],
    sources: [],
    factors: [],
    risks: [],
    causalEdges: [],
    contradictions: [],
    unknowns: [],
    gatingIssues: [],
    items: [
      { itemId: "t0:AAA:unresolved_gating_issue", status: "resolved" },
      { itemId: "t0:AAA:unresolved_gating_unknown", status: "resolved" },
    ],
    confidence: 95,
    path: "data/runtime/workgraph/evidence/AAA-resolver.json",
  });
  const packet = compilePromotionPacket("AAA", evidence, { ticker:"AAA", state:"packet_ready", workId:"t0:AAA" }, { registryEntry, methodologyVersion:"1.0.0" });
  assert.equal(packet.preflight.failures.includes("unresolved_gating_issue"), false);
  assert.equal(packet.preflight.failures.includes("unresolved_gating_unknown"), false);
  assert.deepEqual(packet.evidenceResolution.resolvedGateKinds, ["gating_issue","gating_unknown"]);
});


test("fresh evidence outranks a stale role-run marker for liveness", () => {
  const graph = {
    version: 2,
    companies: {
      AAA: {
        ticker: "AAA",
        state: "researching",
        attempts: 1,
        lastTransitionAt: "2026-09-18T05:00:00Z",
        preflight: {
          failures: ["missing_numeric_score_record"],
          routing: [{ failure: "missing_numeric_score_record", owner: "council-alpha" }],
        },
      },
    },
  };
  const metrics = computeWorkgraphMetrics(
    graph,
    new Date("2026-09-18T10:00:00Z"),
    [{ role: "council-alpha", generatedAt: "2026-09-18T09:40:00Z" }],
    [{ role: "council-alpha", generatedAt: "2026-09-18T06:00:00Z" }],
  );
  assert.equal(metrics.healthAlerts.some((x) => x.startsWith("owner_stale_with_backlog:council-alpha")), false);
  assert.equal(metrics.telemetry.livenessPolicy, "freshest-valid-evidence-or-role-run");
});

test("future-dated telemetry is rejected instead of appearing freshly alive", () => {
  const graph = {
    version: 2,
    companies: {
      AAA: {
        ticker: "AAA",
        state: "researching",
        attempts: 1,
        lastTransitionAt: "2026-09-18T05:00:00Z",
        preflight: {
          failures: ["missing_causal_mapping"],
          routing: [{ failure: "missing_causal_mapping", owner: "council-beta" }],
        },
      },
    },
  };
  const metrics = computeWorkgraphMetrics(
    graph,
    new Date("2026-09-18T10:00:00Z"),
    [{ role: "council-beta", generatedAt: "2026-09-18T13:00:00Z" }],
    [{ role: "council-beta", generatedAt: "2026-09-18T13:00:00Z" }],
  );
  assert.equal(metrics.telemetry.futureEvidenceRejected, 1);
  assert.equal(metrics.telemetry.futureRoleRunsRejected, 1);
  assert.equal(metrics.healthAlerts.some((x) => x.startsWith("owner_stale_with_backlog:council-beta")), true);
});


test("loader expands composite perspectives and normalizes Beta evidence conventions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "earth2036-workgraph-composite-"));
  try {
    const dir = path.join(root, "data", "runtime", "workgraph", "evidence");
    await mkdir(dir, { recursive: true });
    const composite = {
      version: 2,
      role: "council-beta",
      generatedAt: "2026-09-19T00:26:55Z",
      sourceCycleKey: "20260918T2300Z",
      workId: "t0:AAA",
      entity: { ticker: "AAA", name: "AAA Corp" },
      perspectives: [
        {
          perspective: "structural-causal",
          claims: [{
            claim: "structural proof",
            affectedFactors: ["bottleneckControl"],
            causalEdges: ["need -> AAA"],
          }],
          risks: [],
          contradictions: [],
          unknowns: [],
          confidence: 0.91,
        },
        {
          perspective: "adversarial-red-team",
          claims: [{ claim: "red-team proof", affectedFactors: ["scenarioRobustness"] }],
          risks: ["material risk"],
          contradictions: [{
            issue: "old tension",
            disposition: "resolved-by-newer-evidence",
            material: false,
          }],
          unknowns: [],
          confidence: 0.89,
        },
      ],
      sources: [{
        id: "beta-primary",
        url: "https://issuer.example/filing",
        sourceType: "company-primary",
        originFingerprint: "issuer:AAA:filing",
      }],
    };
    await writeFile(path.join(dir, "AAA-beta.json"), JSON.stringify(composite), "utf8");
    const loaded = await loadStructuredEvidence(root);
    assert.equal(loaded.length, 2);
    assert.deepEqual(loaded.map((row) => row.perspective).sort(), ["adversarial-red-team", "structural-causal"]);
    assert.equal(loaded.find((row) => row.perspective === "structural-causal").confidence, 91);
    assert.equal(loaded.find((row) => row.perspective === "adversarial-red-team").confidence, 89);
    assert.equal(loaded[0].sources[0].primary, true);
    assert.ok(loaded.find((row) => row.perspective === "structural-causal").causalEdges.includes("need -> AAA"));

    const base = completeEvidence().filter((row) => !["structural-causal", "adversarial-red-team"].includes(row.perspective));
    const packet = compilePromotionPacket(
      "AAA",
      [...base, ...loaded],
      { ticker:"AAA", state:"researching", workId:"t0:AAA" },
      { registryEntry, methodologyVersion:"1.0.0" },
    );
    assert.equal(packet.specialistCoverage.missing.includes("structural-causal"), false);
    assert.equal(packet.specialistCoverage.missing.includes("adversarial-red-team"), false);
    assert.equal(packet.causalMapping.present, true);
    assert.equal(packet.preflight.failures.includes("unresolved_material_contradiction"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("loader normalizes top-level Deep Resolver gate resolution into compiler items", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "earth2036-workgraph-resolver-root-"));
  try {
    const dir = path.join(root, "data", "runtime", "workgraph", "evidence");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "AAA-resolver-root.json"), JSON.stringify({
      version: 1,
      role: "deep-resolver",
      generatedAt: "2026-09-19T04:35:56Z",
      sourceCycleKey: "20260919T0433Z",
      ticker: "AAA",
      workId: "t0:AAA",
      gateKind: "unresolved_material_contradiction",
      result: "resolved",
      resolution: {
        confidence: 97,
        recommendedNextState: "researching",
        evidence: [{
          statement: "primary resolver fact",
          source: "https://issuer.example/filing",
          primary: true,
          originFingerprint: "issuer:AAA:resolver",
        }],
      },
    }), "utf8");

    const loaded = await loadStructuredEvidence(root);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].items[0].status, "resolved");
    assert.ok(loaded[0].items[0].itemId.includes("unresolved_material_contradiction"));
    assert.equal(loaded[0].confidence, 97);
    assert.equal(loaded[0].sources[0].primary, true);

    const base = completeEvidence();
    const beta = base.find((row) => row.perspective === "adversarial-red-team");
    beta.contradictions = [{ issue: "material tension", material: true }];
    const packet = compilePromotionPacket(
      "AAA",
      [...base, ...loaded],
      { ticker:"AAA", state:"researching", workId:"t0:AAA" },
      { registryEntry, methodologyVersion:"1.0.0" },
    );
    assert.equal(packet.preflight.failures.includes("unresolved_material_contradiction"), false);
    assert.ok(packet.evidenceResolution.resolvedGateKinds.includes("material_contradiction"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("Deep Resolver defers dependent score-gate symptoms while Alpha owns the root cause", () => {
  const graph = {
    companies: {
      AAA: { ticker: "AAA", state: "packet_ready", workId: "t0:AAA" },
    },
  };
  const packets = [{
    ticker: "AAA",
    workId: "t0:AAA",
    preflight: {
      failures: ["missing_numeric_score_record", "unresolved_gating_issue", "unresolved_gating_unknown"],
      routing: [
        { failure: "missing_numeric_score_record", owner: "council-alpha" },
        { failure: "unresolved_gating_issue", owner: "deep-resolver" },
        { failure: "unresolved_gating_unknown", owner: "deep-resolver" },
      ],
    },
    evidencePaths: ["evidence/AAA-alpha.json"],
    specialistCoverage: { complete: true },
    evidenceResolution: {},
    gatingIssues: [{ gate: "missing_numeric_score_record" }],
    unknowns: [{ unknown: "valuation input missing", gating: true }],
    contradictions: [],
  }];
  const queues = buildRoutingQueues(graph, packets, "2026-09-19T12:00:00Z");
  assert.equal(queues["council-alpha"].total, 1);
  assert.equal(queues["deep-resolver"].total, 0);
});

test("Deep Resolver still receives material contradictions even when another owner has work", () => {
  const graph = {
    companies: {
      AAA: { ticker: "AAA", state: "packet_ready", workId: "t0:AAA" },
    },
  };
  const packets = [{
    ticker: "AAA",
    workId: "t0:AAA",
    preflight: {
      failures: ["missing_numeric_score_record", "unresolved_material_contradiction"],
      routing: [
        { failure: "missing_numeric_score_record", owner: "council-alpha" },
        { failure: "unresolved_material_contradiction", owner: "deep-resolver" },
      ],
    },
    evidencePaths: ["evidence/AAA-alpha.json"],
    specialistCoverage: { complete: true },
    evidenceResolution: {},
    gatingIssues: [],
    unknowns: [],
    contradictions: [{ contradiction: "material tension", material: true }],
  }];
  const queues = buildRoutingQueues(graph, packets, "2026-09-19T12:00:00Z");
  assert.equal(queues["deep-resolver"].total, 1);
});

test("metrics flag stalled frontier and fresh zero-closure work as unhealthy", () => {
  const graph = {
    version: 2,
    companies: {
      AAA: {
        ticker: "AAA",
        state: "packet_ready",
        attempts: 1,
        lastTransitionAt: "2026-09-19T08:00:00Z",
        preflight: {
          failures: ["missing_numeric_score_record"],
          routing: [{ failure: "missing_numeric_score_record", owner: "council-alpha" }],
        },
      },
      BBB: {
        ticker: "BBB",
        state: "canonical",
        attempts: 1,
        evidencePath: "data/baseline-evidence/BBB.json",
        lastTransitionAt: "2026-09-19T04:00:00Z",
        preflight: { failures: [], routing: [] },
      },
    },
  };
  const metrics = computeWorkgraphMetrics(
    graph,
    new Date("2026-09-19T12:00:00Z"),
    [],
    [{
      role: "council-alpha",
      generatedAt: "2026-09-19T11:15:00Z",
      scoreRecordsCompleted: 0,
      alphaPairsCompleted: 0,
    }],
  );
  assert.equal(metrics.healthy, false);
  assert.ok(metrics.healthAlerts.some((x) => x.startsWith("t0_frontier_stalled_over_2h_without_chief_ready")));
  assert.ok(metrics.healthAlerts.some((x) => x.startsWith("owner_recent_run_zero_closure:council-alpha")));
});


test("calibration contract accepts complete source-addressed canonical records and exposes bounded bands", () => {
  const record = completeEvidence().find((row) => row.perspective === "company-underwriting").scoreRecord;
  const audit = auditCalibrationRecord(record);
  assert.equal(audit.passed, true);
  assert.equal(audit.components.length, 12);
  assert.equal(calibrationBand(20).label, "critical weakness");
  assert.equal(calibrationBand(20.5).label, "weak");
  assert.equal(calibrationBand(21).label, "weak");
  assert.equal(calibrationBand(40.5).label, "mixed / unproven");
  assert.equal(calibrationBand(60).label, "mixed / unproven");
  assert.equal(calibrationBand(60.5).label, "strong");
  assert.equal(calibrationBand(80.5).label, "exceptional");
  assert.equal(calibrationBand(81).label, "exceptional");
  assert.equal(calibrationBand(101), null);
});

test("assist bus creates bounded Scout help for stalled Alpha source gaps without transferring ownership", () => {
  const graph = {
    companies: {
      AAA: { ticker: "AAA", state: "packet_ready", workId: "t0:AAA", attempts: 2 },
    },
  };
  const packets = [{
    ticker: "AAA",
    workId: "t0:AAA",
    sourceState: "packet_ready",
    evidencePaths: ["evidence/a.json"],
    gatingIssues: [],
    unknowns: [],
    preflight: {
      failures: ["missing_factor_evidence", "missing_numeric_score_record"],
    },
  }];
  const bus = buildAssistRequests(graph, packets, [], "2026-09-19T14:00:00Z");
  assert.equal(bus.active, 1);
  assert.equal(bus.requests[0].rootOwner, "council-alpha");
  assert.equal(bus.requests[0].helperRole, "earth-scout");
  assert.equal(bus.requests[0].capability, "source-acquisition");
  assert.equal(bus.policy.rootOwnerRetainsAuthority, true);
});

test("assist bus sleeps an unchanged failed request and reactivates when packet inputs change", () => {
  const graph = {
    companies: {
      AAA: { ticker: "AAA", state: "packet_ready", workId: "t0:AAA", attempts: 3 },
    },
  };
  const packet = {
    ticker: "AAA",
    workId: "t0:AAA",
    sourceState: "packet_ready",
    evidencePaths: ["evidence/a.json"],
    gatingIssues: [],
    unknowns: [],
    preflight: { failures: ["missing_numeric_score_record"] },
  };
  const first = buildAssistRequests(graph, [packet], [], "2026-09-19T14:00:00Z");
  const request = first.requests[0];
  const roleRuns = [{
    role: "earth-scout",
    generatedAt: "2026-09-19T14:05:00Z",
    assistAttempts: [{
      requestId: request.requestId,
      inputSignature: request.inputSignature,
      outcome: "no_new_evidence",
    }],
  }];
  const dormant = buildAssistRequests(graph, [packet], roleRuns, "2026-09-19T14:10:00Z");
  assert.equal(dormant.active, 0);
  assert.equal(dormant.dormant, 1);

  const changedPacket = { ...packet, evidencePaths: ["evidence/a.json", "evidence/new.json"] };
  const reactivated = buildAssistRequests(graph, [changedPacket], roleRuns, "2026-09-19T14:20:00Z");
  assert.equal(reactivated.active, 1);
  assert.notEqual(reactivated.requests[0].inputSignature, request.inputSignature);
});


test("Digital Twin shadow separates representation from ranking and frames failures as improvement questions", () => {
  const graphRow = { ticker: "AAA", state: "packet_ready", workId: "t0:AAA", attempts: 2 };
  const packet = compilePromotionPacket("AAA", completeEvidence(), graphRow, { registryEntry, methodologyVersion:"1.0.0" });
  packet.preflight.passed = false;
  packet.preflight.failures = ["missing_numeric_score_record"];
  const twin = buildCompanyDigitalTwin(packet, graphRow);
  assert.equal(twin.canonicalWriteAuthority, false);
  assert.equal(twin.doctrine.representationIsNotRanking, true);
  assert.ok(twin.improvementWindows[0].question.includes("source-addressed"));
  assert.equal(twin.ticker, "AAA");
});

test("Value allocator treats stalled frontier as higher closure capacity without eliminating exploration", () => {
  const plan = deriveCapacityPlan({
    counts: { packet_ready: 4, chief_ready: 0 },
    canonicalProgressAgeHours: 8,
  });
  assert.equal(plan.mode, "frontier-stall");
  assert.equal(plan.closure, 0.70);
  assert.ok(plan.expansion > 0);
  assert.ok(plan.futureLearning > 0);
});

test("Attention priority is operational and favors near-closure work without becoming an investment score", () => {
  const packet = {
    ticker: "AAA",
    sourceState: "packet_ready",
    preflight: { failures: ["missing_numeric_score_record"] },
    sourceLineage: { uniqueSourceCount: 8 },
    specialistCoverage: { required: [1,2,3,4,5,6], present: [1,2,3,4,5,6] },
  };
  const priority = attentionPriority({ ticker:"AAA", state:"packet_ready", attempts:2 }, packet, { requests: [] });
  assert.ok(priority.priority > 70);
  assert.ok(priority.principle.includes("never a company-quality"));
});


test("dependency graph detects circular role assistance and reports dormant deadlocks", () => {
  const cycleRequests = [
    { status:"active", rootOwner:"council-alpha", helperRole:"earth-scout" },
    { status:"active", rootOwner:"earth-scout", helperRole:"council-alpha" },
  ];
  const cycles = detectRoleCycles(cycleRequests);
  assert.ok(cycles.length >= 1);

  const shadow = buildDependencyShadow({
    requests: [{
      requestId:"assist:AAA",
      ticker:"AAA",
      rootOwner:"council-alpha",
      helperRole:"earth-scout",
      capability:"source-acquisition",
      inputSignature:"abc",
      status:"dormant_until_input_changes",
    }],
  }, "2026-09-19T14:30:00Z");
  assert.equal(shadow.deadlocks.length, 1);
  assert.equal(shadow.canonicalWriteAuthority, false);
});


test("assist bus caps helper capacity instead of flooding one minion", () => {
  const companies = {};
  const packets = [];
  for (let i=0;i<12;i++) {
    const ticker = `X${i}`;
    companies[ticker] = { ticker, state:"packet_ready", workId:`t0:${ticker}`, attempts:2 };
    packets.push({
      ticker,
      workId:`t0:${ticker}`,
      sourceState:"packet_ready",
      evidencePaths:[`evidence/${ticker}.json`],
      specialistCoverage:{present:["a","b","c","d","e","f"]},
      gatingIssues:[],
      unknowns:[],
      preflight:{failures:["missing_numeric_score_record"]},
    });
  }
  const bus = buildAssistRequests({companies}, packets, [], "2026-09-19T14:00:00Z");
  assert.equal(bus.active, 8);
  assert.equal(bus.queued, 4);
  assert.equal(bus.byHelper["earth-scout"], 8);
});
