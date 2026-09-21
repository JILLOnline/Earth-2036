import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { assessEvidenceBundle, sourceHealthScore, CONTROL_DOMAIN } from './evidence-fusion.mjs';

const require = createRequire(import.meta.url);
const METHODOLOGY = require("../config/methodology-1.0.json");
const SCORE_CONTRACT_VERSION = "earth-score-contract-v1";
const SCORE_FORMULA_HASH = createHash("sha256").update(JSON.stringify({
  methodologyVersion: METHODOLOGY.version,
  scoreWeights: METHODOLOGY.scoreWeights,
  riskPenaltyWeight: METHODOLOGY.riskPenaltyWeight,
  confidenceFloorMultiplier: METHODOLOGY.confidenceFloorMultiplier,
})).digest("hex");

function clamp100(value) {
  if (!Number.isFinite(Number(value))) return null;
  return Math.max(0, Math.min(100, Number(value)));
}
function round1(value) {
  return Math.round(value * 10) / 10;
}

export function auditScoreMath(record, tolerance = 0.051) {
  const reasons = [];
  if (record?.methodologyVersion !== METHODOLOGY.version) reasons.push("score_methodology_mismatch");
  const missing = METHODOLOGY.requiredScoreComponents.filter((key) => clamp100(record?.components?.[key]) === null);
  if (missing.length) reasons.push(...missing.map((key) => `score_missing_component:${key}`));
  const risk = clamp100(record?.risk);
  const dataConfidence = clamp100(record?.dataConfidence);
  if (risk === null) reasons.push("score_missing_risk");
  if (dataConfidence === null) reasons.push("score_missing_data_confidence");

  let expectedEarthScore = null;
  let rawWeightedScore = null;
  let confidenceMultiplier = null;
  let riskPenalty = null;
  if (reasons.length === 0) {
    rawWeightedScore = METHODOLOGY.requiredScoreComponents.reduce(
      (sum, key) => sum + clamp100(record.components[key]) * Number(METHODOLOGY.scoreWeights[key] || 0),
      0,
    );
    confidenceMultiplier =
      METHODOLOGY.confidenceFloorMultiplier +
      (1 - METHODOLOGY.confidenceFloorMultiplier) * (dataConfidence / 100);
    riskPenalty = risk * METHODOLOGY.riskPenaltyWeight;
    expectedEarthScore = round1(Math.max(0, Math.min(100, rawWeightedScore * confidenceMultiplier - riskPenalty)));
  }

  const storedEarthScore = Number(record?.earthScore);
  const delta = expectedEarthScore !== null && Number.isFinite(storedEarthScore)
    ? storedEarthScore - expectedEarthScore
    : null;
  if (!Number.isFinite(storedEarthScore)) reasons.push("score_missing_earth_score");
  else if (expectedEarthScore !== null && Math.abs(delta) > tolerance) reasons.push("score_math_mismatch");
  if (record?.scoreContract?.version !== SCORE_CONTRACT_VERSION) reasons.push("score_contract_version_mismatch");
  if (record?.scoreContract?.formulaHash !== SCORE_FORMULA_HASH) reasons.push("score_formula_hash_mismatch");

  return {
    passed: reasons.length === 0,
    reasons: [...new Set(reasons)],
    contractVersion: SCORE_CONTRACT_VERSION,
    formulaHash: SCORE_FORMULA_HASH,
    storedEarthScore: Number.isFinite(storedEarthScore) ? storedEarthScore : null,
    expectedEarthScore,
    delta: delta === null ? null : Math.round(delta * 1000) / 1000,
    rawWeightedScore: rawWeightedScore === null ? null : round1(rawWeightedScore),
    confidenceMultiplier: confidenceMultiplier === null ? null : Math.round(confidenceMultiplier * 1000) / 1000,
    riskPenalty: riskPenalty === null ? null : round1(riskPenalty),
  };
}

const isFiniteNumber = (value) => Number.isFinite(Number(value));

function hostname(value) {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return 'unknown'; }
}

function evidenceLeaves(record) {
  const roots = [record.factorEvidence, record.riskEvidence, record.dataConfidenceEvidence].filter(Boolean);
  const leaves = [];
  const walk = (node, path = []) => {
    if (!node || typeof node !== 'object') return;
    if ('value' in node || 'sourceIds' in node || 'note' in node) {
      leaves.push({ path: path.join('.'), value: node.value, sourceIds: node.sourceIds, note: node.note });
      return;
    }
    for (const [key, value] of Object.entries(node)) walk(value, [...path, key]);
  };
  roots.forEach((root) => walk(root));
  return leaves;
}

function urlEvidence(record, now) {
  const primary = (record.primarySourceUrls || []).map((url) => ({
    ticker: record.ticker,
    category: 'provenance',
    eventType: 'source',
    observedAt: record.updatedAt || now.toISOString(),
    maxAgeHours: 24 * 400,
    magnitude: 1,
    confidence: 1,
    reliability: 1,
    direction: 0,
    authority: 'primary',
    controlDomain: CONTROL_DOMAIN.PUBLIC_PRIMARY,
    providerId: hostname(url),
    originId: url,
    primarySourceUrl: url,
    sourceFamily: 'primary-source',
  }));
  const independent = (record.independentSourceUrls || []).map((url) => ({
    ticker: record.ticker,
    category: 'provenance',
    eventType: 'corroboration',
    observedAt: record.updatedAt || now.toISOString(),
    maxAgeHours: 24 * 400,
    magnitude: .75,
    confidence: .85,
    reliability: .8,
    direction: 0,
    authority: 'independent-secondary',
    controlDomain: CONTROL_DOMAIN.EXTERNAL_VENDOR,
    providerId: hostname(url),
    originId: url,
    primarySourceUrl: url,
    sourceFamily: 'independent-corroboration',
  }));
  return [...primary, ...independent];
}

export function auditScoreRecord(record, graph, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const ticker = String(record?.ticker || options.ticker || '').toUpperCase();
  const reasons = [];
  if (!ticker) reasons.push('missing_ticker');
  if (!Array.isArray(record?.primarySourceUrls) || record.primarySourceUrls.length === 0) reasons.push('missing_primary_sources');
  const scoreMath = auditScoreMath(record || {});
  if (!scoreMath.passed) reasons.push(...scoreMath.reasons);

  const leaves = evidenceLeaves(record || {});
  const invalidLeaves = leaves.filter((leaf) => !isFiniteNumber(leaf.value) || !Array.isArray(leaf.sourceIds) || leaf.sourceIds.length === 0 || !String(leaf.note || '').trim());
  if (!leaves.length) reasons.push('missing_factor_evidence');
  if (invalidLeaves.length) reasons.push('incomplete_factor_provenance');

  const nodeId = `company:${ticker}`;
  const nodeExists = (graph?.nodes || []).some((node) => node.id === nodeId);
  const companyEdges = (graph?.edges || []).filter((edge) => edge.from === nodeId || edge.to === nodeId);
  const invalidEdges = companyEdges.filter((edge) => !Array.isArray(edge.sourceIds) || edge.sourceIds.length === 0 || !isFiniteNumber(edge.strength) || !isFiniteNumber(edge.confidence));
  if (record?.causalMapped === true && (!nodeExists || companyEdges.length === 0)) reasons.push('causal_flag_without_graph_proof');
  if (record?.causalMapped !== true) reasons.push('causal_mapping_not_declared');
  if (invalidEdges.length) reasons.push('causal_edges_without_provenance');

  const sourceRows = urlEvidence({ ...record, ticker }, now);
  const tier = String(record?.evidenceTier || 'Wood').toLowerCase();
  const minOriginsByTier = { wood: 1, hay: 1, iron: 2, gold: 3, diamond: 4 };
  const minOrigins = minOriginsByTier[tier] ?? 1;
  const sovereignty = assessEvidenceBundle(sourceRows, { now, minIndependentOrigins: minOrigins, maxContradictionRatio: 1 });
  const independentCount = Array.isArray(record?.independentSourceUrls) ? record.independentSourceUrls.length : 0;
  if ((tier === 'gold' || tier === 'diamond') && independentCount === 0) reasons.push('high_tier_without_independent_corroboration');
  const structuralSignals = (graph?.structuralSignals || []).filter((signal) => signal.subjectNodeId === nodeId || (signal.affectedNodeIds || []).includes(nodeId));
  const invalidSignals = structuralSignals.filter((signal) => !Array.isArray(signal.sourceIds) || signal.sourceIds.length === 0 || !String(signal.falsifier || '').trim());
  if ((tier === 'gold' || tier === 'diamond') && structuralSignals.length === 0) reasons.push('high_tier_without_structural_signal');
  if (invalidSignals.length) reasons.push('structural_signal_without_source_or_falsifier');
  if (!sovereignty.passed) reasons.push(...sovereignty.reasons.map((reason) => `sovereignty:${reason}`));

  return {
    ticker,
    passed: reasons.length === 0,
    reasons: [...new Set(reasons)],
    evidenceLeaves: leaves.length,
    invalidEvidenceLeaves: invalidLeaves.length,
    causalNodePresent: nodeExists,
    causalEdges: companyEdges.length,
    invalidCausalEdges: invalidEdges.length,
    sovereignShare: sovereignty.sovereignShare,
    maxExternalProviderShare: sovereignty.maxExternalProviderShare,
    independentOrigins: sovereignty.independentOrigins,
    structuralSignals: structuralSignals.length,
    invalidStructuralSignals: invalidSignals.length,
    scoreMathPassed: scoreMath.passed,
    scoreMath,
  };
}

export function auditSourceMesh(sourceHealth, automatedSourceHealth, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const reasons = [];
  const machine = (sourceHealth?.sources || []).map((source) => ({
    id: source.id,
    required: source.requiredForTick === true,
    status: source.status,
    ...sourceHealthScore({
      ...source,
      freshnessSlaHours: source.cadence === 'hourly' ? 2 : source.cadence === 'daily' ? 36 : 24 * 8,
      historicalReliability: source.historicalReliability ?? (source.authority === 'primary' ? .98 : .85),
      disagreementRate: source.disagreementRate ?? 0,
    }, now),
  }));
  const requiredMachine = machine.filter((row) => row.required);
  const badMachine = requiredMachine.filter((row) => row.status === 'failed' || row.coverage < .9 || row.freshness <= 0);
  if (badMachine.length) reasons.push('required_machine_source_unhealthy_or_stale');

  const automatedSources = automatedSourceHealth?.sources || [];
  const requiredAutomated = automatedSources.filter((source) => source.requiredForCoverage === true);
  const badAutomated = requiredAutomated.filter((source) => source.status !== 'healthy');
  if (automatedSourceHealth && badAutomated.length) reasons.push('required_automated_source_failed');

  return {
    passed: reasons.length === 0,
    reasons,
    machine,
    requiredMachineSources: requiredMachine.length,
    unhealthyMachineSources: badMachine.map((row) => row.id),
    automatedCoverageRatio: automatedSourceHealth?.coverageRatio ?? null,
    unhealthyAutomatedSources: badAutomated.map((row) => row.id),
  };
}

export function auditSystem({ scoreState, graph, sourceHealth, automatedSourceHealth, evidenceQueue }, options = {}) {
  const records = Object.entries(scoreState?.candidates || {}).map(([ticker, record]) => ({ ticker, ...record }));
  const scores = records.map((record) => auditScoreRecord(record, graph, { ...options, ticker: record.ticker }));
  const sourceMesh = auditSourceMesh(sourceHealth || {}, automatedSourceHealth || null, options);
  const unresolved = Number(evidenceQueue?.unresolved || 0);
  const reasons = [];
  if (scores.some((row) => !row.passed)) reasons.push('score_provenance_failure');
  if (scores.some((row) => !row.scoreMathPassed)) reasons.push('score_math_failure');
  if (!sourceMesh.passed) reasons.push('source_mesh_failure');
  return {
    version: 1,
    checkedAt: options.now ? new Date(options.now).toISOString() : new Date().toISOString(),
    policy: { earthControlFloor: .51, externalProviderCap: .49, duplicateOriginsCountOnce: true, correctionsAreAppendOnly: true },
    passed: reasons.length === 0,
    reasons,
    scoreRecordsAudited: scores.length,
    scoreRecordsPassed: scores.filter((row) => row.passed).length,
    mathematicalIntegrity: {
      passed: scores.every((row) => row.scoreMathPassed),
      audited: scores.length,
      passedRecords: scores.filter((row) => row.scoreMathPassed).length,
      contractVersion: SCORE_CONTRACT_VERSION,
      formulaHash: SCORE_FORMULA_HASH,
      maxAbsoluteDelta: Math.max(0, ...scores.map((row) => Math.abs(Number(row?.scoreMath?.delta || 0)))),
      mismatches: scores
        .filter((row) => !row.scoreMathPassed)
        .map((row) => ({
          ticker: row.ticker,
          storedEarthScore: row.scoreMath?.storedEarthScore ?? null,
          expectedEarthScore: row.scoreMath?.expectedEarthScore ?? null,
          delta: row.scoreMath?.delta ?? null,
          reasons: row.scoreMath?.reasons || [],
        })),
    },
    unresolvedEvidence: unresolved,
    scores,
    sourceMesh,
  };
}
