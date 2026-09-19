import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditScoreRecord } from "../engine/beast-integrity.mjs";
import { isPublishableScoreRecord, rankRecords, METHODOLOGY_VERSION, MIN_PUBLISHABLE_DATA_CONFIDENCE } from "./lib/runtime-gates.mjs";
import { computeWorkgraphMetrics, loadRoleRuns, loadStructuredEvidence, writeWorkgraphArtifacts } from "./lib/workgraph-v2.mjs";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const RUNTIME = path.join(DATA, "runtime");
const WG = path.join(RUNTIME, "workgraph");
const PACKETS = path.join(WG, "packets");
const BASELINE = path.join(DATA, "baseline-evidence");
const METHODOLOGY = METHODOLOGY_VERSION;
const MIN_CONFIDENCE = MIN_PUBLISHABLE_DATA_CONFIDENCE;
const MANIFEST = path.join(DATA, "baselines", "earth2036-official-t0-2026-09-12", "manifest.json");

async function readJson(file, fallback = null) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
}
async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function time(row) { return Date.parse(row?.generatedAt || 0) || 0; }

export function normalizeEvidenceLeaf(node) {
  if (!node || typeof node !== "object") return null;
  const value = Number.isFinite(node.value) ? node.value : Number.isFinite(node.numericAssessment) ? node.numericAssessment : null;
  const sourceIds = Array.isArray(node.sourceIds) ? node.sourceIds.filter(Boolean) : [];
  const note = String(node.note || node.basis || "").trim();
  if (!Number.isFinite(value) || sourceIds.length === 0 || !note) return null;
  return { value, sourceIds, note };
}

export function normalizeEvidenceTree(node, prefix = "item") {
  if (!node || typeof node !== "object") return {};
  const direct = normalizeEvidenceLeaf(node);
  if (direct) return { [prefix]: direct };
  const out = {};
  const entries = Array.isArray(node) ? node.map((value, index) => [`${prefix}${index + 1}`, value]) : Object.entries(node);
  for (const [key, value] of entries) {
    const leaf = normalizeEvidenceLeaf(value);
    if (leaf) out[key] = leaf;
    else {
      const nested = normalizeEvidenceTree(value, key);
      if (Object.keys(nested).length) out[key] = nested;
    }
  }
  return out;
}

function sourceIds(row) {
  return [...new Set((row?.sources || []).map((s) => s?.sourceId || s?.originFingerprint || s?.url).filter(Boolean))];
}

function slug(value) {
  return String(value || "structural-demand").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "structural-demand";
}

export function materializeCausalProof(graph, ticker, company, structuralRow, scoreRecord) {
  const next = JSON.parse(JSON.stringify(graph || { version: 1, nodes: [], edges: [], structuralSignals: [] }));
  next.nodes ||= [];
  next.edges ||= [];
  next.structuralSignals ||= [];

  const ids = sourceIds(structuralRow);
  if (!ids.length || !(structuralRow?.causalEdges || []).length || !Number.isFinite(structuralRow?.confidence)) {
    return { graph: next, passed: false, reason: "missing_sourced_structural_causal_proof" };
  }

  const companyId = `company:${ticker}`;
  if (!next.nodes.some((n) => n.id === companyId)) {
    next.nodes.push({
      id: companyId,
      type: "company",
      label: company || ticker,
      description: String(structuralRow?.claims?.[0]?.claim || `${company || ticker} structural-causal evidence`),
    });
  }

  const firstEdge = structuralRow.causalEdges[0];
  const targetLabel = String(firstEdge?.to || `${ticker} structural demand`);
  const targetId = `market:${ticker}-${slug(targetLabel)}`;
  if (!next.nodes.some((n) => n.id === targetId)) {
    next.nodes.push({
      id: targetId,
      type: "market",
      label: targetLabel,
      description: String(firstEdge?.mechanism || structuralRow?.claims?.[0]?.claim || "Structural demand channel"),
    });
  }

  const edgeId = `edge:${ticker}-structural-exposure`;
  const strength = Math.max(1, Math.min(100, Number(scoreRecord?.components?.bottleneckControl ?? 70)));
  const confidence = Math.max(1, Math.min(100, Number(structuralRow.confidence)));
  const edge = {
    id: edgeId,
    from: companyId,
    to: targetId,
    relationship: "structural_exposure",
    direction: 1,
    strength,
    confidence,
    evidenceTier: "Iron",
    sourceIds: ids,
    observedAt: structuralRow.generatedAt,
  };
  next.edges = [...next.edges.filter((e) => e.id !== edgeId), edge];

  const signalId = `signal:${ticker}-structural-causal`;
  const signal = {
    id: signalId,
    kind: "structural_causal",
    subjectNodeId: targetId,
    affectedNodeIds: [companyId],
    direction: 1,
    magnitude: strength,
    confidence,
    timeHorizon: "1-5y",
    sourceIds: ids,
    observedAt: structuralRow.generatedAt,
    thesis: String(structuralRow?.claims?.[0]?.claim || `${company || ticker} has a sourced structural demand path.`),
    falsifier: String(firstEdge?.falsifier || "The cited structural demand path fails to translate into durable company-level economic exposure."),
  };
  next.structuralSignals = [...next.structuralSignals.filter((s) => s.id !== signalId), signal];

  return { graph: next, passed: true, reason: null };
}

function buildCanonicalRecord(packet, underwriting) {
  const score = packet.scoreRecord;
  const factorEvidence = normalizeEvidenceTree(underwriting?.factorEvidence ?? underwriting?.scoreRecord?.factorEvidence, "factor");
  const riskEvidence = normalizeEvidenceTree(underwriting?.riskEvidence ?? underwriting?.scoreRecord?.riskEvidence, "risk");
  const dataConfidenceEvidence = normalizeEvidenceTree(underwriting?.dataConfidenceEvidence ?? underwriting?.scoreRecord?.dataConfidenceEvidence, "confidence");
  return {
    ...score,
    ticker: packet.ticker,
    company: score.company || packet.identityTradability?.company || packet.ticker,
    methodologyVersion: METHODOLOGY,
    updatedAt: underwriting?.generatedAt || packet.generatedAt,
    components: score.components,
    factorEvidence,
    riskEvidence,
    dataConfidenceEvidence,
    primarySourceUrls: score.primarySourceUrls,
    independentSourceUrls: Array.isArray(score.independentSourceUrls) ? score.independentSourceUrls : [],
    causalMapped: true,
    evidenceTier: "Iron",
    canonicalLineage: {
      workId: packet.workId,
      packetGeneratedAt: packet.generatedAt,
      evidencePaths: packet.evidencePaths,
      fastPathPolicy: "chief-ready-zero-defect-v1",
    },
  };
}

async function loadPackets() {
  const names = await readdir(PACKETS);
  const rows = [];
  for (const name of names.filter((n) => n.endsWith(".json"))) {
    const packet = await readJson(path.join(PACKETS, name), null);
    if (packet) rows.push(packet);
  }
  return rows;
}

const [graphState, scoreState, ranking, workgraph, evidence, roleRuns, packets] = await Promise.all([
  readJson(path.join(RUNTIME, "causal-graph.json"), { version: 1, nodes: [], edges: [], structuralSignals: [] }),
  readJson(path.join(RUNTIME, "score-state.json"), { version: 1, methodologyVersion: METHODOLOGY, candidates: {} }),
  readJson(path.join(RUNTIME, "current-ranking.json"), { version: 1, methodologyVersion: METHODOLOGY, rankings: [] }),
  readJson(path.join(WG, "state.json"), null),
  loadStructuredEvidence(ROOT),
  loadRoleRuns(ROOT),
  loadPackets(),
]);

if (!workgraph?.companies) {
  console.error("Chief fast path: missing Workgraph state.");
  process.exit(1);
}

let prospectiveGraph = graphState;
const promoted = [];
const skipped = [];

for (const packet of packets.filter((p) => p?.preflight?.passed === true && workgraph.companies?.[p.ticker]?.state === "chief_ready")) {
  const relevant = evidence.filter((e) => e.ticker === packet.ticker);
  const underwriting = relevant
    .filter((e) => e.perspective === "company-underwriting" && e.scoreRecord)
    .sort((a, b) => time(b) - time(a))[0];
  const structural = relevant
    .filter((e) => e.perspective === "structural-causal")
    .sort((a, b) => time(b) - time(a))[0];

  if (!underwriting || !structural || !packet.scoreReadiness?.complete || !isPublishableScoreRecord(packet.scoreRecord, METHODOLOGY, MIN_CONFIDENCE)) {
    skipped.push({ ticker: packet.ticker, reason: "incomplete_fast_path_inputs" });
    continue;
  }

  const record = buildCanonicalRecord(packet, underwriting);
  const causal = materializeCausalProof(prospectiveGraph, packet.ticker, record.company, structural, record);
  if (!causal.passed) {
    skipped.push({ ticker: packet.ticker, reason: causal.reason });
    continue;
  }

  const audit = auditScoreRecord(record, causal.graph);
  if (!audit.passed) {
    skipped.push({ ticker: packet.ticker, reason: "beast_score_audit_failed", audit });
    continue;
  }

  await writeJson(path.join(BASELINE, `${packet.ticker}.json`), record);
  prospectiveGraph = causal.graph;
  scoreState.candidates[packet.ticker] = record;

  const row = workgraph.companies[packet.ticker];
  row.state = "canonical";
  row.sourceState = "promoted";
  row.evidencePath = `data/baseline-evidence/${packet.ticker}.json`;
  row.blocker = null;
  row.preflight = packet.preflight;
  row.lastTransitionAt = new Date().toISOString();
  row.updatedAt = row.lastTransitionAt;

  promoted.push({ ticker: packet.ticker, earthScore: record.earthScore, risk: record.risk, dataConfidence: record.dataConfidence, audit });
}

if (promoted.length) {
  scoreState.updatedAt = new Date().toISOString();
  prospectiveGraph.updatedAt = new Date().toISOString();
  await writeJson(path.join(RUNTIME, "causal-graph.json"), prospectiveGraph);
  await writeJson(path.join(RUNTIME, "score-state.json"), scoreState);

  const ranked = rankRecords(Object.entries(scoreState.candidates || {})
    .map(([ticker, record]) => ({ ticker, ...record }))
    .filter((record) => isPublishableScoreRecord(record, METHODOLOGY, MIN_CONFIDENCE)));
  await writeJson(path.join(RUNTIME, "current-ranking.json"), {
    ...ranking,
    version: 1,
    methodologyVersion: METHODOLOGY,
    capturedAt: new Date().toISOString(),
    publishableCompanies: ranked.length,
    rankings: ranked,
  });

  const systemState = await readJson(path.join(RUNTIME, "system-state.json"), {});
  await writeJson(path.join(RUNTIME, "system-state.json"), {
    ...systemState,
    scoredCompanies: ranked.length,
    publishableCompanies: ranked.length,
    fastPathCanonicalAt: new Date().toISOString(),
  });

  const manifest = await readJson(MANIFEST, null);
  if (manifest) {
    await writeJson(MANIFEST, {
      ...manifest,
      scoredCompanies: ranked.length,
      publishableCompanies: ranked.length,
      fastPathCanonicalAt: new Date().toISOString(),
    });
  }

  const metrics = computeWorkgraphMetrics(workgraph, new Date(), evidence, roleRuns);
  await writeWorkgraphArtifacts(ROOT, workgraph, packets.filter((p) => workgraph.companies?.[p.ticker]?.state !== "canonical"), metrics);
}

const report = {
  version: 1,
  policy: "chief-ready-zero-defect-v1",
  generatedAt: new Date().toISOString(),
  promoted,
  skipped,
};
await writeJson(path.join(WG, "fast-path-report.json"), report);
console.log(JSON.stringify(report, null, 2));
