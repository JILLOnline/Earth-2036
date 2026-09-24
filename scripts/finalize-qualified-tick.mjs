import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { qualifiesT0Publication, qualifiesTick } from "./lib/runtime-gates.mjs";
import { buildTrajectorySnapshot, validateTrajectorySnapshot } from "./lib/trajectory-engine.mjs";
import { loadVerifiedBridgeIndex } from "./lib/fundamentals-bridge-index.mjs";

const ROOT = process.cwd();
const RUNTIME = path.join(ROOT, "data", "runtime");
const BASELINE_DIR = path.join(ROOT, "data", "baselines", "earth2036-official-t0-2026-09-12");
const MANIFEST = path.join(BASELINE_DIR, "manifest.json");
const T0_RANKING = path.join(BASELINE_DIR, "t0-ranking.json");

async function readText(file, fallback = "") {
  try { return await readFile(file, "utf8"); } catch { return fallback; }
}

async function readJson(file, fallback) {
  const text = await readText(file, "");
  if (!text) return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function appendJsonLine(file, value) {
  const prior = await readText(file, "");
  await writeFile(file, `${prior}${JSON.stringify(value)}\n`, "utf8");
}

function isAtOrAfter(value, floor) {
  const a = Date.parse(value || "");
  const b = Date.parse(floor || "");
  return Number.isFinite(a) && Number.isFinite(b) && a >= b;
}

const [state, supervisorState, integrity, manifest, ranking, observations, entities, workgraph] = await Promise.all([
  readJson(path.join(RUNTIME, "system-state.json"), null),
  readJson(path.join(RUNTIME, "supervisor-state.json"), null),
  readJson(path.join(RUNTIME, "intelligence-integrity.json"), null),
  readJson(MANIFEST, null),
  readJson(path.join(RUNTIME, "current-ranking.json"), { rankings: [] }),
  readJson(path.join(RUNTIME, "company-observations.json"), { candidates: {} }),
  readJson(path.join(RUNTIME, "entity-registry.json"), { candidates: [] }),
  readJson(path.join(RUNTIME, "workgraph", "state.json"), null),
]);

if (!state?.cycleKey) {
  console.log(JSON.stringify({ councilFinalizer: "NOOP", reason: "missing_prior_cycle" }));
  process.exit(0);
}

if (workgraph?.version !== 2) {
  console.error(JSON.stringify({ councilFinalizer: "BLOCKED", reason: "workgraph_v2_required" }));
  process.exitCode = 1;
  process.exit();
}

const workgraphRows = Object.values(workgraph?.companies || {});
const expectedCompanies = Number(state.companiesExpected || 250);
const workgraphCanonical = workgraphRows.filter((row) => row?.state === "canonical").length;
const workgraphBlocked = workgraphRows.filter((row) => row?.state === "blocked").length;
const workgraphApprovalPassed = Boolean(
  workgraph?.version === 2 &&
  workgraphRows.length === expectedCompanies &&
  workgraphCanonical === expectedCompanies &&
  workgraphBlocked === 0
);
const workgraphAttestation = workgraphApprovalPassed ? {
  attestationId: `workgraph-v2:${workgraph.generatedAt || state.lastCycleAt}`,
  managerId: "chief-earth",
  approvedAt: workgraph.generatedAt || state.lastCycleAt,
  lanes: {
    workgraph: {
      version: 2,
      generatedAt: workgraph.generatedAt || null,
      canonicalCompanies: workgraphCanonical,
      blockedCompanies: workgraphBlocked,
    },
  },
} : null;
const effectiveCouncilPassed = workgraphApprovalPassed;
const effectiveAttestation = workgraphAttestation;
const supervisorSameCycle = supervisorState?.cycleKey === state.cycleKey;
const supervisorFreshForCycle = isAtOrAfter(supervisorState?.updatedAt, state.lastCycleAt);
const supervisorCoverage = Number(state.supervisorSourceCoverageRatio ?? supervisorState?.sourceCoverageRatio ?? 0);
const sourceCoverage = Math.min(Number(state.machineSourceCoverageRatio ?? 0), supervisorCoverage);
const discoveryScanCompleted = Boolean(
  state.machineDiscoveryComplete === true &&
  state.discoveryScanCompleted === true
);
const integrityFreshForCycle = isAtOrAfter(integrity?.checkedAt, state.lastCycleAt);
const intelligenceIntegrityPassed = Boolean(integrityFreshForCycle && integrity?.passed === true && integrity?.sourceMesh?.passed === true);
const rankingRows = Array.isArray(ranking?.rankings) ? ranking.rankings : [];
const rankingTickers = new Set(rankingRows.map((row) => row?.ticker).filter(Boolean));
const rankingComplete = rankingRows.length === 250 && rankingTickers.size === 250 && rankingRows.every((row, index) => row.rank === index + 1);

const fullUniverseInput = {
  companiesExpected: Number(state.companiesExpected),
  companiesObserved: Number(state.companiesObserved),
  identityValidated: Number(state.identityValidated),
  tradabilityValidated: Number(state.tradabilityValidated),
  sourceCoverage,
  discoveryScanCompleted,
  methodologyVersion: state.methodologyVersion,
  unresolvedEvidence: Number(state.unresolvedEvidence),
  scoredCompanies: Number(state.publishableCompanies),
  councilApproved: effectiveCouncilPassed,
  intelligenceIntegrityPassed,
};

// Optional shadow refs are read ONLY after canonical qualification inputs have been computed.
// A missing, stale or invalid #11 index cannot alter T0/T1000 qualification.
const fundamentalsByTicker = await loadVerifiedBridgeIndex({
  file: path.join(ROOT, "data", "runtime", "workgraph", "shadow", "fundamentals-bridge-index.json"),
  asOf: state.lastCycleAt,
  observations: observations?.candidates || {},
  tickers: rankingRows.map((row) => row.ticker),
});
const finalizationDiagnostics = {
  cycleKey: state.cycleKey,
  councilPassed: effectiveCouncilPassed,
  councilReasons: !workgraphApprovalPassed
    ? [`workgraph_v2_not_fully_canonical:${workgraphCanonical}/${expectedCompanies}`, ...(workgraphBlocked ? [`workgraph_blocked:${workgraphBlocked}`] : [])]
    : [],
  workgraphVersion: workgraph.version,
  workgraphCanonical,
  workgraphBlocked,
  supervisorSameCycle,
  supervisorFreshForCycle,
  sourceCoverage,
  discoveryScanCompleted,
  integrityFreshForCycle,
  intelligenceIntegrityPassed,
  rankingComplete,
};

if (!manifest?.published) {
  const t0Qualified = qualifiesT0Publication(fullUniverseInput) && rankingComplete;
  if (!t0Qualified) {
    console.log(JSON.stringify({ councilFinalizer: "T0_NOOP", t0Qualified, ...finalizationDiagnostics }, null, 2));
    process.exit(0);
  }

  const existingT0 = await readJson(T0_RANKING, null);
  if (existingT0 && (existingT0.cycleKey !== state.cycleKey || existingT0.attestationId !== effectiveAttestation?.attestationId)) {
    console.error(JSON.stringify({ councilFinalizer: "T0_BLOCKED", reason: "conflicting_immutable_t0_snapshot", ...finalizationDiagnostics }, null, 2));
    process.exitCode = 1;
    process.exit();
  }

  const publishedAt = new Date().toISOString();
  const t0TrajectoryBase = buildTrajectorySnapshot({
    rankings: rankingRows,
    observations: observations?.candidates || {},
    workgraphCompanies: workgraph?.companies || {},
    fundamentalsByTicker,
    asOf: state.lastCycleAt,
    generatedAt: publishedAt,
    methodologyVersion: state.methodologyVersion,
    universeVersion: state.universeVersion,
    trialTickNumber: 0,
  });
  const t0TrajectoryErrors = validateTrajectorySnapshot(t0TrajectoryBase);
  const t0Trajectory = {
    ...t0TrajectoryBase,
    validation: { passed: t0TrajectoryErrors.length === 0, errors: t0TrajectoryErrors },
    captureRole: "t0-origin",
  };
  const t0Snapshot = existingT0 ?? {
    baselineId: manifest?.baselineId ?? "earth2036-official-t0-2026-09-12",
    cycleKey: state.cycleKey,
    capturedAt: state.lastCycleAt,
    publishedAt,
    methodologyVersion: state.methodologyVersion,
    universeVersion: state.universeVersion,
    companies: 250,
    identityValidated: state.identityValidated,
    tradabilityValidated: state.tradabilityValidated,
    sourceCoverageRatio: sourceCoverage,
    discoveryScanCompleted,
    intelligenceIntegrityPassed,
    attestationId: effectiveAttestation?.attestationId ?? null,
    councilLanes: effectiveAttestation?.lanes ?? {},
    trajectory: t0Trajectory,
    rankings: rankingRows,
  };
  if (!existingT0) await writeJson(T0_RANKING, t0Snapshot);

  const t0Checks = {
    identity: state.identityValidated === 250,
    tradability: state.tradabilityValidated === 250,
    scored: state.publishableCompanies === 250,
    publishable: state.publishableCompanies === 250,
    sourceCoverage: sourceCoverage >= 0.95,
    discovery: discoveryScanCompleted,
    evidenceQueue: Number(state.unresolvedEvidence) === 0,
    council: effectiveCouncilPassed,
    intelligenceIntegrity: intelligenceIntegrityPassed,
    rankingSnapshot: rankingComplete,
  };

  await writeJson(MANIFEST, {
    ...manifest,
    status: "published",
    published: true,
    publishedAt: existingT0?.publishedAt ?? publishedAt,
    t0CycleKey: state.cycleKey,
    t0AttestationId: effectiveAttestation?.attestationId ?? null,
    sourceCoverageRatio: sourceCoverage,
    discoveryScanCompleted,
    trialEligible: true,
    runtimeGate: { checks: t0Checks, passed: Object.values(t0Checks).every(Boolean) },
  });
  await writeJson(path.join(RUNTIME, "current-ranking.json"), {
    ...ranking,
    official: true,
    officialBaselineId: manifest?.baselineId ?? "earth2036-official-t0-2026-09-12",
    officialAt: existingT0?.publishedAt ?? publishedAt,
  });
  await writeJson(path.join(RUNTIME, "system-state.json"), {
    ...state,
    phase: "trial",
    supervisorSourceCoverageRatio: supervisorCoverage,
    combinedSourceCoverageRatio: sourceCoverage,
    discoveryScanCompleted,
    qualifiedTick: false,
    lastCouncilFinalizedAt: publishedAt,
    t0PublishedAt: existingT0?.publishedAt ?? publishedAt,
    t0CycleKey: state.cycleKey,
  });
  await appendJsonLine(path.join(RUNTIME, "t0-finalizations.jsonl"), {
    cycleKey: state.cycleKey,
    publishedAt: existingT0?.publishedAt ?? publishedAt,
    attestationId: effectiveAttestation?.attestationId ?? null,
    sourceCoverageRatio: sourceCoverage,
    intelligenceIntegrityPassed,
    companies: 250,
  });

  console.log(JSON.stringify({
    councilFinalizer: "T0_FINALIZED",
    cycleKey: state.cycleKey,
    attestationId: effectiveAttestation?.attestationId ?? null,
    publishedAt: existingT0?.publishedAt ?? publishedAt,
  }, null, 2));
  process.exit(0);
}

const qualified = qualifiesTick({ baselinePublished: true, ...fullUniverseInput });
const alreadyFinalized = state.lastQualifiedCycleKey === state.cycleKey;
if (!qualified || alreadyFinalized) {
  console.log(JSON.stringify({ councilFinalizer: "TICK_NOOP", qualified, alreadyFinalized, ...finalizationDiagnostics }, null, 2));
  process.exit(0);
}

const nextTick = Number(state.qualifiedTrialTicks || manifest?.qualifiedTrialTicksAfterBaseline || 0) + 1;
const rankedByTicker = new Map(rankingRows.map((record) => [record.ticker, record]));
const tickRows = (entities.candidates || []).map((entity) => {
  const rank = rankedByTicker.get(entity.ticker) ?? null;
  return {
    ticker: entity.ticker,
    rank: rank?.rank ?? null,
    rankClass: rank?.rankClass ?? null,
    earthScore: rank?.earthScore ?? null,
    dataConfidence: rank?.dataConfidence ?? null,
    risk: rank?.risk ?? null,
    filingFingerprint: observations.candidates?.[entity.ticker]?.filingFingerprint ?? null,
  };
});

const finalizedAt = new Date().toISOString();
const trajectoryBase = buildTrajectorySnapshot({
  rankings: rankingRows,
  observations: observations?.candidates || {},
  workgraphCompanies: workgraph?.companies || {},
  fundamentalsByTicker,
  asOf: state.lastCycleAt,
  generatedAt: finalizedAt,
  methodologyVersion: state.methodologyVersion,
  universeVersion: state.universeVersion,
  trialTickNumber: nextTick,
});
const trajectoryErrors = validateTrajectorySnapshot(trajectoryBase);
const trajectorySnapshot = {
  ...trajectoryBase,
  validation: { passed: trajectoryErrors.length === 0, errors: trajectoryErrors },
  captureRole: "qualified-trial-tick",
};

const tickPath = path.join(RUNTIME, "ticks", `${state.cycleKey}.json`);
await writeJson(tickPath, {
  tickNumber: nextTick,
  cycleKey: state.cycleKey,
  capturedAt: state.lastCycleAt,
  finalizedAt,
  methodologyVersion: state.methodologyVersion,
  universeVersion: state.universeVersion,
  identityValidated: state.identityValidated,
  tradabilityValidated: state.tradabilityValidated,
  machineSourceCoverageRatio: state.machineSourceCoverageRatio,
  supervisorSourceCoverageRatio: supervisorCoverage,
  sourceCoverageRatio: sourceCoverage,
  discoveryScanCompleted,
  companiesObserved: state.companiesObserved,
  intelligenceIntegrityPassed,
  councilAttestation: {
    architectureVersion: "workgraph-v2",
    attestationId: effectiveAttestation?.attestationId ?? null,
    managerId: effectiveAttestation?.managerId ?? null,
    approvedAt: effectiveAttestation?.approvedAt ?? null,
    lanes: effectiveAttestation?.lanes ?? {},
  },
  trajectory: trajectorySnapshot,
  rankings: tickRows,
});

const nextState = {
  ...state,
  supervisorSourceCoverageRatio: supervisorCoverage,
  combinedSourceCoverageRatio: sourceCoverage,
  discoveryScanCompleted,
  qualifiedTick: true,
  qualifiedTrialTicks: nextTick,
  lastQualifiedCycleKey: state.cycleKey,
  lastCouncilFinalizedAt: finalizedAt,
};
await writeJson(path.join(RUNTIME, "system-state.json"), nextState);
await writeJson(MANIFEST, { ...manifest, qualifiedTrialTicksAfterBaseline: nextTick });
await appendJsonLine(path.join(RUNTIME, "tick-finalizations.jsonl"), {
  cycleKey: state.cycleKey,
  tickNumber: nextTick,
  finalizedAt,
  attestationId: effectiveAttestation?.attestationId ?? null,
  councilLaneCount: Object.keys(effectiveAttestation?.lanes ?? {}).length,
  sourceCoverageRatio: sourceCoverage,
  intelligenceIntegrityPassed,
  trajectoryCaptured: true,
  trajectoryValidationPassed: trajectoryErrors.length === 0,
  trajectorySnapshotHash: trajectorySnapshot.snapshotHash,
});

console.log(JSON.stringify({
  councilFinalizer: "TICK_FINALIZED",
  cycleKey: state.cycleKey,
  tickNumber: nextTick,
  attestationId: effectiveAttestation?.attestationId ?? null,
}, null, 2));
