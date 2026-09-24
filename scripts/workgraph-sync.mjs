import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyPacketState, buildRoutingQueues, compilePromotionPacket, computeWorkgraphMetrics, loadRoleRuns, loadStructuredEvidence, migrateLegacyQueue, validateWorkgraph, writeWorkgraphArtifacts } from "./lib/workgraph-v2.mjs";
import { auditCalibrationRecord, buildPacketCalibrationGuidance, CALIBRATION_REGISTRY } from "./lib/calibration-engine.mjs";
import { buildAssistRequests } from "./lib/assist-bus.mjs";
import { buildDigitalTwinShadow } from "./lib/digital-twin-engine.mjs";
import { buildValueAllocationShadow } from "./lib/value-allocator.mjs";
import { buildDependencyShadow } from "./lib/dependency-graph.mjs";
import { buildTrajectorySnapshot, validateTrajectorySnapshot } from "./lib/trajectory-engine.mjs";
import { loadVerifiedBridgeIndex } from "./lib/fundamentals-bridge-index.mjs";
import { MIN_PUBLISHABLE_DATA_CONFIDENCE } from "./lib/runtime-gates.mjs";

const ROOT = process.cwd();
const LEGACY_PATH = path.join(ROOT, "data", "runtime", "supervisors", "t0-bootstrap-queue.json");
const REGISTRY_PATH = path.join(ROOT, "data", "runtime", "entity-registry.json");
const SCORE_STATE_PATH = path.join(ROOT, "data", "runtime", "score-state.json");
const STATE_PATH = path.join(ROOT, "data", "runtime", "workgraph", "state.json");
const LEARNING_PATH = path.join(ROOT, "data", "runtime", "workgraph", "learning-state.json");

async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }
async function readJsonOr(file, fallback) {
  try { return await readJson(file); } catch { return fallback; }
}

function closureCountForRun(role, run) {
  if (!run || typeof run !== "object") return null;
  if (role === "earth-scout" && Number.isFinite(run.evidencePairsCompleted)) return run.evidencePairsCompleted;
  if (role === "council-alpha" && Number.isFinite(run.scoreRecordsCompleted)) return run.scoreRecordsCompleted;
  if (role === "council-beta" && Number.isFinite(run.betaPairsCompleted)) return run.betaPairsCompleted;
  if (role === "deep-resolver" && Array.isArray(run.resolved)) return run.resolved.length;
  return null;
}

function latestRunByRole(roleRuns) {
  const latest = {};
  for (const run of roleRuns || []) {
    const role = run?.role;
    const date = new Date(run?.generatedAt || 0);
    if (!role || Number.isNaN(date.getTime())) continue;
    if (!latest[role] || date > latest[role].date) latest[role] = { run, date };
  }
  return latest;
}

function deriveLearningState(existing, metrics, packets, routingQueues, roleRuns, now) {
  const state = existing && typeof existing === "object" ? existing : {
    version: 1,
    contract: "earth2036-operational-learning-v1",
    agendaGuardrails: [],
    activeLessons: [],
  };
  const latest = latestRunByRole(roleRuns);
  const zeroClosure = [];
  for (const [owner, backlog] of Object.entries(metrics.effectiveOwnerBacklog || metrics.ownerBacklog || {})) {
    if (!backlog) continue;
    const role = owner;
    const item = latest[role];
    if (!item) continue;
    const ageHours = Math.max(0, (now.getTime() - item.date.getTime()) / 3_600_000);
    const closures = closureCountForRun(role, item.run);
    if (ageHours <= 2 && closures === 0) {
      zeroClosure.push({
        role,
        backlog,
        runAt: item.date.toISOString(),
        result: item.run?.result || null,
        repeatedBlocker: item.run?.repeatedBlocker || null,
        failedStrategy: item.run?.failedStrategy || null,
        changedStrategy: item.run?.changedStrategy || null,
      });
    }
  }

  const dependentResolverSymptoms = [];
  for (const packet of packets || []) {
    const routes = packet?.preflight?.routing || [];
    const resolverFailures = routes.filter((r) => r?.owner === "deep-resolver").map((r) => r.failure);
    const otherOwners = [...new Set(routes.map((r) => r?.owner).filter((o) => o && o !== "deep-resolver"))];
    const hasMaterialContradiction = resolverFailures.includes("unresolved_material_contradiction");
    const onlyDependent = resolverFailures.length > 0 &&
      !hasMaterialContradiction &&
      resolverFailures.every((f) => ["unresolved_gating_issue", "unresolved_gating_unknown"].includes(f)) &&
      otherOwners.length > 0;
    if (onlyDependent) {
      dependentResolverSymptoms.push({
        ticker: packet.ticker,
        resolverFailures,
        rootOwners: otherOwners,
        allFailures: packet?.preflight?.failures || [],
      });
    }
  }

  const topFailures = Object.entries(metrics.preflightFailures || {})
    .sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([failure, count]) => ({ failure, count }));

  return {
    ...state,
    updatedAt: now.toISOString(),
    currentSignals: {
      frontier: {
        packetReady: metrics.counts?.packet_ready || 0,
        chiefReady: metrics.counts?.chief_ready || 0,
        canonical: metrics.counts?.canonical || 0,
        canonicalProgressAgeHours: metrics.canonicalProgressAgeHours,
        stalled: (metrics.counts?.packet_ready || 0) > 0 &&
          (metrics.counts?.chief_ready || 0) === 0 &&
          Number.isFinite(metrics.canonicalProgressAgeHours) &&
          metrics.canonicalProgressAgeHours > 2,
      },
      healthy: metrics.healthy,
      healthAlerts: metrics.healthAlerts || [],
      zeroClosureWithBacklog: zeroClosure,
      dependentResolverSymptoms,
      topFailures,
      routingQueueCounts: Object.fromEntries(
        Object.entries(routingQueues || {}).map(([role, queue]) => [role, queue?.total || 0])
      ),
    },
    controlPolicy: {
      activityIsNotProgress: true,
      frontierClosureBeforeExpansion: true,
      repeatedFailureRequiresChangedStrategy: true,
      dependentSymptomsDeferToRootOwner: true,
      hardTruthGatesMayNotBeWeakened: true,
    },
  };
}

const registry = await readJson(REGISTRY_PATH);
const scoreState = await readJson(SCORE_STATE_PATH);
const methodologyVersion = scoreState?.methodologyVersion || null;
const registryByTicker = Object.fromEntries((registry?.candidates || []).filter((row) => row?.ticker).map((row) => [row.ticker, row]));

let graph;
try {
  graph = await readJson(STATE_PATH);
} catch {
  graph = migrateLegacyQueue(await readJson(LEGACY_PATH), registry);
}

const expected = Number(registry?.expected || registry?.candidates?.length || 250);
const errors = validateWorkgraph(graph, expected);
if (errors.length) {
  console.error("Workgraph invariant failure:", errors);
  process.exit(1);
}

const [evidence, roleRuns] = await Promise.all([loadStructuredEvidence(ROOT), loadRoleRuns(ROOT)]);
const packets = [];
for (const [ticker, row] of Object.entries(graph.companies)) {
  if (["canonical", "blocked"].includes(row.state)) continue;
  const packet = compilePromotionPacket(ticker, evidence, row, {
    minConfidence: MIN_PUBLISHABLE_DATA_CONFIDENCE,
    methodologyVersion,
    registryEntry: registryByTicker[ticker] || null,
  });
  packets.push(packet);
  applyPacketState(graph, packet);
}

const postErrors = validateWorkgraph(graph, expected);
if (postErrors.length) {
  console.error("Workgraph post-compile invariant failure:", postErrors);
  process.exit(1);
}

const now = new Date();
const routingQueues = buildRoutingQueues(graph, packets, now.toISOString());
const metrics = computeWorkgraphMetrics(graph, now, evidence, roleRuns);
metrics.routingQueueCounts = Object.fromEntries(Object.entries(routingQueues).map(([role, queue]) => [role, queue.total]));
metrics.effectiveOwnerBacklog = {
  ...metrics.ownerBacklog,
  ...metrics.routingQueueCounts,
};
await writeWorkgraphArtifacts(ROOT, graph, packets, metrics, routingQueues);

const assistBus = buildAssistRequests(graph, packets, roleRuns, now.toISOString());
const workgraphDir = path.join(ROOT, "data", "runtime", "workgraph");
const shadowDir = path.join(workgraphDir, "shadow");
const workerViewDir = path.join(workgraphDir, "worker-view");
await mkdir(shadowDir, { recursive: true });
await mkdir(workerViewDir, { recursive: true });

async function writeJsonArtifact(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compactAssistRequest(request) {
  return {
    requestId: request.requestId,
    inputSignature: request.inputSignature,
    ticker: request.ticker,
    workId: request.workId,
    sourceState: request.sourceState,
    rootOwner: request.rootOwner,
    helperRole: request.helperRole,
    capability: request.capability,
    exactQuestion: request.exactQuestion,
    failures: request.failures,
    packetPath: request.packetPath,
    evidencePaths: (request.evidencePaths || []).slice(-24),
    successCondition: request.successCondition,
    priority: request.priority,
    status: request.status,
    priorAttempt: request.priorAttempt || null,
  };
}

await writeJsonArtifact(path.join(workgraphDir, "assist-bus.json"), assistBus);
const assistViewDir = path.join(workerViewDir, "assist");
await mkdir(assistViewDir, { recursive: true });
const helperRoles = ["earth-scout", "council-alpha", "council-beta", "deep-resolver"];
for (const role of helperRoles) {
  await writeJsonArtifact(path.join(assistViewDir, `${role}.json`), {
    version: 1,
    contract: "earth2036-worker-assist-view-v1",
    generatedAt: assistBus.generatedAt,
    helperRole: role,
    sourceContract: assistBus.contract,
    active: assistBus.byHelper?.[role] || 0,
    totalActive: assistBus.active,
    totalDormant: assistBus.dormant,
    totalQueued: assistBus.queued || 0,
    requests: (assistBus.requests || [])
      .filter((request) => request.helperRole === role && request.status === "active")
      .map(compactAssistRequest),
  });
}
await writeJsonArtifact(path.join(assistViewDir, "summary.json"), {
  version: 1,
  contract: "earth2036-worker-assist-summary-v1",
  generatedAt: assistBus.generatedAt,
  sourceContract: assistBus.contract,
  active: assistBus.active,
  dormant: assistBus.dormant,
  queued: assistBus.queued || 0,
  total: assistBus.total,
  byHelper: assistBus.byHelper,
  activeRequests: (assistBus.requests || [])
    .filter((request) => request.status === "active")
    .map(compactAssistRequest),
});

const canonicalCalibrationAudits = Object.entries(scoreState?.candidates || {})
  .map(([ticker, record]) => auditCalibrationRecord({ ticker, ...record }));
const frontierCalibrationGuidance = packets
  .filter((packet) => ["packet_ready", "chief_ready"].includes(graph.companies?.[packet.ticker]?.state))
  .map(buildPacketCalibrationGuidance);
const calibrationAuditDir = path.join(shadowDir, "calibration-audits");
await mkdir(calibrationAuditDir, { recursive: true });
for (const audit of canonicalCalibrationAudits) {
  if (!audit?.ticker) continue;
  await writeJsonArtifact(path.join(calibrationAuditDir, `${audit.ticker}.json`), audit);
}
const calibrationShadow = {
  version: 1,
  contract: "earth2036-calibration-shadow-v1",
  generatedAt: now.toISOString(),
  methodologyVersion: CALIBRATION_REGISTRY.version,
  calibrationVersion: CALIBRATION_REGISTRY.calibrationVersion,
  canonicalWriteAuthority: false,
  canonicalRecordsAudited: canonicalCalibrationAudits.length,
  canonicalRecordsPassingContract: canonicalCalibrationAudits.filter((row) => row.passed).length,
  canonicalAuditIndex: canonicalCalibrationAudits.map((row) => ({
    ticker: row.ticker,
    passed: row.passed,
    reasons: row.reasons || [],
    shardPath: row.ticker ? `data/runtime/workgraph/shadow/calibration-audits/${row.ticker}.json` : null,
  })),
  frontierGuidance: frontierCalibrationGuidance,
};
await writeJsonArtifact(path.join(shadowDir, "calibration.json"), calibrationShadow);
await writeJsonArtifact(path.join(workerViewDir, "calibration-summary.json"), {
  version: 1,
  contract: "earth2036-worker-calibration-view-v1",
  generatedAt: calibrationShadow.generatedAt,
  methodologyVersion: calibrationShadow.methodologyVersion,
  calibrationVersion: calibrationShadow.calibrationVersion,
  canonicalWriteAuthority: false,
  canonicalRecordsAudited: calibrationShadow.canonicalRecordsAudited,
  canonicalRecordsPassingContract: calibrationShadow.canonicalRecordsPassingContract,
  frontierGuidance: calibrationShadow.frontierGuidance,
});

const digitalTwinShadow = buildDigitalTwinShadow(graph, packets, now.toISOString());
const digitalTwinDir = path.join(shadowDir, "digital-twins");
await mkdir(digitalTwinDir, { recursive: true });
for (const twin of digitalTwinShadow.twins || []) {
  if (!twin?.ticker) continue;
  await writeJsonArtifact(path.join(digitalTwinDir, `${twin.ticker}.json`), twin);
}
const digitalTwinEntries = (digitalTwinShadow.twins || []).map((twin) => ({
  ticker: twin.ticker,
  workId: twin.workId,
  inputSignature: twin.inputSignature,
  sourceState: twin.sourceState,
  preflightPassed: twin.representationQuality?.preflightPassed === true,
  primarySourceCount: twin.representationQuality?.primarySourceCount || 0,
  missingPerspectives: twin.representationQuality?.missingPerspectives || [],
  preflightFailures: twin.constraintSignals?.preflightFailures || [],
  improvementQuestions: (twin.improvementWindows || []).map((row) => row.question),
  shardPath: twin.ticker ? `data/runtime/workgraph/shadow/digital-twins/${twin.ticker}.json` : null,
}));
const digitalTwinIndex = {
  version: digitalTwinShadow.version,
  contract: "earth2036-digital-twin-shadow-index-v2",
  generatedAt: digitalTwinShadow.generatedAt,
  canonicalWriteAuthority: false,
  total: digitalTwinShadow.total,
  entries: digitalTwinEntries,
};
await writeJsonArtifact(path.join(shadowDir, "digital-twins.json"), digitalTwinIndex);
await writeJsonArtifact(path.join(workerViewDir, "digital-twins-index.json"), digitalTwinIndex);

const betaRelevantTickers = new Set([
  ...((routingQueues?.["council-beta"]?.items || []).slice(0, 6).map((row) => row.ticker)),
  ...((assistBus.requests || [])
    .filter((request) => request.helperRole === "council-beta" && request.status === "active")
    .map((request) => request.ticker)),
]);
await writeJsonArtifact(path.join(workerViewDir, "council-beta-digital-twins.json"), {
  version: 1,
  contract: "earth2036-worker-digital-twin-view-v1",
  generatedAt: digitalTwinShadow.generatedAt,
  canonicalWriteAuthority: false,
  tickers: [...betaRelevantTickers],
  twins: (digitalTwinShadow.twins || []).filter((twin) => betaRelevantTickers.has(twin.ticker)),
});

const valueAllocationShadow = buildValueAllocationShadow(graph, packets, assistBus, metrics, now.toISOString());
await writeFile(
  path.join(shadowDir, "value-allocation.json"),
  `${JSON.stringify(valueAllocationShadow, null, 2)}\n`,
  "utf8"
);

const dependencyShadow = buildDependencyShadow(assistBus, now.toISOString());
await writeJsonArtifact(path.join(shadowDir, "dependencies.json"), dependencyShadow);
await writeJsonArtifact(path.join(workerViewDir, "command-summary.json"), {
  version: 1,
  contract: "earth2036-worker-command-summary-v1",
  generatedAt: now.toISOString(),
  canonicalWriteAuthority: false,
  workgraph: {
    total: metrics.total,
    counts: metrics.counts,
    healthy: metrics.healthy,
    healthAlerts: metrics.healthAlerts || [],
    canonicalProgressAgeHours: metrics.canonicalProgressAgeHours,
    effectiveOwnerBacklog: metrics.effectiveOwnerBacklog || metrics.ownerBacklog || {},
    routingQueueCounts: metrics.routingQueueCounts || {},
  },
  assist: {
    active: assistBus.active,
    dormant: assistBus.dormant,
    queued: assistBus.queued || 0,
    byHelper: assistBus.byHelper,
  },
  dependencies: {
    healthy: dependencyShadow.healthy,
    roleCycles: dependencyShadow.roleCycles || [],
    deadlocks: dependencyShadow.deadlocks || [],
  },
  allocation: {
    capacityPlan: valueAllocationShadow.capacityPlan,
    top: (valueAllocationShadow.attentionQueue || valueAllocationShadow.top || []).slice(0, 20),
  },
  workerViews: {
    assistSummary: "data/runtime/workgraph/worker-view/assist/summary.json",
    calibration: "data/runtime/workgraph/worker-view/calibration-summary.json",
    digitalTwins: "data/runtime/workgraph/worker-view/digital-twins-index.json",
    betaDigitalTwins: "data/runtime/workgraph/worker-view/council-beta-digital-twins.json",
  },
});

const rankingState = await readJsonOr(path.join(ROOT, "data", "runtime", "current-ranking.json"), { rankings: [] });
const observationsState = await readJsonOr(path.join(ROOT, "data", "runtime", "company-observations.json"), { candidates: {} });
const trajectoryAsOf = rankingState?.capturedAt || scoreState?.updatedAt || now.toISOString();
const fundamentalsByTicker = await loadVerifiedBridgeIndex({
  file: path.join(ROOT, "data", "lab", "bridge", "current-index.json"),
  asOf: trajectoryAsOf,
  observations: observationsState?.candidates || {},
  tickers: (rankingState?.rankings || []).map((row) => row.ticker),
});
const trajectoryShadowBase = buildTrajectorySnapshot({
  rankings: rankingState?.rankings || [],
  observations: observationsState?.candidates || {},
  workgraphCompanies: graph?.companies || {},
  fundamentalsByTicker,
  asOf: trajectoryAsOf,
  generatedAt: now.toISOString(),
  methodologyVersion: rankingState?.methodologyVersion || methodologyVersion,
  universeVersion: rankingState?.universeVersion || "u1-250",
  trialTickNumber: null,
});
const trajectoryErrors = validateTrajectorySnapshot(trajectoryShadowBase);
const trajectoryShadow = {
  ...trajectoryShadowBase,
  validation: {
    passed: trajectoryErrors.length === 0,
    errors: trajectoryErrors,
  },
  mode: "pre-t0-and-live-dry-run",
  note: "Shadow capture proves the T1000 feature pipeline without changing canonical score, rank, Workgraph state or tick qualification.",
};
await writeFile(
  path.join(shadowDir, "trajectory.json"),
  `${JSON.stringify(trajectoryShadow, null, 2)}\n`,
  "utf8"
);

const priorLearningState = await readJsonOr(LEARNING_PATH, null);
const learningState = deriveLearningState(priorLearningState, metrics, packets, routingQueues, roleRuns, now);
await import("node:fs/promises").then(({ writeFile }) =>
  writeFile(LEARNING_PATH, `${JSON.stringify(learningState, null, 2)}\n`, "utf8")
);

console.log(`Workgraph v2: ${metrics.total} companies; ${metrics.counts.chief_ready} chief_ready; ${metrics.counts.packet_ready} packet_ready; ${metrics.counts.blocked} blocked; assists ${assistBus.active} active/${assistBus.dormant} dormant; calibration, Digital Twin, Trajectory and value-allocation shadows refreshed.`);
