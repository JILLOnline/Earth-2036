import { createHash } from "node:crypto";

// PHOENIX P1: pure, read-only diagnostics. No canonical, scheduling, or task authority.
export const PHOENIX_CONTRACT = "earth2036-phoenix-flight-recorder-v1";
export const ROLES = Object.freeze(["earth-scout", "council-alpha", "council-beta", "deep-resolver", "chief-earth"]);

const integer = value => Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;
const iso = value => Number.isFinite(Date.parse(value || "")) ? new Date(value).toISOString() : null;
const fingerprint = (plane, code) =>
  createHash("sha256").update("phoenix-v1:" + plane + ":" + code).digest("hex").slice(0, 20);

function makeIncident(plane, code, severity, detail, nextAction) {
  return {
    id: fingerprint(plane, code), plane, code, severity,
    detail, nextAction,
    automaticRecoveryAuthorized: false,
    governance: "diagnostic_only",
  };
}

export function assessHourlySlots(reconciliation) {
  if (!Array.isArray(reconciliation?.rows)) {
    return { status: "unverified", slots: 0, persisted: 0, missing: 0,
      missingWithoutRun: 0, missingAsOfReceipt: 0, unknown: 0,
      reason: "retrospective_hourly_rows_unavailable" };
  }
  const seen = new Set();
  const counts = { slots: 0, persisted: 0, missing: 0, missingWithoutRun: 0,
    missingAsOfReceipt: 0, unknown: 0, runFailed: 0 };
  for (const row of reconciliation.rows) {
    if (!/^\d{8}T\d{2}00Z$/.test(row?.hourKey || "") || seen.has(row.hourKey)) {
      throw new Error("phoenix_invalid_or_duplicate_hourly_slot");
    }
    seen.add(row.hourKey);
    counts.slots += 1;
    const state = row.retrospectiveObservationStatus;
    if (state === "persisted_now") counts.persisted += 1;
    else if (state === "still_missing") counts.missing += 1;
    else counts.unknown += 1;
    if (state === "still_missing" &&
        row.missingObservationClassification === "scheduler_run_not_created_in_slot" &&
        row.schedulerLookup?.status === "available" &&
        Array.isArray(row.schedulerRuns) && row.schedulerRuns.length === 0) {
      counts.missingWithoutRun += 1;
    }
    if (!row.asOfReceiptSha256) counts.missingAsOfReceipt += 1;
    if (state === "still_missing" && (row.schedulerRuns || [])
      .some(x => x.conclusion === "failure" || x.conclusion === "timed_out")) {
      counts.runFailed += 1;
    }
  }
  return { status: counts.unknown ? "unverified" : counts.missing ? "degraded" : "healthy",
    ...counts, checkedAt: iso(reconciliation.checkedAt),
    authoritativeObservation: "committed_cycle_history_only" };
}

export function assessWorkforce(routing, assists, roster = null) {
  const assignments = ROLES.map(role => ({
    role,
    routed: integer(routing?.[role]?.total),
    sourceAssists: integer(assists?.[role]?.active),
    enabled: roster && typeof roster[role]?.enabled === "boolean" ? roster[role].enabled : null,
    clearance: roster?.[role]?.clearance || "unverified",
  }));
  const unavailableWithWork = assignments.filter(x =>
    x.enabled === false && (x.routed > 0 || x.sourceAssists > 0));
  const activeWork = assignments.filter(x => x.routed > 0 || x.sourceAssists > 0);
  const unverifiedWithWork = activeWork.filter(x => x.enabled === null);
  return {
    status: unavailableWithWork.length ? "blocked" : unverifiedWithWork.length ? "unverified" : "observed_only",
    assignments, unavailableWithWork: unavailableWithWork.map(x => x.role),
    unverifiedWithWork: unverifiedWithWork.map(x => x.role),
    enabledWorkers: assignments.filter(x => x.enabled === true).map(x => x.role),
    rosterEvidence: roster ? "operator_supplied_not_independently_authenticated" : "not_available_from_github",
    note: "Enabled does not establish accepted work or successful Git persistence.",
  };
}

export function assessPhoenix(inputs = {}) {
  const now = iso(inputs.now || new Date().toISOString());
  if (!now) throw new Error("phoenix_invalid_audit_time");
  const metrics = inputs.metrics || {};
  const system = inputs.system || {};
  const integrity = inputs.integrity || {};
  const hours = assessHourlySlots(inputs.reconciliation);
  const workforce = assessWorkforce(inputs.routing, inputs.assists, inputs.roster);
  const canonical = integer(metrics.counts?.canonical ?? system.workgraphCanonicalCompanies);
  const expected = integer(metrics.total ?? system.companiesExpected);
  const chiefReady = integer(metrics.counts?.chief_ready);
  const packetReady = integer(metrics.counts?.packet_ready);
  const progressAgeHours = Number.isFinite(metrics.canonicalProgressAgeHours)
    ? metrics.canonicalProgressAgeHours : null;
  const stalled = progressAgeHours !== null && progressAgeHours > 2 &&
    (packetReady > 0 || chiefReady > 0);
  const combinedCoverage = Number.isFinite(inputs.sourceHealth?.combinedCoverageRatio)
    ? inputs.sourceHealth.combinedCoverageRatio : null;
  const truthStatus = integrity.passed === true ? "passing_last_audit"
    : integrity.passed === false ? "blocked" : "unverified";
  const researchStatus = stalled ? "stalled"
    : expected && canonical === expected ? "baseline_complete" : "unverified_progress";
  const incidents = [];

  if (hours.missingWithoutRun) incidents.push(makeIncident("execution", "scheduler_nonarrival",
    "critical", String(hours.missingWithoutRun) + " completed hours had no original scheduler run.",
    "Verify GitHub delivery and recovery events; do not synthesize old observations."));
  if (hours.missing > hours.missingWithoutRun) incidents.push(makeIncident("execution",
    "unpersisted_observation_with_attempt_or_unknown", "critical",
    String(hours.missing - hours.missingWithoutRun) + " additional completed hours have no original observation.",
    "Inspect exact GitHub scheduler attempt and immutable cycle history."));
  if (hours.missingAsOfReceipt) incidents.push(makeIncident("execution", "missing_as_of_receipts",
    "warning", String(hours.missingAsOfReceipt) + " as-of audit receipts absent from reviewed window.",
    "Keep historical gaps visible; improve future auditing without rewriting old receipts."));
  if (hours.status === "unverified") incidents.push(makeIncident("execution", "hourly_evidence_unverified",
    "warning", "Hourly slot evidence is absent or contains unknown statuses.",
    "Restore authenticated retrospective inputs before claiming continuity."));
  if (workforce.unavailableWithWork.length) incidents.push(makeIncident("workforce",
    "disabled_owner_has_actionable_work", "critical",
    "Disabled owners with routed work: " + workforce.unavailableWithWork.join(", ") + ".",
    "Review task disable cause and safety hold before any selective recovery."));
  if (workforce.unverifiedWithWork.length) incidents.push(makeIncident("workforce",
    "worker_availability_unverified", "warning",
    "GitHub cannot verify executor status for: " + workforce.unverifiedWithWork.join(", ") + ".",
    "Read actual ChatGPT task states; never infer enablement from Git receipts."));
  if (stalled) incidents.push(makeIncident("research", "canonical_frontier_stalled",
    "critical", "No canonical transition for " + progressAgeHours.toFixed(1) + " hours while packets remain.",
    "Resolve the nearest lawful source/gate dependency; activity alone is not closure."));
  if (integrity.passed === false) incidents.push(makeIncident("truth", "integrity_gate_failed",
    "critical", "Latest persisted integrity audit failed.",
    "Keep all canonical promotion and publication blocked; inspect source/score evidence."));
  if (truthStatus === "unverified") incidents.push(makeIncident("truth", "integrity_unverified",
    "warning", "No verifiable integrity verdict provided to Phoenix.",
    "Obtain persisted intelligence-integrity audit before any readiness claim."));

  const summarized = {
    version: 1, contract: PHOENIX_CONTRACT, checkedAt: now,
    mode: "read_only_pilot",
    authority: { canonicalWrites: false, workerRestart: false, schedulerDispatch: false,
      tickQualification: false, approvalWrites: false, historicalBackfill: false },
    planes: {
      execution: hours,
      workforce,
      research: { status: researchStatus, canonical, expected, remaining: Math.max(0, expected - canonical),
        packetReady, chiefReady, canonicalProgressAgeHours: progressAgeHours },
      truth: { status: truthStatus, sourceCoverageRatio: combinedCoverage,
        trialCoverageFloorMet: combinedCoverage === null ? null : combinedCoverage >= 0.95 },
    },
    incidents: incidents.sort((a, b) => a.plane.localeCompare(b.plane) || a.code.localeCompare(b.code)),
    readyForAutonomousOperation: incidents.length === 0 && workforce.status !== "unverified" &&
      hours.status === "healthy" && truthStatus === "passing_last_audit" && !stalled,
    caveat: "Operational readiness does not qualify T0, a ranking, or a trial tick.",
  };
  return summarized;
}

export function reconcileIncidentJournal(previous = [], current = [], checkedAt) {
  const at = iso(checkedAt);
  if (!at) throw new Error("phoenix_invalid_incident_time");
  const earlier = new Map(previous.map(x => [x.id, x]));
  return current.map(x => {
    const old = earlier.get(x.id);
    return { ...x, firstSeenAt: old?.firstSeenAt || at, lastSeenAt: at,
      observedSnapshots: integer(old?.observedSnapshots) + 1,
      disposition: old?.disposition === "blocked_needs_owner" ? "blocked_needs_owner" : "open" };
  });
}
