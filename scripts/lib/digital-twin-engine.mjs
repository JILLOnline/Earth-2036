import { createHash } from "node:crypto";

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}

function textOf(value, keys) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  for (const key of keys) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  return null;
}

function collectText(items, keys) {
  return [...new Set((items || []).map((item) => textOf(item, keys)).filter(Boolean))];
}

function improvementQuestion(failure) {
  const map = {
    missing_primary_source: "Which primary source would materially improve the factual basis?",
    missing_source_lineage: "Which material claim still lacks traceable origin lineage?",
    missing_factor_evidence: "Which required methodology factor still lacks source-addressed evidence?",
    missing_numeric_score_record: "Which source-addressed factor assessments are still required before a reproducible score can be constructed?",
    missing_score_risk_evidence: "Which material risks require source-addressed quantitative treatment?",
    missing_data_confidence_evidence: "Which evidence-quality dimensions remain insufficiently supported?",
    missing_causal_mapping: "Which causal mechanism still requires evidence, a falsifier, or a clearer connection to company economics?",
    unresolved_material_contradiction: "Which material contradiction must be reconciled before the representation can advance?",
    unresolved_gating_issue: "Which explicit gating issue remains unresolved after root-owner work?",
    unresolved_gating_unknown: "Which unknown is genuinely decision-blocking rather than simply uncertain?",
  };
  return map[failure] || `What evidence or interpretation would lawfully resolve ${failure}?`;
}

export function buildCompanyDigitalTwin(packet, row) {
  const failures = packet?.preflight?.failures || [];
  const factorNames = [...new Set((packet?.factorEvidence?.names || []).map((x) => typeof x === "string" ? x : x?.name).filter(Boolean))];
  const riskSignals = collectText(packet?.risks, ["risk","issue","claim","note"]);
  const unknownSignals = collectText(packet?.unknowns, ["unknown","issue","question","note"]);
  const contradictionSignals = collectText(packet?.contradictions, ["contradiction","issue","claim","note"]);
  const gatingSignals = collectText(packet?.gatingIssues, ["gate","question","defect","issue","note"]);
  const causalEdges = Array.isArray(packet?.causalEdges) ? packet.causalEdges : [];

  const inputSignature = hash({
    ticker: packet?.ticker,
    state: row?.state,
    evidencePaths: packet?.evidencePaths || [],
    failures,
    factors: factorNames,
    risks: riskSignals,
    unknowns: unknownSignals,
    contradictions: contradictionSignals,
    causalEdges,
  });

  return {
    version: 1,
    contract: "earth2036-company-digital-twin-shadow-v1",
    canonicalWriteAuthority: false,
    ticker: packet?.ticker || row?.ticker || null,
    workId: packet?.workId || row?.workId || null,
    inputSignature,
    sourceState: row?.state || packet?.sourceState || null,
    identity: packet?.identityTradability || { ticker: packet?.ticker || row?.ticker || null },
    representationQuality: {
      requiredPerspectives: packet?.specialistCoverage?.required || [],
      presentPerspectives: packet?.specialistCoverage?.present || [],
      missingPerspectives: packet?.specialistCoverage?.missing || [],
      primarySourceCount: Number(packet?.primarySourcePresence?.count || 0),
      sourceLineage: packet?.sourceLineage || null,
      evidenceWindow: packet?.evidenceWindow || null,
      preflightPassed: packet?.preflight?.passed === true,
    },
    capabilitySignals: factorNames,
    constraintSignals: {
      risks: riskSignals,
      unknowns: unknownSignals,
      contradictions: contradictionSignals,
      gatingIssues: gatingSignals,
      preflightFailures: failures,
    },
    causalContext: {
      mapped: packet?.causalMapping?.present === true,
      edges: causalEdges,
    },
    improvementWindows: failures.map((failure) => ({
      failure,
      question: improvementQuestion(failure),
      stance: "improvement-oriented",
    })),
    bridgeInputs: {
      capabilityCandidates: factorNames,
      needOrConstraintCandidates: [...new Set([...unknownSignals, ...riskSignals, ...gatingSignals])],
      note: "Candidates only. A Strategic Bridge requires separate evidence, mechanism, tradeoff and falsifier analysis before recommendation.",
    },
    doctrine: {
      recommendationStyle: "facts + interpretation + options; never coercion",
      representationIsNotRanking: true,
      uncertaintyVisible: true,
    },
  };
}

export function buildDigitalTwinShadow(graph, packets, generatedAt = new Date().toISOString()) {
  const twins = (packets || []).map((packet) => buildCompanyDigitalTwin(packet, graph?.companies?.[packet.ticker] || null));
  return {
    version: 1,
    contract: "earth2036-digital-twin-shadow-index-v1",
    generatedAt,
    canonicalWriteAuthority: false,
    total: twins.length,
    twins,
  };
}
