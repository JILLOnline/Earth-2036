import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MIN_PUBLISHABLE_DATA_CONFIDENCE, REQUIRED_SCORE_COMPONENTS } from "./runtime-gates.mjs";

export const WORKGRAPH_VERSION = 2;
export const WORKGRAPH_STATES = ["observed","triaged","researching","evidence_complete","packet_ready","chief_ready","canonical","blocked"];
export const REQUIRED_PERSPECTIVES = [
  "source-integrity",
  "company-underwriting",
  "structural-causal",
  "discovery-weak-signals",
  "adversarial-red-team",
  "expectations-execution",
];
const LEGACY_MAP = { queued: "observed", active: "researching", ready_for_chief: "evidence_complete", promoted: "canonical", blocked: "blocked" };
const FAILURE_OWNERS = {
  missing_workgraph_row: "machine",
  missing_structured_evidence: "council-alpha",
  missing_identity_validation: "machine",
  missing_tradability_validation: "machine",
  missing_methodology_version: "machine",
  missing_evidence_window: "machine",
  missing_primary_source: "council-alpha",
  missing_factor_evidence: "council-alpha",
  missing_numeric_score_record: "council-alpha",
  missing_risk_evidence: "council-beta",
  missing_score_risk_evidence: "council-alpha",
  missing_data_confidence_evidence: "council-alpha",
  missing_causal_mapping: "council-beta",
  missing_source_lineage: "council-alpha",
  unresolved_gating_issue: "deep-resolver",
  unresolved_gating_unknown: "deep-resolver",
  unresolved_material_contradiction: "deep-resolver",
  confidence_below_60: "council-alpha",
};

function asIso(value) {
  const d = value ? new Date(value) : new Date(0);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}
function ageHours(value, now = new Date()) {
  const d = new Date(value || 0);
  return Number.isNaN(d.getTime()) ? null : Math.max(0, (now.getTime() - d.getTime()) / 3_600_000);
}

const ACTIVITY_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
function validActivityDate(value, now) {
  const parsed = new Date(value || 0);
  if (Number.isNaN(parsed.getTime())) return { date: null, invalid: true, rejectedFuture: false };
  const delta = parsed.getTime() - now.getTime();
  if (delta > ACTIVITY_FUTURE_TOLERANCE_MS) return { date: null, invalid: false, rejectedFuture: true };
  if (delta > 0) return { date: new Date(now.getTime()), invalid: false, rejectedFuture: false };
  return { date: parsed, invalid: false, rejectedFuture: false };
}
function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}
function sourceKey(source, index) {
  return source?.originFingerprint || source?.sourceId || source?.id || source?.url || `anonymous:${index}`;
}
function dedupeSources(sources) {
  const seen = new Set();
  const unique = [];
  let missingLineage = 0;
  sources.forEach((source, index) => {
    const key = sourceKey(source, index);
    if (!source?.originFingerprint && !source?.sourceId && !source?.id && !source?.url) missingLineage += 1;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(source);
  });
  return {
    unique,
    rawCount: sources.length,
    uniqueCount: unique.length,
    duplicatesCollapsed: Math.max(0, sources.length - unique.length),
    missingLineage,
  };
}
function evidenceWindow(relevant, sources) {
  const sourceDates = sources.map((s) => s?.publishedAt).filter(Boolean).map((v) => new Date(v)).filter((d) => !Number.isNaN(d.getTime()));
  const generatedDates = relevant.map((r) => r.generatedAt).filter(Boolean).map((v) => new Date(v)).filter((d) => !Number.isNaN(d.getTime()));
  const all = [...sourceDates, ...generatedDates].sort((a, b) => a - b);
  if (!all.length) return null;
  return {
    start: all[0].toISOString(),
    end: all[all.length - 1].toISOString(),
    latestEvidenceGeneratedAt: generatedDates.length ? new Date(Math.max(...generatedDates.map((d) => d.getTime()))).toISOString() : null,
  };
}
function perspectiveOwner(perspective) {
  if (["source-integrity", "company-underwriting"].includes(perspective)) return "council-alpha";
  if (["structural-causal", "adversarial-red-team"].includes(perspective)) return "council-beta";
  if (["discovery-weak-signals", "expectations-execution"].includes(perspective)) return "earth-scout";
  return "machine";
}
function ownerForFailure(failure) {
  if (failure.startsWith("missing_specialist_perspective:")) return perspectiveOwner(failure.split(":")[1]);
  return FAILURE_OWNERS[failure] || "machine";
}

function sourceAddressedEvidenceLeaf(node) {
  if (!node || typeof node !== "object") return false;
  const value = Number.isFinite(node.value) ? node.value : Number.isFinite(node.numericAssessment) ? node.numericAssessment : null;
  const sourceIds = Array.isArray(node.sourceIds) ? node.sourceIds.filter(Boolean) : [];
  const note = String(node.note || node.basis || "").trim();
  return Number.isFinite(value) && sourceIds.length > 0 && note.length > 0;
}

function hasSourceAddressedEvidence(node) {
  if (!node || typeof node !== "object") return false;
  if (sourceAddressedEvidenceLeaf(node)) return true;
  return Object.values(node).some((value) => hasSourceAddressedEvidence(value));
}

function factorEvidenceCoverage(node, requiredKeys) {
  if (!node || typeof node !== "object") return { complete: false, missing: [...requiredKeys] };
  const missing = requiredKeys.filter((key) => !hasSourceAddressedEvidence(node[key]));
  return { complete: missing.length === 0, missing };
}

export function migrateLegacyQueue(legacy, registry = null, now = new Date()) {
  if (!legacy || typeof legacy !== "object" || !legacy.companies) throw new Error("Legacy T0 queue missing companies object");
  const companies = {};
  for (const [ticker, row] of Object.entries(legacy.companies)) {
    const legacyStatus = row?.status;
    companies[ticker] = {
      ticker,
      state: LEGACY_MAP[legacyStatus] || "observed",
      sourceState: legacyStatus || null,
      batchId: row?.batchId || null,
      attempts: Number.isFinite(row?.attempts) ? row.attempts : 0,
      blocker: row?.blockerSummary || null,
      evidencePath: row?.evidencePath || null,
      lastTransitionAt: asIso(row?.lastUpdatedAt),
      updatedAt: asIso(row?.lastUpdatedAt),
      workId: `t0:${ticker}`,
      preflight: null,
      lineage: { legacyQueueCycleKey: legacy.cycleKey || null, legacyPolicy: legacy.policy || null },
    };
  }

  for (const candidate of registry?.candidates || []) {
    const ticker = candidate?.ticker;
    if (!ticker || companies[ticker]) continue;
    companies[ticker] = {
      ticker,
      state: "observed",
      sourceState: "queued",
      batchId: null,
      attempts: 0,
      blocker: null,
      evidencePath: null,
      lastTransitionAt: asIso(registry?.updatedAt || legacy?.updatedAt),
      updatedAt: asIso(registry?.updatedAt || legacy?.updatedAt),
      workId: `t0:${ticker}`,
      preflight: null,
      lineage: {
        legacyQueueCycleKey: legacy.cycleKey || null,
        legacyPolicy: legacy.policy || null,
        hydratedFrom: "data/runtime/entity-registry.json"
      }
    };
  }

  return {
    version: WORKGRAPH_VERSION,
    policy: "workgraph-v2",
    phase: "t0-bootstrap",
    generatedAt: now.toISOString(),
    migratedFrom: { path: "data/runtime/supervisors/t0-bootstrap-queue.json", version: legacy.version || null, cycleKey: legacy.cycleKey || null, updatedAt: legacy.updatedAt || null },
    companies,
  };
}

export function validateWorkgraph(graph, expectedCount = 250) {
  const errors = [];
  if (!graph || graph.version !== WORKGRAPH_VERSION) errors.push("workgraph version must be 2");
  const rows = Object.values(graph?.companies || {});
  if (rows.length !== expectedCount) errors.push(`expected ${expectedCount} companies, found ${rows.length}`);
  const seen = new Set();
  for (const row of rows) {
    if (!row?.ticker) errors.push("company row missing ticker");
    if (seen.has(row?.ticker)) errors.push(`duplicate ticker ${row?.ticker}`);
    seen.add(row?.ticker);
    if (!WORKGRAPH_STATES.includes(row?.state)) errors.push(`invalid state ${row?.state} for ${row?.ticker}`);
    if (row?.state === "blocked" && !row?.blocker) errors.push(`blocked ${row?.ticker} missing exact blocker`);
    if (row?.state === "canonical" && !row?.evidencePath) errors.push(`canonical ${row?.ticker} missing evidencePath`);
  }
  return errors;
}

function normalizeSource(source) {
  if (!source || typeof source !== "object") return source;
  const sourceType = String(source.sourceType || "").toLowerCase();
  return {
    ...source,
    sourceId: source.sourceId || source.id || null,
    primary: source.primary === true || source.kind === "primary" || source.tier === "primary" || sourceType.includes("primary"),
  };
}

function normalizeEvidenceObject(obj, filePath) {
  const claims = Array.isArray(obj?.claims) ? obj.claims : [];
  const explicitFactors = Array.isArray(obj?.factors)
    ? obj.factors
    : Array.isArray(obj?.affectedMethodologyFactors)
      ? obj.affectedMethodologyFactors
      : obj?.factorEvidence && typeof obj.factorEvidence === "object"
        ? Object.keys(obj.factorEvidence).map((name) => ({ name }))
        : [];
  const claimFactors = claims.flatMap((claim) => Array.isArray(claim?.affectedFactors) ? claim.affectedFactors : []);
  const explicitCausalEdges = Array.isArray(obj?.causalEdges) ? obj.causalEdges : [];
  const claimCausalEdges = claims.flatMap((claim) => Array.isArray(claim?.causalEdges) ? claim.causalEdges : []);
  const resolverEvidenceSources = Array.isArray(obj?.resolution?.evidence)
    ? obj.resolution.evidence
        .filter((item) => item?.source)
        .map((item) => ({
          url: item.source,
          primary: item.primary === true,
          originFingerprint: item.originFingerprint || null,
          sourceId: item.sourceId || item.originFingerprint || item.source,
        }))
    : [];
  const inferredResolverGateKind =
    obj?.role === "deep-resolver" &&
    obj?.result === "resolved" &&
    obj?.gateImpact === "close_unresolved_material_contradiction_on_reconcile"
      ? "unresolved_material_contradiction"
      : null;
  const resolverItems = Array.isArray(obj?.items)
    ? obj.items
    : obj?.role === "deep-resolver" && obj?.result && obj?.gateKind
      ? [{ itemId: `${obj?.workId || obj?.ticker || "resolver"}:${obj.gateKind}`, status: obj.result }]
      : inferredResolverGateKind
        ? [{
            itemId: `${obj?.workId || obj?.ticker || "resolver"}:${inferredResolverGateKind}`,
            status: "resolved",
            dispositionSource: "explicit_gateImpact",
          }]
        : [];
  const rawConfidence = Number.isFinite(obj?.confidence)
    ? obj.confidence
    : Number.isFinite(obj?.resolution?.confidence)
      ? obj.resolution.confidence
      : null;
  const confidence = rawConfidence !== null && rawConfidence >= 0 && rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;
  return {
    path: filePath,
    version: obj?.version || null,
    contract: obj?.contract || null,
    role: obj?.role || null,
    ticker: obj?.ticker || obj?.entityId || obj?.entity?.ticker || null,
    workId: obj?.workId || null,
    perspective: obj?.perspective || obj?.laneId || null,
    cycleKey: obj?.cycleKey || obj?.sourceCycleKey || null,
    generatedAt: obj?.generatedAt || null,
    claims,
    factors: [...explicitFactors, ...claimFactors],
    factorEvidence: obj?.factorEvidence ?? null,
    scoreRecord: obj?.scoreRecord ?? null,
    riskEvidence: obj?.riskEvidence ?? null,
    dataConfidenceEvidence: obj?.dataConfidenceEvidence ?? null,
    sources: [...(Array.isArray(obj?.sources) ? obj.sources : []), ...resolverEvidenceSources].map(normalizeSource),
    risks: Array.isArray(obj?.risks) ? obj.risks : [],
    causalEdges: [...explicitCausalEdges, ...claimCausalEdges],
    contradictions: Array.isArray(obj?.contradictions) ? obj.contradictions : [],
    unknowns: Array.isArray(obj?.unknowns) ? obj.unknowns : [],
    gatingIssues: Array.isArray(obj?.gatingIssues) ? obj.gatingIssues : [],
    items: resolverItems,
    lineage: obj?.lineage && typeof obj.lineage === "object" ? obj.lineage : null,
    overallStatus: obj?.overallStatus || null,
    recommendedNextState: obj?.recommendedNextState || obj?.resolution?.recommendedNextState || null,
    confidence,
  };
}

function expandEvidenceRows(row) {
  if (!Array.isArray(row?.perspectives) || row.perspectives.length === 0) return [row];
  return row.perspectives.map((perspective) => ({
    ...row,
    ...perspective,
    ticker: perspective?.ticker || row?.ticker || row?.entityId || row?.entity?.ticker || null,
    entityId: perspective?.entityId || row?.entityId || row?.entity?.ticker || null,
    workId: perspective?.workId || row?.workId || null,
    role: perspective?.role || row?.role || null,
    generatedAt: perspective?.generatedAt || row?.generatedAt || null,
    sourceCycleKey: perspective?.sourceCycleKey || row?.sourceCycleKey || null,
    cycleKey: perspective?.cycleKey || row?.cycleKey || null,
    lineage: perspective?.lineage || row?.lineage || null,
    sources: [
      ...(Array.isArray(row?.sources) ? row.sources : []),
      ...(Array.isArray(perspective?.sources) ? perspective.sources : []),
    ],
  }));
}

export async function loadRoleRuns(root) {
  const dir = path.join(root, "data", "runtime", "workgraph", "role-runs");
  let files = [];
  try { files = (await readdir(dir)).filter((name) => name.endsWith(".json")); } catch { return []; }
  const out = [];
  for (const name of files) {
    try {
      const raw = JSON.parse(await readFile(path.join(dir, name), "utf8"));
      for (const row of (Array.isArray(raw) ? raw : [raw])) {
        if (!row?.role || !row?.generatedAt) continue;
        out.push({ ...row, path: path.relative(root, path.join(dir, name)) });
      }
    } catch (error) {
      console.warn(`Workgraph role-run load failed for ${name}: ${error?.message || error}`);
    }
  }
  return out;
}

export async function loadStructuredEvidence(root) {
  const dir = path.join(root, "data", "runtime", "workgraph", "evidence");
  let files = [];
  try { files = (await readdir(dir)).filter((name) => name.endsWith(".json")); } catch { return []; }
  const out = [];
  for (const name of files) {
    const full = path.join(dir, name);
    try {
      const raw = JSON.parse(await readFile(full, "utf8"));
      for (const row of (Array.isArray(raw) ? raw : [raw])) {
        for (const expanded of expandEvidenceRows(row)) out.push(normalizeEvidenceObject(expanded, path.relative(root, full)));
      }
    } catch (error) {
      console.warn(`Workgraph evidence load failed for ${name}: ${error?.message || error}`);
    }
  }
  return out;
}

export function compilePromotionPacket(ticker, evidenceRows, graphRow, options = {}) {
  const allRelevant = evidenceRows.filter((row) => row.ticker === ticker || (!row.ticker && row.workId === graphRow?.workId));

  // Evidence is append-only. Newer artifacts can supersede older evidence files,
  // while Deep Resolver can explicitly close stale gating defects without deleting history.
  const supersededPaths = new Set(
    allRelevant
      .map((row) => row?.lineage?.supersedes)
      .filter((value) => typeof value === "string" && value.length > 0)
  );
  const activeRelevant = allRelevant.filter((row) => !supersededPaths.has(row.path));
  const resolverRows = activeRelevant.filter((row) => row.role === "deep-resolver");
  const resolvedGateKinds = new Set();
  const resolvedGateAt = new Map();
  const markResolvedGate = (kind, row) => {
    resolvedGateKinds.add(kind);
    const at = Date.parse(row?.generatedAt || 0);
    if (!Number.isFinite(at)) return;
    const prior = resolvedGateAt.get(kind);
    if (!Number.isFinite(prior) || at > prior) resolvedGateAt.set(kind, at);
  };
  for (const row of resolverRows) {
    for (const item of row.items || []) {
      if (item?.status !== "resolved") continue;
      const id = String(item?.itemId || "");
      if (id.includes("unresolved_gating_issue")) markResolvedGate("gating_issue", row);
      if (id.includes("unresolved_gating_unknown")) markResolvedGate("gating_unknown", row);
      if (id.includes("unresolved_material_contradiction")) markResolvedGate("material_contradiction", row);
    }
  }
  const relevant = activeRelevant;

  // Resolver dispositions close only the evidence state they actually adjudicated.
  // Newer contradictory/gating evidence must reopen the corresponding gate rather
  // than being hidden by an older immutable Resolver closure.
  const hasNewerEvidenceAfterResolution = (kind, predicate) => {
    const resolvedAt = resolvedGateAt.get(kind);
    if (!Number.isFinite(resolvedAt)) return false;
    return relevant.some((row) => {
      if (row.role === "deep-resolver") return false;
      const generatedAt = Date.parse(row.generatedAt || 0);
      return Number.isFinite(generatedAt) && generatedAt > resolvedAt && predicate(row);
    });
  };
  if (
    resolvedGateKinds.has("material_contradiction") &&
    hasNewerEvidenceAfterResolution("material_contradiction", (row) =>
      (row.contradictions || []).some((c) => {
        if (!c || typeof c !== "object") return true;
        const disposition = String(c.disposition || c.resolutionStatus || "").toLowerCase();
        return c.resolved !== true && c.gating !== false && c.material !== false && !disposition.startsWith("resolved");
      })
    )
  ) resolvedGateKinds.delete("material_contradiction");
  if (
    resolvedGateKinds.has("gating_issue") &&
    hasNewerEvidenceAfterResolution("gating_issue", (row) => (row.gatingIssues || []).length > 0)
  ) resolvedGateKinds.delete("gating_issue");
  if (
    resolvedGateKinds.has("gating_unknown") &&
    hasNewerEvidenceAfterResolution("gating_unknown", (row) => (row.unknowns || []).some((u) => u?.gating === true))
  ) resolvedGateKinds.delete("gating_unknown");
  const rawSources = relevant.flatMap((r) => r.sources);
  const sourceLineage = dedupeSources(rawSources);
  const sources = sourceLineage.unique;
  const factors = relevant.flatMap((r) => r.factors);
  const risks = relevant.flatMap((r) => r.risks);
  const causalEdges = relevant.flatMap((r) => r.causalEdges);
  const contradictions = relevant.flatMap((r) => r.contradictions);
  const unknowns = relevant.flatMap((r) => r.unknowns);
  const gatingIssues = relevant.flatMap((r) => r.gatingIssues);
  const perspectives = uniqueStrings(relevant.map((r) => r.perspective));
  const missingPerspectives = REQUIRED_PERSPECTIVES.filter((p) => !perspectives.includes(p));
  const primarySources = sources.filter((s) => s?.primary === true || s?.kind === "primary" || s?.tier === "primary");
  const factorNames = uniqueStrings(factors.map((f) => typeof f === "string" ? f : f?.name));
  const unresolvedContradictions = resolvedGateKinds.has("material_contradiction")
    ? []
    : contradictions.filter((c) => {
      if (!c || typeof c !== "object") return true;
      const disposition = String(c.disposition || c.resolutionStatus || "").toLowerCase();
      return c.resolved !== true && c.gating !== false && c.material !== false && !disposition.startsWith("resolved");
    });
  const gatingUnknowns = resolvedGateKinds.has("gating_unknown")
    ? []
    : unknowns.filter((u) => u?.gating === true);
  const confidenceValues = relevant.map((r) => r.confidence).filter(Number.isFinite);
  const confidence = confidenceValues.length ? Math.min(...confidenceValues) : null;
  const methodologyVersion = options.methodologyVersion || null;
  const sourceIntegrityRows = relevant.filter((r) => r.perspective === "source-integrity");
  const underwritingRows = relevant.filter((r) => r.perspective === "company-underwriting");
  const scoreCandidates = underwritingRows.filter((r) => r.scoreRecord).sort((a,b) => Date.parse(b.generatedAt || 0) - Date.parse(a.generatedAt || 0));
  const rawScoreRecord = scoreCandidates[0]?.scoreRecord || null;
  const requiredScoreComponents = REQUIRED_SCORE_COMPONENTS;
  const normalizedComponents = rawScoreRecord
    ? Object.fromEntries(requiredScoreComponents.map((key) => [key, rawScoreRecord.components?.[key] ?? rawScoreRecord[key]]))
    : null;
  const scoreRecord = rawScoreRecord ? { ...rawScoreRecord, components: normalizedComponents } : null;
  const latestUnderwriting = underwritingRows.sort((a,b) => Date.parse(b.generatedAt || 0) - Date.parse(a.generatedAt || 0))[0] || null;
  const scoreFactorEvidence = latestUnderwriting?.factorEvidence ?? scoreRecord?.factorEvidence ?? null;
  const scoreRiskEvidence = latestUnderwriting?.riskEvidence ?? scoreRecord?.riskEvidence ?? null;
  const scoreDataConfidenceEvidence = latestUnderwriting?.dataConfidenceEvidence ?? scoreRecord?.dataConfidenceEvidence ?? null;
  const factorEvidenceCoverageResult = factorEvidenceCoverage(scoreFactorEvidence, requiredScoreComponents);
  const scoreRiskEvidenceComplete = hasSourceAddressedEvidence(scoreRiskEvidence);
  const scoreDataConfidenceEvidenceComplete = hasSourceAddressedEvidence(scoreDataConfidenceEvidence);
  const scoreRecordComplete = Boolean(
    scoreRecord &&
    scoreRecord.methodologyVersion === methodologyVersion &&
    Number.isFinite(scoreRecord.earthScore) &&
    Number.isFinite(scoreRecord.risk) &&
    Number.isFinite(scoreRecord.dataConfidence) &&
    scoreRecord.dataConfidence >= (options.minConfidence ?? MIN_PUBLISHABLE_DATA_CONFIDENCE) &&
    requiredScoreComponents.every((key) => Number.isFinite(scoreRecord.components?.[key])) &&
    factorEvidenceCoverageResult.complete &&
    scoreRiskEvidenceComplete &&
    scoreDataConfidenceEvidenceComplete &&
    Array.isArray(scoreRecord.primarySourceUrls) &&
    scoreRecord.primarySourceUrls.length > 0 &&
    scoreRecord.causalMapped === true
  );
  const dataConfidenceFactors = sourceIntegrityRows.flatMap((r) => r.factors).filter((f) => String(typeof f === "string" ? f : f?.name || "").toLowerCase().includes("data confidence"));
  const sourceIntegrityConfidence = sourceIntegrityRows.map((r) => r.confidence).filter(Number.isFinite);
  const dataConfidenceEvidence = {
    available: dataConfidenceFactors.length > 0 || sourceIntegrityConfidence.length > 0,
    factors: dataConfidenceFactors,
    confidenceFloor: sourceIntegrityConfidence.length ? Math.min(...sourceIntegrityConfidence) : null,
    evidencePaths: uniqueStrings(sourceIntegrityRows.map((r) => r.path)),
  };
  const registryEntry = options.registryEntry || null;
  const identityTradability = {
    ticker,
    company: registryEntry?.company || null,
    cik: registryEntry?.cik || null,
    exchange: registryEntry?.exchange || null,
    exchangeName: registryEntry?.exchangeName || null,
    identityStatus: registryEntry?.identityStatus || null,
    tradabilityStatus: registryEntry?.tradabilityStatus || null,
    validatedAt: registryEntry?.validatedAt || null,
  };
  const window = evidenceWindow(relevant, sources);
  const factorEvidenceByPerspective = Object.fromEntries(REQUIRED_PERSPECTIVES.map((p) => [p, relevant.filter((r) => r.perspective === p).flatMap((r) => r.factors)]));
  const specialistCoverage = { required: REQUIRED_PERSPECTIVES, present: perspectives, missing: missingPerspectives, complete: missingPerspectives.length === 0 };
  const failures = [];
  if (!graphRow) failures.push("missing_workgraph_row");
  if (!relevant.length) failures.push("missing_structured_evidence");
  if (identityTradability.identityStatus !== "validated") failures.push("missing_identity_validation");
  if (identityTradability.tradabilityStatus !== "validated") failures.push("missing_tradability_validation");
  if (!methodologyVersion) failures.push("missing_methodology_version");
  if (!window) failures.push("missing_evidence_window");
  for (const perspective of missingPerspectives) failures.push(`missing_specialist_perspective:${perspective}`);
  if (!primarySources.length) failures.push("missing_primary_source");
  if (!factorNames.length || !factorEvidenceCoverageResult.complete) failures.push("missing_factor_evidence");
  if (!scoreRecordComplete) failures.push("missing_numeric_score_record");
  if (!risks.length) failures.push("missing_risk_evidence");
  if (!scoreRiskEvidenceComplete) failures.push("missing_score_risk_evidence");
  if (!dataConfidenceEvidence.available || !scoreDataConfidenceEvidenceComplete) failures.push("missing_data_confidence_evidence");
  if (!causalEdges.length) failures.push("missing_causal_mapping");
  if (sourceLineage.missingLineage > 0) failures.push("missing_source_lineage");
  if (gatingIssues.length && !resolvedGateKinds.has("gating_issue")) failures.push("unresolved_gating_issue");
  if (gatingUnknowns.length) failures.push("unresolved_gating_unknown");
  if (unresolvedContradictions.length) failures.push("unresolved_material_contradiction");
  if (confidence !== null && confidence < (options.minConfidence ?? 60)) failures.push("confidence_below_60");
  const uniqueFailures = uniqueStrings(failures);
  const routing = uniqueFailures.map((failure) => ({ failure, owner: ownerForFailure(failure) }));

  return {
    version: 2,
    contract: "workgraph-v2-promotion-packet",
    ticker,
    workId: graphRow?.workId || `t0:${ticker}`,
    generatedAt: new Date().toISOString(),
    sourceState: graphRow?.state || null,
    methodologyVersion,
    identityTradability,
    evidenceWindow: window,
    specialistCoverage,
    perspectives,
    evidencePaths: uniqueStrings(relevant.map((r) => r.path)),
    evidenceResolution: {
      supersededPaths: [...supersededPaths].sort(),
      resolvedGateKinds: [...resolvedGateKinds].sort(),
      activeEvidenceCount: relevant.length,
      historicalEvidenceCount: allRelevant.length,
    },
    factorEvidence: { names: factorNames, byPerspective: factorEvidenceByPerspective },
    scoreRecord,
    scoreReadiness: {
      complete: scoreRecordComplete,
      requiredComponents: requiredScoreComponents,
      sourceAddressedEvidence: {
        factorEvidenceComplete: factorEvidenceCoverageResult.complete,
        missingFactorEvidence: factorEvidenceCoverageResult.missing,
        riskEvidenceComplete: scoreRiskEvidenceComplete,
        dataConfidenceEvidenceComplete: scoreDataConfidenceEvidenceComplete,
      },
    },
    factors: factorNames,
    riskEvidence: { present: risks.length > 0, items: risks },
    risks,
    dataConfidenceEvidence,
    primarySourcePresence: { present: primarySources.length > 0, count: primarySources.length },
    causalMapping: { present: causalEdges.length > 0, edges: causalEdges },
    causalEdges,
    sourceLineage: {
      rawSourceCount: sourceLineage.rawCount,
      uniqueSourceCount: sourceLineage.uniqueCount,
      duplicatesCollapsed: sourceLineage.duplicatesCollapsed,
      missingLineage: sourceLineage.missingLineage,
      uniqueOrigins: uniqueStrings(sources.map((s, i) => sourceKey(s, i))),
    },
    sources,
    contradictions,
    contradictionDispositions: { unresolvedMaterialCount: unresolvedContradictions.length, items: contradictions },
    unknowns,
    unknownDisposition: { gatingCount: gatingUnknowns.length, nonGatingCount: Math.max(0, unknowns.length - gatingUnknowns.length) },
    gatingIssues,
    confidence,
    preflight: { passed: uniqueFailures.length === 0, failures: uniqueFailures, routing },
  };
}

export function applyPacketState(graph, packet) {
  const row = graph.companies?.[packet.ticker];
  if (!row || row.state === "canonical" || row.state === "blocked") return graph;
  const previousState = row.state;
  if (packet.preflight?.passed) {
    row.state = "chief_ready";
    row.preflight = packet.preflight;
    if (previousState !== "chief_ready") row.lastTransitionAt = packet.generatedAt;
    row.updatedAt = packet.generatedAt;
  } else if (packet.specialistCoverage?.complete) {
    row.state = "packet_ready";
    row.preflight = packet.preflight;
    if (previousState !== "packet_ready") row.lastTransitionAt = packet.generatedAt;
    row.updatedAt = packet.generatedAt;
  } else if ((packet.evidencePaths?.length || 0) > 0) {
    row.state = "researching";
    row.preflight = packet.preflight;
    if (previousState !== "researching") row.lastTransitionAt = packet.generatedAt;
    row.updatedAt = packet.generatedAt;
  } else {
    if (["evidence_complete", "packet_ready", "chief_ready"].includes(previousState)) {
      row.state = "researching";
      if (previousState !== "researching") row.lastTransitionAt = packet.generatedAt;
    }
    row.preflight = packet.preflight;
    row.updatedAt = packet.generatedAt;
  }
  return graph;
}


const ROUTABLE_ROLES = ["earth-scout", "council-alpha", "council-beta", "deep-resolver"];
const ROUTE_STATE_PRIORITY = {
  packet_ready: 0,
  evidence_complete: 1,
  researching: 2,
  triaged: 3,
  observed: 4,
  blocked: 5,
  chief_ready: 90,
  canonical: 99,
};

export function buildRoutingQueues(graph, packets, generatedAt = new Date().toISOString()) {
  const queues = Object.fromEntries(ROUTABLE_ROLES.map((role) => [role, []]));
  for (const packet of packets || []) {
    const row = graph?.companies?.[packet?.ticker];
    if (!row || ["canonical", "chief_ready", "blocked"].includes(row.state)) continue;
    const routing = Array.isArray(packet?.preflight?.routing) ? packet.preflight.routing : [];
    const owners = [...new Set(routing.map((route) => route?.owner).filter(Boolean))];
    for (const role of ROUTABLE_ROLES) {
      const ownedFailures = [...new Set(
        routing.filter((route) => route?.owner === role).map((route) => route.failure).filter(Boolean)
      )];
      if (!ownedFailures.length) continue;

      // Deep Resolver is an adjudication lane, not a duplicate source-acquisition lane.
      // If its only failures are downstream gating symptoms and another owner still has
      // a concrete root-cause failure on the same packet, let that owner close first.
      // Material contradictions remain independently actionable and are never deferred.
      const resolverHasMaterialContradiction = ownedFailures.includes("unresolved_material_contradiction");
      const resolverOnlyDependentGates =
        role === "deep-resolver" &&
        !resolverHasMaterialContradiction &&
        ownedFailures.every((failure) =>
          ["unresolved_gating_issue", "unresolved_gating_unknown"].includes(failure)
        ) &&
        owners.some((owner) => owner !== "deep-resolver");
      if (resolverOnlyDependentGates) continue;

      queues[role].push({
        ticker: packet.ticker,
        workId: packet.workId || row.workId || `t0:${packet.ticker}`,
        state: row.state,
        packetPath: `data/runtime/workgraph/packets/${packet.ticker}.json`,
        ownedFailures,
        allFailures: [...(packet?.preflight?.failures || [])],
        otherOwners: owners.filter((owner) => owner !== role).sort(),
        evidencePaths: [...(packet?.evidencePaths || [])],
        specialistCoverage: packet?.specialistCoverage || null,
        evidenceResolution: packet?.evidenceResolution || null,
        unresolved: role === "deep-resolver" ? {
          gatingIssues: packet?.gatingIssues || [],
          gatingUnknowns: (packet?.unknowns || []).filter((item) => item?.gating === true),
          materialContradictions: (packet?.contradictions || []).filter((item) => item?.resolved !== true && item?.gating !== false),
        } : null,
      });
    }
  }

  for (const role of ROUTABLE_ROLES) {
    queues[role].sort((a, b) => {
      const stateDelta = (ROUTE_STATE_PRIORITY[a.state] ?? 50) - (ROUTE_STATE_PRIORITY[b.state] ?? 50);
      if (stateDelta) return stateDelta;
      const ownerDelta = a.otherOwners.length - b.otherOwners.length;
      if (ownerDelta) return ownerDelta;
      const failureDelta = a.allFailures.length - b.allFailures.length;
      if (failureDelta) return failureDelta;
      const evidenceDelta = b.evidencePaths.length - a.evidencePaths.length;
      if (evidenceDelta) return evidenceDelta;
      return a.ticker.localeCompare(b.ticker);
    });
    queues[role] = {
      version: 1,
      contract: "workgraph-v2-routing-queue",
      role,
      generatedAt,
      selectionPolicy: "closure-first-deterministic",
      total: queues[role].length,
      items: queues[role].map((item, index) => ({ rank: index + 1, ...item })),
    };
  }
  return queues;
}

export function computeWorkgraphMetrics(graph, now = new Date(), evidenceRows = [], roleRuns = []) {
  const counts = Object.fromEntries(WORKGRAPH_STATES.map((s) => [s, 0]));
  const oldestAgeHours = Object.fromEntries(WORKGRAPH_STATES.map((s) => [s, null]));
  const newestAgeHours = Object.fromEntries(WORKGRAPH_STATES.map((s) => [s, null]));
  const attempts = { total: 0, max: 0, over3: 0 };
  const preflightFailures = {};
  const ownerBacklog = {};
  for (const row of Object.values(graph?.companies || {})) {
    counts[row.state] = (counts[row.state] || 0) + 1;
    const age = ageHours(row.lastTransitionAt || row.updatedAt, now);
    if (age !== null && (oldestAgeHours[row.state] === null || age > oldestAgeHours[row.state])) oldestAgeHours[row.state] = age;
    if (age !== null && (newestAgeHours[row.state] === null || age < newestAgeHours[row.state])) newestAgeHours[row.state] = age;
    const n = Number(row.attempts || 0);
    attempts.total += n;
    attempts.max = Math.max(attempts.max, n);
    if (n >= 3) attempts.over3 += 1;
    for (const failure of row?.preflight?.failures || []) preflightFailures[failure] = (preflightFailures[failure] || 0) + 1;
    const routedOwners = new Set((row?.preflight?.routing || []).map((route) => route?.owner).filter(Boolean));
    for (const owner of routedOwners) ownerBacklog[owner] = (ownerBacklog[owner] || 0) + 1;
  }

  const roleActivity = {};
  const telemetry = {
    invalidEvidenceTimestamps: 0,
    invalidRoleRunTimestamps: 0,
    futureEvidenceRejected: 0,
    futureRoleRunsRejected: 0,
    livenessPolicy: "freshest-valid-evidence-or-role-run",
  };
  for (const evidence of evidenceRows || []) {
    const role = evidence?.role || "unknown";
    const parsed = validActivityDate(evidence?.generatedAt, now);
    if (parsed.invalid) { telemetry.invalidEvidenceTimestamps += 1; continue; }
    if (parsed.rejectedFuture) { telemetry.futureEvidenceRejected += 1; continue; }
    const generated = parsed.date;
    const age = Math.max(0, (now.getTime() - generated.getTime()) / 3_600_000);
    const activity = roleActivity[role] || {
      lastGeneratedAt: null, lastAgeHours: null, last1h: 0, last6h: 0, last24h: 0, total: 0,
      lastRunAt: null, lastRunAgeHours: null, runs1h: 0, runs6h: 0, runs24h: 0, totalRuns: 0,
    };
    activity.total += 1;
    if (age <= 1) activity.last1h += 1;
    if (age <= 6) activity.last6h += 1;
    if (age <= 24) activity.last24h += 1;
    if (activity.lastAgeHours === null || age < activity.lastAgeHours) {
      activity.lastAgeHours = Math.round(age * 100) / 100;
      activity.lastGeneratedAt = generated.toISOString();
    }
    roleActivity[role] = activity;
  }

  for (const run of roleRuns || []) {
    const role = run?.role || "unknown";
    const parsed = validActivityDate(run?.generatedAt, now);
    if (parsed.invalid) { telemetry.invalidRoleRunTimestamps += 1; continue; }
    if (parsed.rejectedFuture) { telemetry.futureRoleRunsRejected += 1; continue; }
    const generated = parsed.date;
    const age = Math.max(0, (now.getTime() - generated.getTime()) / 3_600_000);
    const activity = roleActivity[role] || {
      lastGeneratedAt: null, lastAgeHours: null, last1h: 0, last6h: 0, last24h: 0, total: 0,
      lastRunAt: null, lastRunAgeHours: null, runs1h: 0, runs6h: 0, runs24h: 0, totalRuns: 0,
    };
    activity.totalRuns += 1;
    if (age <= 1) activity.runs1h += 1;
    if (age <= 6) activity.runs6h += 1;
    if (age <= 24) activity.runs24h += 1;
    if (activity.lastRunAgeHours === null || age < activity.lastRunAgeHours) {
      activity.lastRunAgeHours = Math.round(age * 100) / 100;
      activity.lastRunAt = generated.toISOString();
    }
    roleActivity[role] = activity;
  }

  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  const canonicalProgressAgeHours = newestAgeHours.canonical;
  const healthAlerts = [];
  if ((counts.chief_ready || 0) > 0 && canonicalProgressAgeHours !== null && canonicalProgressAgeHours > 2) {
    healthAlerts.push(`t0_canonical_stalled_over_2h_with_chief_ready:${Math.round(canonicalProgressAgeHours * 100) / 100}`);
  }
  if (
    (counts.packet_ready || 0) > 0 &&
    (counts.chief_ready || 0) === 0 &&
    canonicalProgressAgeHours !== null &&
    canonicalProgressAgeHours > 2
  ) {
    healthAlerts.push(
      `t0_frontier_stalled_over_2h_without_chief_ready:packet_ready=${counts.packet_ready}:canonical_age=${Math.round(canonicalProgressAgeHours * 100) / 100}`
    );
  }
  const ownerToRole = {
    "council-alpha": "council-alpha",
    "council-beta": "council-beta",
    "earth-scout": "earth-scout",
    "deep-resolver": "deep-resolver",
  };
  for (const [owner, backlog] of Object.entries(ownerBacklog)) {
    const role = ownerToRole[owner];
    if (!role || backlog <= 0) continue;
    const activity = roleActivity[role];
    const ages = [activity?.lastRunAgeHours, activity?.lastAgeHours].filter(Number.isFinite);
    const age = ages.length ? Math.min(...ages) : null;
    if (age === null || age > 2) healthAlerts.push(`owner_stale_with_backlog:${owner}:${backlog}`);
  }

  // A fresh receipt is not the same thing as useful work. Surface a recent run that
  // closed nothing while its lane still owns backlog, so Chief can intervene before
  // multiple hours are lost to a liveness-only loop.
  const latestRunByRole = {};
  for (const run of roleRuns || []) {
    const parsed = validActivityDate(run?.generatedAt, now);
    if (!parsed.date) continue;
    const role = run?.role;
    if (!role) continue;
    const prior = latestRunByRole[role];
    if (!prior || parsed.date > prior.date) latestRunByRole[role] = { run, date: parsed.date };
  }
  const closureCountForRun = (role, run) => {
    if (!run || typeof run !== "object") return null;
    if (role === "earth-scout" && Number.isFinite(run.evidencePairsCompleted)) return run.evidencePairsCompleted;
    if (role === "council-alpha" && Number.isFinite(run.scoreRecordsCompleted)) return run.scoreRecordsCompleted;
    if (role === "council-beta" && Number.isFinite(run.betaPairsCompleted)) return run.betaPairsCompleted;
    if (role === "deep-resolver" && Array.isArray(run.resolved)) return run.resolved.length;
    return null;
  };
  for (const [owner, backlog] of Object.entries(ownerBacklog)) {
    const role = ownerToRole[owner];
    if (!role || backlog <= 0) continue;
    const latest = latestRunByRole[role];
    if (!latest) continue;
    const runAgeHours = Math.max(0, (now.getTime() - latest.date.getTime()) / 3_600_000);
    const closures = closureCountForRun(role, latest.run);
    if (runAgeHours <= 2 && closures === 0) {
      healthAlerts.push(`owner_recent_run_zero_closure:${owner}:backlog=${backlog}`);
    }
  }

  return {
    version: 2,
    generatedAt: now.toISOString(),
    total,
    counts,
    oldestAgeHours,
    newestAgeHours,
    canonicalProgressAgeHours,
    attempts,
    preflightFailures,
    ownerBacklog,
    roleActivity,
    telemetry,
    healthAlerts,
    healthy: healthAlerts.length === 0,
    chiefReadyBackpressure: { count: counts.chief_ready || 0, targetRuns: 1, hardCeilingRuns: 2 }
  };
}

export async function writeWorkgraphArtifacts(root, graph, packets, metrics, routingQueues = null) {
  const runtimeDir = path.join(root, "data", "runtime", "workgraph");
  const packetDir = path.join(runtimeDir, "packets");
  const routingDir = path.join(runtimeDir, "routing");
  await mkdir(packetDir, { recursive: true });
  await mkdir(routingDir, { recursive: true });
  graph.generatedAt = metrics.generatedAt;
  await writeFile(path.join(runtimeDir, "state.json"), `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  await writeFile(path.join(runtimeDir, "metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  for (const packet of packets) await writeFile(path.join(packetDir, `${packet.ticker}.json`), `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  const queues = routingQueues || buildRoutingQueues(graph, packets, metrics.generatedAt);
  for (const [role, queue] of Object.entries(queues)) {
    await writeFile(path.join(routingDir, `${role}.json`), `${JSON.stringify(queue, null, 2)}\n`, "utf8");
  }
}
