import test from "node:test";
import assert from "node:assert/strict";
import {
  assessHourlySlots, assessWorkforce, assessPhoenix, reconcileIncidentJournal
} from "../scripts/lib/phoenix-control-plane.mjs";

const row = (hourKey, present, runs = []) => ({
  hourKey,
  retrospectiveObservationStatus: present ? "persisted_now" : "still_missing",
  asOfReceiptSha256: present ? "evidence-hash" : null,
  schedulerLookup: { status: "available" },
  schedulerRuns: runs,
  missingObservationClassification: present ? "original_observation_persisted" :
    runs.length ? "scheduler_run_failed_cause_unverified" : "scheduler_run_not_created_in_slot",
});
const base = () => ({
  now: "2026-10-17T14:45:00.000Z",
  system: { companiesExpected: 250, cycleStatus: "completed" },
  metrics: {
    total: 250, counts: { canonical: 176, researching: 73, packet_ready: 1, chief_ready: 0 },
    canonicalProgressAgeHours: 239,
  },
  integrity: { passed: true },
  sourceHealth: { combinedCoverageRatio: 0.708 },
  reconciliation: { checkedAt: "2026-10-17T14:40:00.000Z", rows: [
    row("20261017T1200Z", false), row("20261017T1300Z", true),
  ] },
  routing: { "earth-scout": { total: 0 }, "council-alpha": { total: 2 },
    "council-beta": { total: 1 }, "deep-resolver": { total: 0 } },
  assists: { "earth-scout": { active: 4 } },
});

test("missing original observation with zero runs is scheduler nonarrival, not failed Git persistence", () => {
  const report = assessPhoenix(base());
  assert.equal(report.planes.execution.missingWithoutRun, 1);
  assert.equal(report.planes.execution.persisted, 1);
  assert.ok(report.incidents.some(x => x.code === "scheduler_nonarrival"));
  assert.ok(!report.incidents.some(x => x.code === "git_write_failure"));
  assert.equal(report.authority.historicalBackfill, false);
});

test("failed run differs from scheduler nonarrival", () => {
  const sample = base();
  sample.reconciliation.rows = [row("20261017T1200Z", false, [{ conclusion: "failure" }])];
  const report = assessPhoenix(sample);
  assert.equal(report.planes.execution.missingWithoutRun, 0);
  assert.equal(report.planes.execution.runFailed, 1);
  assert.ok(report.incidents.some(x => x.code === "unpersisted_observation_with_attempt_or_unknown"));
  assert.ok(!report.incidents.some(x => x.code === "scheduler_nonarrival"));
});

test("duplicated hourly slots fail instead of creating synthetic proof", () => {
  assert.throws(() => assessHourlySlots({ rows: [
    row("20261017T1200Z", true), row("20261017T1200Z", true)
  ] }), /phoenix_invalid_or_duplicate_hourly_slot/);
});

test("absent retrospective evidence is unverified rather than healthy", () => {
  const sample = base();
  sample.reconciliation = null;
  const report = assessPhoenix(sample);
  assert.equal(report.planes.execution.status, "unverified");
  assert.equal(report.readyForAutonomousOperation, false);
});

test("GitHub timestamps are not evidence that a ChatGPT task is enabled", () => {
  const report = assessPhoenix(base());
  assert.equal(report.planes.workforce.status, "unverified");
  assert.ok(report.incidents.some(x => x.code === "worker_availability_unverified"));
  assert.equal(report.planes.workforce.assignments.find(x => x.role === "council-alpha").enabled, null);
});

test("operator-supplied paused worker with work produces blocked-owner classification", () => {
  const sample = base();
  sample.roster = { "council-alpha": { enabled: false }, "council-beta": { enabled: false },
    "earth-scout": { enabled: false }, "deep-resolver": { enabled: true } };
  const report = assessPhoenix(sample);
  const incident = report.incidents.find(x => x.code === "disabled_owner_has_actionable_work");
  assert.equal(report.planes.workforce.status, "blocked");
  assert.match(incident.detail, /earth-scout/);
  assert.match(incident.detail, /council-alpha/);
  assert.match(incident.detail, /council-beta/);
  assert.equal(incident.automaticRecoveryAuthorized, false);
});

test("disabled idle resolver is not falsely reported as an active blocked owner", () => {
  const workforce = assessWorkforce(
    { "deep-resolver": { total: 0 } }, { "deep-resolver": { active: 0 } },
    { "deep-resolver": { enabled: false } }
  );
  assert.ok(!workforce.unavailableWithWork.includes("deep-resolver"));
});

test("fresh machine does not turn stalled research healthy", () => {
  const sample = base();
  sample.reconciliation.rows = [row("20261017T1300Z", true)];
  const report = assessPhoenix(sample);
  assert.equal(report.planes.execution.status, "healthy");
  assert.equal(report.planes.research.status, "stalled");
  assert.equal(report.readyForAutonomousOperation, false);
});

test("integrity failure is independent of execution success and cannot authorize promotion", () => {
  const sample = base();
  sample.integrity = { passed: false };
  const report = assessPhoenix(sample);
  assert.equal(report.planes.truth.status, "blocked");
  assert.ok(report.incidents.some(x => x.code === "integrity_gate_failed"));
  assert.equal(report.authority.approvalWrites, false);
  assert.equal(report.authority.tickQualification, false);
});

test("the same root cause keeps its fingerprint when counters and age change", () => {
  const a = assessPhoenix(base());
  const changed = base();
  changed.metrics.canonicalProgressAgeHours = 400;
  changed.reconciliation.rows.push(row("20261017T1100Z", false));
  const b = assessPhoenix(changed);
  for (const key of ["scheduler_nonarrival", "canonical_frontier_stalled"]) {
    assert.equal(a.incidents.find(x => x.code === key).id, b.incidents.find(x => x.code === key).id);
  }
});

test("incident journal increments the same fingerprint without claiming recovery", () => {
  const current = assessPhoenix(base()).incidents;
  const first = reconcileIncidentJournal([], current, "2026-10-17T14:45:00Z");
  const second = reconcileIncidentJournal(first, current, "2026-10-17T15:45:00Z");
  assert.deepEqual(first.map(x => x.id), second.map(x => x.id));
  assert.ok(second.every(x => x.observedSnapshots === 2 && x.disposition === "open"));
  assert.ok(second.every(x => x.firstSeenAt === "2026-10-17T14:45:00.000Z"));
});

test("no verified worker availability means no autonomous-ready claim even with completed baseline", () => {
  const sample = base();
  sample.metrics.counts = { canonical: 250, packet_ready: 0, chief_ready: 0 };
  sample.metrics.canonicalProgressAgeHours = 1;
  sample.reconciliation.rows = [row("20261017T1300Z", true)];
  sample.routing = {};
  sample.assists = {};
  const report = assessPhoenix(sample);
  assert.equal(report.planes.research.status, "baseline_complete");
  assert.equal(report.planes.workforce.status, "observed_only");
  assert.equal(report.readyForAutonomousOperation, true);
  // This is operational-only: no T0 publication/tick authority granted.
  assert.equal(report.authority.tickQualification, false);
  assert.equal(report.authority.canonicalWrites, false);
});
