import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyPacketState, buildRoutingQueues, compilePromotionPacket, computeWorkgraphMetrics, loadRoleRuns, loadStructuredEvidence, migrateLegacyQueue, validateWorkgraph, writeWorkgraphArtifacts } from "./lib/workgraph-v2.mjs";
import { auditCalibrationRecord, buildPacketCalibrationGuidance, CALIBRATION_REGISTRY } from "./lib/calibration-engine.mjs";
import { buildAssistRequests } from "./lib/assist-bus.mjs";
import { buildDigitalTwinShadow } from "./lib/digital-twin-engine.mjs";
import { buildValueAllocationShadow } from "./lib/value-allocator.mjs";
import { buildDependencyShadow } from "./lib/dependency-graph.mjs";
import { buildTrajectorySnapshot, validateTrajectorySnapshot } from "./lib/trajectory-engine.mjs";
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
const shadowDir = path.join(ROOT, "data", "runtime", "workgraph", "shadow");
await mkdir(shadowDir, { recursive: true });
await writeFile(
  path.join(ROOT, "data", "runtime", "workgraph", "assist-bus.json"),
  `${JSON.stringify(assistBus, null, 2)}\n`,
  "utf8"
);

const canonicalCalibrationAudits = Object.entries(scoreState?.candidates || {})
  .map(([ticker, record]) => auditCalibrationRecord({ ticker, ...record }));
const frontierCalibrationGuidance = packets
  .filter((packet) => ["packet_ready", "chief_ready"].includes(graph.companies?.[packet.ticker]?.state))
  .map(buildPacketCalibrationGuidance);
const calibrationShadow = {
  version: 1,
  contract: "earth2036-calibration-shadow-v1",
  generatedAt: now.toISOString(),
  methodologyVersion: CALIBRATION_REGISTRY.version,
  calibrationVersion: CALIBRATION_REGISTRY.calibrationVersion,
  canonicalWriteAuthority: false,
  canonicalRecordsAudited: canonicalCalibrationAudits.length,
  canonicalRecordsPassingContract: canonicalCalibrationAudits.filter((row) => row.passed).length,
  canonicalAudits: canonicalCalibrationAudits,
  frontierGuidance: frontierCalibrationGuidance,
};
await writeFile(
  path.join(shadowDir, "calibration.json"),
  `${JSON.stringify(calibrationShadow, null, 2)}\n`,
  "utf8"
);

const digitalTwinShadow = buildDigitalTwinShadow(graph, packets, now.toISOString());
await writeFile(
  path.join(shadowDir, "digital-twins.json"),
  `${JSON.stringify(digitalTwinShadow, null, 2)}\n`,
  "utf8"
);

const valueAllocationShadow = buildValueAllocationShadow(graph, packets, assistBus, metrics, now.toISOString());
await writeFile(
  path.join(shadowDir, "value-allocation.json"),
  `${JSON.stringify(valueAllocationShadow, null, 2)}\n`,
  "utf8"
);

const dependencyShadow = buildDependencyShadow(assistBus, now.toISOString());
await writeFile(
  path.join(shadowDir, "dependencies.json"),
  `${JSON.stringify(dependencyShadow, null, 2)}\n`,
  "utf8"
);

const rankingState = await readJsonOr(path.join(ROOT, "data", "runtime", "current-ranking.json"), { rankings: [] });
const observationsState = await readJsonOr(path.join(ROOT, "data", "runtime", "company-observations.json"), { candidates: {} });
const trajectoryAsOf = rankingState?.capturedAt || scoreState?.updatedAt || now.toISOString();
const trajectoryShadowBase = buildTrajectorySnapshot({
  rankings: rankingState?.rankings || [],
  observations: observationsState?.candidates || {},
  workgraphCompanies: graph?.companies || {},
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
