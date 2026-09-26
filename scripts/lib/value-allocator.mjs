import { createHash } from "node:crypto";

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

const PRIME_STALL_STATUSES = new Set([
  "repeated_unchanged_input",
  "awaiting_external_change",
]);

function clamp100(value) {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20);
}

function validDate(value) {
  const d = new Date(value || 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function latestCompanyAttempt(roleRuns, ticker) {
  let latest = null;
  for (const run of roleRuns || []) {
    const inspected = Array.isArray(run?.companiesInspected) && run.companiesInspected.includes(ticker);
    const assisted = (run?.assistAttempts || []).some((attempt) =>
      String(attempt?.requestId || "").startsWith("assist:" + ticker + ":")
    );
    if (!inspected && !assisted) continue;
    const date = validDate(run?.generatedAt);
    if (!date) continue;
    if (!latest || date > latest.date) latest = { run, date };
  }
  return latest;
}

function containsAwaitingExternal(run) {
  if (!run) return false;
  const text = JSON.stringify({
    blockers: run.blockers || [],
    result: run.result || null,
    repeatedBlocker: run.repeatedBlocker || run.learning?.repeatedBlocker || null,
    nextLawfulAction: run.learning?.nextLawfulAction || null,
  }).toLowerCase();
  return text.includes("awaiting external") ||
    text.includes("waiting on external") ||
    text.includes("await external");
}

function packetInputSignature(row, packet) {
  return stableHash({
    ticker: packet?.ticker || row?.ticker || null,
    state: row?.state || null,
    failures: [...(packet?.preflight?.failures || [])].sort(),
    evidencePaths: [...(packet?.evidencePaths || [])].sort(),
    gatingIssues: packet?.gatingIssues || [],
    gatingUnknowns: (packet?.unknowns || []).filter((item) => item?.gating === true),
    unresolvedContradictions: (packet?.contradictions || []).filter((item) =>
      item?.resolved !== true && item?.gating !== false && item?.material !== false
    ),
    scoreReadiness: packet?.scoreReadiness || null,
  });
}

function operationalStatusFor(row, packet, previous, roleRuns) {
  const failures = packet?.preflight?.failures || [];
  const inputSignature = packetInputSignature(row, packet);
  const latest = latestCompanyAttempt(roleRuns, packet?.ticker || row?.ticker);
  const latestAttemptAt = latest?.date?.toISOString() || null;
  const sameInput = previous?.inputSignature === inputSignature;
  const newAttemptOnSameInput =
    sameInput &&
    latestAttemptAt &&
    previous?.latestAttemptAt &&
    Date.parse(latestAttemptAt) > Date.parse(previous.latestAttemptAt);

  let unchangedAttempts = sameInput ? Number(previous?.unchangedAttempts || 0) : 0;
  if (newAttemptOnSameInput) unchangedAttempts += 1;
  if (!previous && latestAttemptAt) unchangedAttempts = 0;

  let status = "progressing";
  if (unchangedAttempts >= 2) {
    status = "repeated_unchanged_input";
  } else if (containsAwaitingExternal(latest?.run)) {
    status = "awaiting_external_change";
  } else if (failures.includes("unresolved_material_contradiction")) {
    status = "needs_contradiction_resolution";
  } else if (failures.some((failure) => [
    "missing_structured_evidence",
    "missing_primary_source",
    "missing_source_lineage",
    "missing_evidence_window",
  ].includes(failure))) {
    status = "needs_new_source";
  } else if (failures.some((failure) =>
    String(failure).startsWith("missing_specialist_perspective:") ||
    [
      "missing_factor_evidence",
      "missing_numeric_score_record",
      "missing_score_risk_evidence",
      "missing_data_confidence_evidence",
      "confidence_below_60",
    ].includes(failure)
  )) {
    status = "needs_underwriting";
  }

  return {
    status,
    inputSignature,
    unchangedAttempts,
    latestAttemptAt,
    primeEligible: !PRIME_STALL_STATUSES.has(status),
  };
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
  const activeAssist = (assistBus?.requests || []).some((request) =>
    request.ticker === packet?.ticker && request.status === "active"
  ) ? 5 : 0;
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

export function deriveCapacityPlan(metrics, phase = "t0-bootstrap", expectedTotal = null) {
  const canonical = Number(metrics?.counts?.canonical || 0);
  const target = Number(expectedTotal || metrics?.total || 250);
  if (phase === "t0-bootstrap" && canonical < target) {
    return {
      mode: "t0-closure-engine",
      closure: 0.80,
      expansion: 0.15,
      futureLearning: 0.05,
      revertsAtCanonical: target,
      rule: "During T0 bootstrap, spend 80% on lawful closure while preserving non-zero expansion and future-learning floors. Revert automatically at full T0.",
    };
  }
  return {
    mode: "balanced",
    closure: 0.60,
    expansion: 0.25,
    futureLearning: 0.15,
    rule: "Normal balanced doctrine after T0 is complete.",
  };
}

export function buildClosureFrontier(
  graph,
  packets,
  assistBus,
  metrics,
  roleRuns = [],
  previousFrontier = null,
  generatedAt = new Date().toISOString(),
  options = {}
) {
  const limit = Math.max(1, Number(options.limit || 10));
  const previousByTicker = Object.fromEntries(
    (previousFrontier?.candidates || []).filter((row) => row?.ticker).map((row) => [row.ticker, row])
  );
  const activeAssistsByTicker = {};
  for (const request of assistBus?.requests || []) {
    if (request?.status !== "active" || !request?.ticker) continue;
    activeAssistsByTicker[request.ticker] = (activeAssistsByTicker[request.ticker] || 0) + 1;
  }

  const candidates = [];
  for (const packet of packets || []) {
    const row = graph?.companies?.[packet?.ticker];
    if (!row || ["canonical", "blocked", "chief_ready"].includes(row.state)) continue;
    const failures = [...(packet?.preflight?.failures || [])];
    const owners = [...new Set((packet?.preflight?.routing || []).map((route) => route?.owner).filter(Boolean))];
    const operational = operationalStatusFor(row, packet, previousByTicker[packet.ticker], roleRuns);
    const attention = attentionPriority(row, packet, assistBus);
    const failureCloseness = Math.max(0, 24 - failures.length * 2);
    const ownerCloseness = Math.max(0, 12 - owners.length * 3);
    const sourceReuse = Math.min(12, Number(packet?.sourceLineage?.uniqueSourceCount || 0));
    const activeAssistBonus = Math.min(6, Number(activeAssistsByTicker[packet.ticker] || 0) * 2);
    const contradictionPenalty = failures.includes("unresolved_material_contradiction") ? 5 : 0;
    const unchangedPenalty = Math.min(20, operational.unchangedAttempts * 10);
    const progressAt =
      packet?.evidenceWindow?.latestEvidenceGeneratedAt ||
      row?.lastTransitionAt ||
      row?.updatedAt ||
      generatedAt;
    const progressDate = validDate(progressAt);
    const generatedDate = validDate(generatedAt) || new Date();
    const hoursSinceProgress = progressDate
      ? Math.max(0, (generatedDate.getTime() - progressDate.getTime()) / 3_600_000)
      : null;
    const ageBonus = hoursSinceProgress === null ? 0 : Math.min(8, hoursSinceProgress / 3);
    const closureScore = Math.round((
      attention.priority +
      failureCloseness +
      ownerCloseness +
      sourceReuse +
      activeAssistBonus +
      ageBonus -
      contradictionPenalty -
      unchangedPenalty
    ) * 10) / 10;

    candidates.push({
      ticker: packet.ticker,
      workId: packet.workId || row.workId || ("t0:" + packet.ticker),
      state: row.state,
      closureScore,
      attentionPriority: attention.priority,
      failures,
      remainingFailures: failures.length,
      owners: owners.sort(),
      remainingOwners: owners.length,
      sourceReuse,
      activeAssists: activeAssistsByTicker[packet.ticker] || 0,
      contradictionStatus: failures.includes("unresolved_material_contradiction") ? "material_unresolved" : "clear_or_non_gating",
      attempts: Number(row?.attempts || 0),
      hoursSinceProgress: hoursSinceProgress === null ? null : Math.round(hoursSinceProgress * 100) / 100,
      ...operational,
      selected: false,
      firstSelectedAt: previousByTicker[packet.ticker]?.firstSelectedAt || null,
    });
  }

  candidates.sort((a, b) => {
    if (a.primeEligible !== b.primeEligible) return a.primeEligible ? -1 : 1;
    if (b.closureScore !== a.closureScore) return b.closureScore - a.closureScore;
    if (a.remainingFailures !== b.remainingFailures) return a.remainingFailures - b.remainingFailures;
    if (a.remainingOwners !== b.remainingOwners) return a.remainingOwners - b.remainingOwners;
    return a.ticker.localeCompare(b.ticker);
  });

  const selectedTickers = new Set(candidates.filter((row) => row.primeEligible).slice(0, limit).map((row) => row.ticker));
  const finalCandidates = candidates.map((row) => {
    const selected = selectedTickers.has(row.ticker);
    const prior = previousByTicker[row.ticker];
    return {
      ...row,
      selected,
      firstSelectedAt: selected
        ? (prior?.selected === true && prior?.firstSelectedAt ? prior.firstSelectedAt : generatedAt)
        : null,
      executionGuard: row.primeEligible ? null : "do_not_retry_without_changed_input",
    };
  });
  const selected = finalCandidates.filter((row) => row.selected);
  const stalled = finalCandidates.filter((row) => !row.primeEligible);
  const generatedDate = validDate(generatedAt) || new Date();
  const frontierAges = selected
    .map((row) => validDate(row.firstSelectedAt))
    .filter(Boolean)
    .map((date) => Math.max(0, (generatedDate.getTime() - date.getTime()) / 3_600_000))
    .sort((a, b) => a - b);
  const medianFrontierAgeHours = frontierAges.length
    ? frontierAges[Math.floor(frontierAges.length / 2)]
    : 0;
  const changedSincePrior = selected.filter((row) => {
    const prior = previousByTicker[row.ticker];
    return Boolean(prior && prior.inputSignature !== row.inputSignature);
  }).length;

  return {
    version: 1,
    contract: "earth2036-closure-frontier-v1",
    generatedAt,
    canonicalWriteAuthority: false,
    authoritativeWorkgraphState: false,
    limit,
    backlogTotal: finalCandidates.length,
    selectedCount: selected.length,
    stalledCount: stalled.length,
    capacityPlan: deriveCapacityPlan(metrics, graph?.phase || "t0-bootstrap", metrics?.total || 250),
    throughput: {
      changedSincePriorReconcile: changedSincePrior,
      medianTimeInFrontierHours: Math.round(medianFrontierAgeHours * 100) / 100,
      stalledFrontierCompanies: stalled.length,
    },
    selectionPolicy: "deterministic-close-nearest-first-with-stall-deferral",
    selected,
    stalled,
    candidates: finalCandidates,
  };
}

export function buildValueAllocationShadow(graph, packets, assistBus, metrics, generatedAt = new Date().toISOString(), options = {}) {
  const ranked = (packets || [])
    .map((packet) => attentionPriority(graph?.companies?.[packet.ticker] || null, packet, assistBus))
    .sort((a,b) => b.priority - a.priority || String(a.ticker).localeCompare(String(b.ticker)));

  return {
    version: 2,
    contract: "earth2036-value-allocation-shadow-v2",
    generatedAt,
    canonicalWriteAuthority: false,
    capacityPlan: deriveCapacityPlan(metrics, graph?.phase || "t0-bootstrap", metrics?.total || 250),
    closureFrontier: options.closureFrontier || null,
    attentionQueue: ranked,
    top: ranked.slice(0, 25),
    doctrine: {
      optimizationTarget: "decision value per unit of scarce intelligent attention",
      neverOptimizeFor: ["favorability","issuer preference","paying status","publicity"],
    },
  };
}
