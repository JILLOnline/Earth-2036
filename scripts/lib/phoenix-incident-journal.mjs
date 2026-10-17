import { createHash } from "node:crypto";

// Phase 2 is an operational event log, never a score/evidence/observation authority.
// Historical incidents remain append-only, and any inferred recovery needs two
// distinct, verifiable source windows. Repeated snapshots never append an open event.
export const JOURNAL_CONTRACT = "earth2036-phoenix-incident-journal-v1";
const digest = text => createHash("sha256").update(text).digest("hex").slice(0, 24);
const validTime = value => Number.isFinite(Date.parse(value || ""));
const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

export function parseIncidentEvents(raw = "") {
  const events = [];
  const ids = new Set();
  for (const [index, line] of String(raw).split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); }
    catch { throw new Error("phoenix_corrupt_event_json:" + (index + 1)); }
    if (row.contract !== JOURNAL_CONTRACT || !["opened", "resolved", "reopened"].includes(row.action)
      || !row.incidentId || !row.eventId || !validTime(row.observedAt)) {
      throw new Error("phoenix_invalid_event:" + (index + 1));
    }
    if (ids.has(row.eventId)) throw new Error("phoenix_duplicate_event_id:" + row.eventId);
    ids.add(row.eventId);
    events.push(row);
  }
  return events;
}

export function evidenceWindowFor(plane, inputs) {
  if (plane === "execution") {
    const rows = inputs.reconciliation?.rows;
    if (!Array.isArray(rows) || !rows.length) return null;
    const sorted = [...rows].map(x => x.hourKey).sort();
    if (!/^\d{8}T\d{2}00Z$/.test(sorted.at(-1))) return null;
    return "hour:" + sorted.at(-1);
  }
  if (plane === "research") {
    const at = inputs.metrics?.generatedAt;
    return validTime(at) ? "workgraph:" + new Date(at).toISOString() : null;
  }
  if (plane === "truth") {
    const at = inputs.integrity?.checkedAt || inputs.integrity?.generatedAt;
    return validTime(at) ? "integrity:" + new Date(at).toISOString() : null;
  }
  // ChatGPT worker state is not available to GitHub; refuse to infer clearance.
  return null;
}

function canConfirmClear(plane, report) {
  if (plane === "execution") return report.planes?.execution?.status === "healthy"
    && report.planes.execution.slots > 0
    && report.planes.execution.missingAsOfReceipt === 0;
  if (plane === "research") return ["baseline_complete", "unverified_progress"].includes(report.planes?.research?.status)
    && report.planes?.research?.canonicalProgressAgeHours !== null;
  if (plane === "truth") return report.planes?.truth?.status === "passing_last_audit";
  return false;
}

export function advanceIncidentMemory(previous, report, inputs = {}) {
  if (report?.contract !== "earth2036-phoenix-flight-recorder-v1" ||
      !validTime(report.checkedAt) || !Array.isArray(report.incidents)) {
    throw new Error("phoenix_invalid_report");
  }
  if (previous !== null && previous !== undefined && previous.contract !== JOURNAL_CONTRACT) {
    throw new Error("phoenix_incompatible_prior_projection");
  }
  const oldEntries = new Map((previous?.incidents || []).map(x => [x.id, x]));
  if (oldEntries.size !== (previous?.incidents || []).length) throw new Error("phoenix_duplicate_prior_incident");
  const active = new Map(report.incidents.map(x => [x.id, x]));
  if (active.size !== report.incidents.length) throw new Error("phoenix_duplicate_current_incident");
  const events = [];
  const output = [];

  function emit(id, action, plane, window) {
    events.push({
      contract: JOURNAL_CONTRACT, eventId: digest([id, action, window || report.checkedAt].join(":")),
      incidentId: id, plane, action, observedAt: report.checkedAt,
      evidenceWindow: window || null, immutableHistoricalFact: true,
    });
  }

  for (const item of report.incidents) {
    const prior = oldEntries.get(item.id);
    const window = evidenceWindowFor(item.plane, inputs);
    if (prior && (prior.code !== item.code || prior.plane !== item.plane)) {
      throw new Error("phoenix_incident_identity_collision:" + item.id);
    }
    if (!prior) emit(item.id, "opened", item.plane, window);
    else if (prior.status === "resolved") emit(item.id, "reopened", item.plane, window);

    output.push({
      ...item, status: "open",
      firstSeenAt: prior?.firstSeenAt || report.checkedAt,
      lastVerifiedAt: report.checkedAt,
      lastEvidenceWindow: window,
      pendingClearWindow: null,
      reopenCount: (prior?.reopenCount || 0) + (prior?.status === "resolved" ? 1 : 0),
      lastDisposition: prior?.status === "resolved" ? "reopened" : prior?.lastDisposition || "opened",
    });
  }

  for (const prior of previous?.incidents || []) {
    if (active.has(prior.id)) continue;
    if (prior.status === "resolved") { output.push(prior); continue; }
    const window = evidenceWindowFor(prior.plane, inputs);
    const sufficient = window && canConfirmClear(prior.plane, report);
    if (!sufficient) {
      output.push({ ...prior, pendingClearWindow: null });
      continue;
    }
    if (prior.pendingClearWindow && prior.pendingClearWindow !== window) {
      emit(prior.id, "resolved", prior.plane, window);
      output.push({ ...prior, status: "resolved", resolvedAt: report.checkedAt,
        resolvedEvidenceWindow: window, pendingClearWindow: null,
        lastDisposition: "resolved_after_two_distinct_verified_windows" });
    } else {
      output.push({ ...prior, pendingClearWindow: window });
    }
  }

  output.sort((a, b) => a.plane.localeCompare(b.plane) || a.code.localeCompare(b.code));
  return {
    projection: {
      contract: JOURNAL_CONTRACT, version: 1, mode: "noncanonical_operational_diagnostics",
      authority: { canonical: false, dispatch: false, restartWorkers: false,
        backfill: false, qualifyTicks: false },
      lastAssessedAt: report.checkedAt,
      openCount: output.filter(x => x.status === "open").length,
      resolvedCount: output.filter(x => x.status === "resolved").length,
      incidents: output,
    },
    appendEvents: events,
  };
}

export function appendOnlyEventLines(existing, candidateEvents) {
  const old = parseIncidentEvents(existing);
  const ids = new Set(old.map(x => x.eventId));
  const fresh = candidateEvents.filter(e => !ids.has(e.eventId));
  if (new Set(fresh.map(x => x.eventId)).size !== fresh.length)
    throw new Error("phoenix_repeated_new_event_id");
  const addition = fresh.map(x => JSON.stringify(x) + "\n").join("");
  return { content: String(existing) + addition, appended: fresh.length };
}
