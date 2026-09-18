import manifestJson from "../data/baselines/earth2036-official-t0-2026-09-12/manifest.json";
import runtimeJson from "../data/runtime/system-state.json";
import integrityJson from "../data/runtime/intelligence-integrity.json";
import queueJson from "../data/runtime/evidence-review-queue.json";
import discoveryJson from "../data/runtime/discovery-pool.json";
import councilJson from "../data/runtime/supervisor-council.json";
import { runtimeTime } from "../lib/dashboard-runtime";
import { Bubble, Deck, DeckHeader, Screen, ScreenHeader, Stat, StatRail } from "./components/Display";

type Integrity = {
  passed: boolean;
  scoreRecordsPassed: number;
  scoreRecordsAudited: number;
  sourceMesh: { passed: boolean };
};

type Council = {
  activeCycleKey?: string | null;
  attestation?: { approved?: boolean } | null;
};

const manifest = manifestJson as typeof manifestJson;
const runtime = runtimeJson as typeof runtimeJson;
const integrity = integrityJson as unknown as Integrity;
const queue = queueJson as unknown as { unresolved: number };
const discovery = discoveryJson as unknown as { items: unknown[] };
const council = councilJson as unknown as Council;
const pct = (value: number) => `${Math.round((Number(value) || 0) * 100)}%`;

export default function CommandPage() {
  const gate = manifest.runtimeGate.checks;
  const integrityPass = integrity.passed && integrity.sourceMesh.passed;
  const councilApproved = council.attestation?.approved === true;
  const gates = [
    ["IDENTITY", gate.identity, `${runtime.identityValidated}/${runtime.companiesExpected}`],
    ["TRADABILITY", gate.tradability, `${runtime.tradabilityValidated}/${runtime.companiesExpected}`],
    ["SCORING", gate.scored, `${runtime.scoredCompanies}/${runtime.companiesExpected}`],
    ["PUBLISHABLE", gate.publishable, `${runtime.publishableCompanies}/${runtime.companiesExpected}`],
    ["SOURCE COVERAGE", gate.sourceCoverage, pct(runtime.combinedSourceCoverageRatio)],
    ["DISCOVERY", gate.discovery, runtime.discoveryScanCompleted ? "COMPLETE" : "PENDING"],
    ["EVIDENCE", gate.evidenceQueue, queue.unresolved === 0 ? "CLEAR" : String(queue.unresolved)],
    ["COUNCIL", gate.council, councilApproved ? "APPROVED" : "PENDING"],
  ] as const;
  const blocked = gates.filter(([, passed]) => !passed).length;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="COMMAND"
        title={<>EARTH <em>2036</em></>}
        stamp={{ label: "LAST MACHINE CYCLE", value: runtimeTime(runtime.lastCycleAt) }}
      />

      <StatRail>
        <Stat
          label="T0"
          value={manifest.runtimeGate.passed ? "OPEN" : "LOCKED"}
          detail={blocked === 0 ? "READY" : `${blocked} BLOCKERS`}
        />
        <Stat
          label="PUBLISHABLE"
          value={runtime.publishableCompanies}
          detail={`/ ${runtime.companiesExpected}`}
        />
        <Stat
          label="TRIAL"
          value={runtime.qualifiedTrialTicks}
          detail="/ 1000"
        />
        <Stat
          label="INTEGRITY"
          value={integrityPass ? "PASS" : "LOCKED"}
          detail={`${integrity.scoreRecordsPassed}/${integrity.scoreRecordsAudited}`}
        />
        <Stat
          label="DISCOVERY"
          value={discovery.items.length}
          detail="OUTSIDE"
        />
      </StatRail>

      <Deck>
        <DeckHeader
          eyebrow={`${gates.length - blocked}/${gates.length}`}
          title="PUBLICATION GATE"
          action={<Bubble active={manifest.runtimeGate.passed}>{manifest.runtimeGate.passed ? "OPEN" : "LOCKED"}</Bubble>}
        />
        <div className="gateMatrix">
          {gates.map(([label, passed, value]) => (
            <div className="gateLine" key={label}>
              <span>{label}</span>
              <b>{value}</b>
              <Bubble active={passed}>{passed ? "PASS" : "WAIT"}</Bubble>
            </div>
          ))}
        </div>
      </Deck>

      <Deck>
        <DeckHeader eyebrow="CURRENT" title="OPERATING STATE" />
        <div className="readoutList">
          <div><span>CYCLE</span><b>{runtime.cycleKey}</b></div>
          <div><span>PHASE</span><b>{runtime.phase.replaceAll("_", " ").toUpperCase()}</b></div>
          <div><span>COUNCIL</span><b>{councilApproved ? "APPROVED" : "PENDING"}</b></div>
          <div><span>COUNCIL CYCLE</span><b>{council.activeCycleKey ?? "PENDING"}</b></div>
          <div><span>QUALIFIED</span><b>{runtime.qualifiedTick ? "YES" : "NO"}</b></div>
        </div>
      </Deck>
    </Screen>
  );
}
