const STATE_VALUE = Object.freeze({
  observed: 20,
  triaged: 28,
  researching: 45,
  evidence_complete: 68,
  packet_ready: 88,
  chief_ready: 100,
  canonical: 0,
  blocked: 0,
});

function clamp100(value) {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

export function attentionPriority(row, packet, assistBus) {
  const failures = packet?.preflight?.failures || [];
  const state = row?.state || packet?.sourceState || "observed";
  const base = STATE_VALUE[state] ?? 20;
  const failurePenalty = Math.min(24, failures.length * 2);
  const evidenceReuse = Math.min(10, Number(packet?.sourceLineage?.uniqueSourceCount || 0));
  const perspectiveCoverage = packet?.specialistCoverage?.required?.length
    ? 10 * ((packet.specialistCoverage.present?.length || 0) / packet.specialistCoverage.required.length)
    : 0;
  const attempts = Number(row?.attempts || 0);
  const retryPenalty = attempts >= 4 ? 8 : attempts >= 3 ? 4 : 0;
  const activeAssist = (assistBus?.requests || []).some((request) => request.ticker === packet?.ticker && request.status === "active") ? 5 : 0;
  const contradictionBonus = failures.includes("unresolved_material_contradiction") ? 4 : 0;

  const priority = clamp100(base - failurePenalty + evidenceReuse + perspectiveCoverage - retryPenalty + activeAssist + contradictionBonus);
  return {
    ticker: packet?.ticker || row?.ticker || null,
    state,
    priority,
    components: {
      stateValue: base,
      failurePenalty: -failurePenalty,
      evidenceReuse,
      perspectiveCoverage: Math.round(perspectiveCoverage * 10) / 10,
      retryPenalty: -retryPenalty,
      activeAssist,
      contradictionBonus,
    },
    failures,
    principle: "Operational attention value only; never a company-quality or investment score.",
  };
}

export function deriveCapacityPlan(metrics) {
  const stalled = (metrics?.counts?.packet_ready || 0) > 0 &&
    (metrics?.counts?.chief_ready || 0) === 0 &&
    Number(metrics?.canonicalProgressAgeHours || 0) > 2;

  if (stalled) {
    return {
      mode: "frontier-stall",
      closure: 0.70,
      expansion: 0.20,
      futureLearning: 0.10,
      rule: "Increase closure effort while preserving a non-zero exploration/future floor so difficult frontier items cannot starve the universe.",
    };
  }
  return {
    mode: "balanced",
    closure: 0.60,
    expansion: 0.25,
    futureLearning: 0.15,
    rule: "Maintain mobility and breadth while no critical frontier stall exists.",
  };
}

export function buildValueAllocationShadow(graph, packets, assistBus, metrics, generatedAt = new Date().toISOString()) {
  const ranked = (packets || [])
    .map((packet) => attentionPriority(graph?.companies?.[packet.ticker] || null, packet, assistBus))
    .sort((a,b) => b.priority - a.priority || String(a.ticker).localeCompare(String(b.ticker)));

  return {
    version: 1,
    contract: "earth2036-value-allocation-shadow-v1",
    generatedAt,
    canonicalWriteAuthority: false,
    capacityPlan: deriveCapacityPlan(metrics),
    attentionQueue: ranked,
    top: ranked.slice(0, 25),
    doctrine: {
      optimizationTarget: "decision value per unit of scarce intelligent attention",
      neverOptimizeFor: ["favorability","issuer preference","paying status","publicity"],
    },
  };
}
