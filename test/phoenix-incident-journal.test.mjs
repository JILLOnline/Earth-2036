import test from "node:test";
import assert from "node:assert/strict";
import { assessPhoenix } from "../scripts/lib/phoenix-control-plane.mjs";
import { advanceIncidentMemory, appendOnlyEventLines, parseIncidentEvents } from "../scripts/lib/phoenix-incident-journal.mjs";

const row = (hour, present) => ({
  hourKey: hour, retrospectiveObservationStatus: present ? "persisted_now" : "still_missing",
  missingObservationClassification: present ? "original_observation_persisted" : "scheduler_run_not_created_in_slot",
  asOfReceiptSha256: "verified-as-of-hash", schedulerLookup: { status: "available" }, schedulerRuns: []
});
const fixture = (hour = "20261017T1200Z", hasGap = true) => ({
  now: "2026-10-17T13:40:00.000Z",
  system: { companiesExpected: 250 },
  metrics: { total: 250, counts:{ canonical:176, packet_ready:1, chief_ready:0 },
    canonicalProgressAgeHours: 239, generatedAt:"2026-10-17T13:12:00Z" },
  integrity: { passed:true, checkedAt:"2026-10-17T13:16:00Z" },
  reconciliation: { checkedAt:"2026-10-17T13:40:00Z", rows:[row(hour,!hasGap)] },
  sourceHealth: {combinedCoverageRatio:0.708},
  routing:{"council-alpha":{total:1}}, assists:{},
});
function step(prior, data) {
  return advanceIncidentMemory(prior, assessPhoenix(data), data);
}

test("first verified replay opens one event for each fault", () => {
  const {projection,appendEvents} = step(null, fixture());
  assert.ok(appendEvents.some(x=>x.action==="opened" && x.plane==="execution"));
  assert.equal(projection.authority.canonical, false);
  assert.equal(projection.authority.restartWorkers, false);
  assert.ok(projection.openCount>0);
});

test("same source snapshot has stable incident IDs and no repeated open events", () => {
  const first=step(null, fixture()), again=step(first.projection,fixture());
  assert.deepEqual(again.appendEvents,[]);
  assert.deepEqual(again.projection,first.projection);
});

test("a changed missed-hour count does not create a second root-cause incident", () => {
  const first=step(null, fixture());
  const changed=fixture("20261017T1300Z");
  changed.now="2026-10-17T14:40:00Z";
  changed.reconciliation.checkedAt=changed.now;
  changed.metrics.generatedAt=changed.now;
  const second=step(first.projection,changed);
  assert.ok(!second.appendEvents.some(x=>x.action==="opened" && x.plane==="execution"));
  assert.equal(second.projection.incidents.filter(x=>x.code==="scheduler_nonarrival").length,1);
});

test("a clean window only starts clearance; it does not announce resolution", () => {
  const first=step(null, fixture());
  const clean=fixture("20261017T1300Z",false);
  clean.now="2026-10-17T14:40:00Z";
  clean.reconciliation.checkedAt=clean.now;
  const next=step(first.projection,clean);
  const slot=next.projection.incidents.find(x=>x.code==="scheduler_nonarrival");
  assert.equal(slot.status,"open");
  assert.equal(slot.pendingClearWindow,"hour:20261017T1300Z");
  assert.ok(!next.appendEvents.some(x=>x.action==="resolved" && x.plane==="execution"));
});

test("same clean window replay cannot satisfy two-window clearance", () => {
  const opened=step(null,fixture());
  const clean=fixture("20261017T1300Z",false);
  clean.now="2026-10-17T14:40:00Z";
  clean.reconciliation.checkedAt=clean.now;
  const p=step(opened.projection,clean);
  const q=step(p.projection,{...clean,now:"2026-10-17T14:43:00Z"});
  assert.equal(q.projection.incidents.find(x=>x.code==="scheduler_nonarrival").status,"open");
  assert.equal(q.appendEvents.length,0);
});

test("two distinct verified clean windows resolve but never erase history", () => {
  const first=step(null,fixture());
  const clean1=fixture("20261017T1300Z",false);
  clean1.now="2026-10-17T14:40:00Z";
  clean1.reconciliation.checkedAt=clean1.now;
  const pending=step(first.projection,clean1);
  const clean2=fixture("20261017T1400Z",false);
  clean2.now="2026-10-17T15:40:00Z";
  clean2.reconciliation.checkedAt=clean2.now;
  const done=step(pending.projection,clean2);
  const entry=done.projection.incidents.find(x=>x.code==="scheduler_nonarrival");
  assert.equal(entry.status,"resolved");
  assert.ok(done.appendEvents.some(x=>x.incidentId===entry.id && x.action==="resolved"));
  assert.equal(entry.firstSeenAt,first.projection.incidents.find(x=>x.id===entry.id).firstSeenAt);
});

test("reappearance after resolved state reopens original fingerprint", () => {
  let state=step(null,fixture()).projection;
  for (const [h,t] of [["20261017T1300Z","2026-10-17T14:40:00Z"],["20261017T1400Z","2026-10-17T15:40:00Z"]]) {
    const c=fixture(h,false);c.now=t;c.reconciliation.checkedAt=t;state=step(state,c).projection;
  }
  const back=fixture("20261017T1500Z",true);back.now="2026-10-17T16:40:00Z";back.reconciliation.checkedAt=back.now;
  const reopened=step(state,back);
  assert.ok(reopened.appendEvents.some(x=>x.action==="reopened" && x.code===undefined && x.plane==="execution"));
  assert.equal(reopened.projection.incidents.find(x=>x.code==="scheduler_nonarrival").reopenCount,1);
});

test("unknown task state is not self-certified by GitHub after clean scheduler", () => {
  const clean=fixture("20261017T1300Z",false);
  const state=step(null,clean).projection;
  assert.ok(state.incidents.some(x=>x.code==="worker_availability_unverified"));
  assert.ok(state.incidents.every(x=>x.automaticRecoveryAuthorized===false));
});

test("missing retrospective rows cannot auto-resolve a scheduler incident", () => {
  const first=step(null,fixture());
  const unknown=fixture();unknown.reconciliation={checkedAt:unknown.now};
  const next=step(first.projection,unknown);
  assert.equal(next.projection.incidents.find(x=>x.code==="scheduler_nonarrival").status,"open");
});

test("append-only history suppresses same event, keeps exact past bytes", () => {
  const first=step(null,fixture());
  const a=appendOnlyEventLines("",first.appendEvents);
  const b=appendOnlyEventLines(a.content,first.appendEvents);
  assert.equal(b.appended,0);
  assert.equal(b.content,a.content);
  assert.equal(parseIncidentEvents(b.content).length,first.appendEvents.length);
});

test("corrupt event history is rejected instead of overwritten", () => {
  assert.throws(()=>parseIncidentEvents('{"bad":true}\n'),/phoenix_invalid_event/);
  assert.throws(()=>parseIncidentEvents("{broken-json\n"),/phoenix_corrupt_event_json/);
});
