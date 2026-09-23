import Link from "next/link";
import sourceHealthJson from "../../data/runtime/source-health.json";
import automatedHealthJson from "../../data/runtime/automated-source-health.json";
import integrityJson from "../../data/runtime/intelligence-integrity.json";
import runtimeJson from "../../data/runtime/system-state.json";
import queueJson from "../../data/runtime/evidence-review-queue.json";
import workgraphMetricsJson from "../../data/runtime/workgraph/metrics.json";
import bridgeHealthJson from "../../data/runtime/workgraph/shadow/fundamentals-bridge-health.json";
import registryJson from "../../data/runtime/supervisors/registry.json";
import { runtimeTime } from "../../lib/dashboard-runtime";
import CouncilOperations from "../components/CouncilOperations";
import { Bubble, Deck, DeckHeader, Screen, ScreenHeader, Stat, StatRail } from "../components/Display";
import ProgressiveList from "../components/ProgressiveList";

type MachineSource = { id?: string; name?: string; authority?: string; cadence?: string; status?: string; lastSuccess?: string | null; latencyMs?: number | null; coverage?: number; note?: string };
type AutomatedSource = { id?: string; name?: string; status?: string; observedAt?: string; latencyMs?: number | null; observationMode?: string; eventDataAvailable?: boolean; latestCalendarDay?: string; datasetLastUpdated?: string; datasetTimestamp?: string; note?: string };
type Integrity = { passed: boolean; checkedAt?: string | null; scoreRecordsAudited: number; scoreRecordsPassed: number; sourceMesh: { passed: boolean; requiredMachineSources: number; unhealthyMachineSources: string[]; automatedCoverageRatio?: number | null; unhealthyAutomatedSources: string[] } };
type WorkgraphMetrics = {
  generatedAt?: string;
  total: number;
  counts: Record<string, number>;
  canonicalProgressAgeHours?: number | null;
  ownerBacklog?: Record<string, number>;
  effectiveOwnerBacklog?: Record<string, number>;
  roleActivity?: Record<string, { lastGeneratedAt?: string | null; lastAgeHours?: number | null; last1h?: number; last6h?: number; last24h?: number; total?: number }>;
  healthAlerts?: string[];
  healthy?: boolean;
};
type Registry = {
  architectureVersion?: string;
  machineScheduleMinute: number;
  operatingShifts: Array<{ id: string; label: string; window: string; startHour: number; endHour: number; mode: string }>;
  workers: Array<{ id: string; name: string; scheduleMinute: number; role: string; summary: string }>;
  lanes: Array<{ id: string; name: string; runnerId: string }>;
  chief: { id: string; name: string; scheduleMinute: number };
};

const sourceHealth = sourceHealthJson as unknown as { updatedAt?: string; machineCoverageRatio: number; supervisorCoverageRatio: number; combinedCoverageRatio: number; sources: MachineSource[] };
const automated = automatedHealthJson as unknown as { updatedAt?: string; coverageRatio: number; healthyRequiredSources: number; requiredSources: number; sources: AutomatedSource[] };
const integrity = integrityJson as unknown as Integrity;
const runtime = runtimeJson as typeof runtimeJson;
const queue = queueJson as unknown as { unresolved: number; items: Array<{ id?: string; ticker?: string; form?: string; status?: string; filingDate?: string; detectedAt?: string; sourceUrl?: string }> };
const workgraph = workgraphMetricsJson as unknown as WorkgraphMetrics;
type BridgeCompany = { ticker: string; status: string; truthHash: string | null; rawFactsHash: string | null;
  sourcePayloadHash: string | null; projectionHash: string | null; rawFactCount: number | null;
  currentCount: number | null; supersededCount: number | null; taxonomies: string[];
  cutoff: string | null; latestSecFiling: string | null; reconstructionState: string };
type BridgeHealth = { status?: string; asOf?: string | null; generatedAt?: string | null;
  companies: number; valid: number; unknown: number; invalid: number;
  rawFactsReferenced: number; uniqueFactStates: number; changedThisCycle: number;
  futureLeakage: number; cikMismatches: number; hashFailures: number;
  projectionAuthority: number; canonicalWrites: number; companyDetails?: BridgeCompany[] };
const bridge = bridgeHealthJson as unknown as BridgeHealth;
const registry = registryJson as unknown as Registry;
const pct = (value: number) => `${Math.round((Number(value) || 0) * 100)}%`;
const healthy = (value?: string) => String(value).toLowerCase() === "healthy";

export default function SystemPage() {
  const integrityPass = integrity.passed && integrity.sourceMesh.passed;
  const engineState = !integrityPass ? "LOCKED" : workgraph.healthy === true ? "PASS" : "ATTENTION";
  const canonical = Number(workgraph.counts?.canonical ?? 0);
  const chiefReady = Number(workgraph.counts?.chief_ready ?? 0);
  const stateOrder = ["observed", "triaged", "researching", "evidence_complete", "packet_ready", "chief_ready", "canonical", "blocked"];
  const roleLabels: Record<string, string> = {
    "earth-scout": "SCOUT",
    "council-alpha": "ALPHA",
    "council-beta": "BETA",
    "deep-resolver": "DEEP",
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow="SYSTEM"
        title={<>{engineState} <em>ENGINE</em></>}
        stamp={{ label: "LAST MACHINE CYCLE", value: runtimeTime(runtime.lastCycleAt) }}
      />

      <StatRail>
        <Stat label="CYCLE" value={<span className="compactStat">{runtime.cycleKey}</span>} detail={runtime.cycleStatus.toUpperCase()} />
        <Stat label="MACHINE" value={pct(sourceHealth.machineCoverageRatio)} detail="SOURCE COVERAGE" />
        <Stat label="SUPERVISOR" value={pct(sourceHealth.supervisorCoverageRatio)} detail="EVIDENCE COVERAGE" />
        <Stat label="SOURCE MESH" value={integrity.sourceMesh.passed ? "PASS" : "LOCKED"} detail={`${integrity.sourceMesh.requiredMachineSources} REQUIRED`} />
        <Stat label="WORKGRAPH" value={`${canonical}/${workgraph.total}`} detail={chiefReady ? `${chiefReady} CHIEF READY` : "0 CHIEF READY"} />
        <Stat label="EVIDENCE" value={queue.unresolved} detail={queue.unresolved === 0 ? "QUEUE CLEAR" : "UNRESOLVED"} />
      </StatRail>

      <Deck>
        <DeckHeader
          eyebrow={bridge.asOf ? "SHADOW · PIT " + runtimeTime(bridge.asOf) : "SHADOW · AUDIT PENDING"}
          title="TRAJECTORY FUNDAMENTALS"
          action={<Bubble active={bridge.companies > 0 && bridge.invalid === 0 && bridge.unknown === 0}>
            {bridge.companies > 0 ? bridge.valid + "/" + bridge.companies + " VERIFIED" : "NO AUDITED INDEX"}
          </Bubble>}
        />
        <div className="queueMatrix">
          <div><b>VALID REFERENCES</b><span>{bridge.valid}</span><span>COMPANIES {bridge.companies}</span><Bubble active={bridge.valid > 0}>{bridge.valid}</Bubble><span>—</span></div>
          <div><b>UNKNOWN / INVALID</b><span>{bridge.unknown} / {bridge.invalid}</span><span>MISSING STAYS UNKNOWN</span><Bubble active={bridge.invalid === 0 && bridge.companies > 0}>{bridge.invalid === 0 ? "NO ERRORS REPORTED" : "INVESTIGATE"}</Bubble><span>—</span></div>
          <div><b>RAW FACTS REFERENCED</b><span>{bridge.rawFactsReferenced.toLocaleString()}</span><span>{bridge.uniqueFactStates} UNIQUE STATES</span><Bubble>{bridge.changedThisCycle} CHANGED</Bubble><span>—</span></div>
          <div><b>INTEGRITY / AUTHORITY</b><span>{bridge.futureLeakage} FUTURE · {bridge.hashFailures} HASH</span><span>{bridge.cikMismatches} CIK · {bridge.projectionAuthority} PROJECTION</span><Bubble active={bridge.canonicalWrites === 0}>CANONICAL WRITES {bridge.canonicalWrites}</Bubble><span>—</span></div>
        </div>
        {bridge.companyDetails?.length ? (
          <ProgressiveList className="systemRows">
            {bridge.companyDetails.map((company) => (
              <div key={company.ticker} className="systemRow">
                <div className="systemIdentity">
                  <b>{company.ticker}</b>
                  <span>{(company.taxonomies || []).join(", ") || "NO TAXONOMY"} · {company.rawFactCount ?? "—"} RAW FACTS</span>
                  <details>
                    <summary>VIEW TRUTH REFERENCE</summary>
                    <small>TRUTH {company.truthHash || "—"}</small><br />
                    <small>RAW {company.rawFactsHash || "—"}</small><br />
                    <small>SOURCE {company.sourcePayloadHash || "—"}</small><br />
                    <small>PROJECTION (AUDIT ONLY) {company.projectionHash || "—"}</small><br />
                    <small>CUTOFF {company.cutoff || "—"} · LAST FILING {company.latestSecFiling || "—"}</small><br />
                    <small>CURRENT {company.currentCount ?? "—"} · SUPERSEDED {company.supersededCount ?? "—"}</small><br />
                    <small>RECONSTRUCTION {company.reconstructionState}</small>
                  </details>
                </div>
                <div className="systemMetrics"><Bubble active={company.status === "valid"}>{company.status.toUpperCase()}</Bubble></div>
              </div>
            ))}
          </ProgressiveList>
        ) : (
          <div className="queueClear"><span>NO VERIFIED BRIDGE REFERENCES PUBLISHED</span><b>#11 AUDIT PENDING · EARTH PRODUCTION UNAFFECTED</b></div>
        )}
      </Deck>

      <section className="systemPair">
        <Deck>
          <DeckHeader eyebrow={runtimeTime(sourceHealth.updatedAt)} title="MACHINE SOURCES" action={<Bubble active={sourceHealth.machineCoverageRatio === 1}>{pct(sourceHealth.machineCoverageRatio)}</Bubble>} />
          <div className="systemRows">
            {sourceHealth.sources.map((source) => (
              <div key={source.id} className="systemRow">
                <div className="systemIdentity">
                  <b>{source.name ?? source.id}</b>
                  <span>{source.authority ?? "—"} · {source.cadence ?? "—"}</span>
                  {source.note && <small>{source.note}</small>}
                </div>
                <div className="systemMetrics">
                  <Bubble active={healthy(source.status)}>{String(source.status ?? "unknown").toUpperCase()}</Bubble>
                  <span><small>COVERAGE</small><b>{pct(source.coverage ?? 0)}</b></span>
                  <span><small>LATENCY</small><b>{source.latencyMs == null ? "—" : `${source.latencyMs}ms`}</b></span>
                </div>
              </div>
            ))}
          </div>
        </Deck>

        <Deck>
          <DeckHeader eyebrow={runtimeTime(automated.updatedAt)} title="GATING PROBES" action={<Bubble active={automated.coverageRatio === 1}>{automated.healthyRequiredSources}/{automated.requiredSources}</Bubble>} />
          <div className="systemRows">
            {automated.sources.map((source) => (
              <div key={source.id} className="systemRow">
                <div className="systemIdentity">
                  <b>{source.name ?? source.id}</b>
                  <span>{source.observationMode?.replaceAll("-", " ") ?? "DATASET"}{source.eventDataAvailable == null ? "" : ` · EVENT DATA ${source.eventDataAvailable ? "YES" : "NO"}`}</span>
                  <small>{source.note ?? ""}</small>
                </div>
                <div className="systemMetrics">
                  <Bubble active={healthy(source.status)}>{String(source.status ?? "unknown").toUpperCase()}</Bubble>
                  <span className="systemWideMetric"><small>FRESHNESS</small><b>{source.latestCalendarDay ?? source.datasetLastUpdated ?? source.datasetTimestamp ?? runtimeTime(source.observedAt) ?? "—"}</b></span>
                </div>
              </div>
            ))}
          </div>
        </Deck>
      </section>

      <Deck>
        <DeckHeader
          eyebrow={runtimeTime(workgraph.generatedAt)}
          title="WORKGRAPH V2 COMMAND CENTER"
          action={<Bubble active={workgraph.healthy === true}>{workgraph.healthy ? "HEALTHY" : "ATTENTION"}</Bubble>}
        />
        <div className="queueMatrix">
          {stateOrder.map((state) => (
            <div key={state}>
              <b>{String(state).replaceAll("_", " ").toUpperCase()}</b>
              <span>{Number(workgraph.counts?.[state] ?? 0)}</span>
              <span>{state === "canonical" && workgraph.canonicalProgressAgeHours != null ? `${workgraph.canonicalProgressAgeHours.toFixed(1)}h since progress` : "—"}</span>
              <Bubble active={state === "canonical" ? canonical > 0 : Number(workgraph.counts?.[state] ?? 0) === 0}>{state === "canonical" ? `${canonical}/${workgraph.total}` : Number(workgraph.counts?.[state] ?? 0)}</Bubble>
              <span>—</span>
            </div>
          ))}
        </div>

        <div className="systemRows">
          {Object.entries(workgraph.effectiveOwnerBacklog ?? workgraph.ownerBacklog ?? {}).map(([owner, backlog]) => {
            const activity = workgraph.roleActivity?.[owner];
            return (
              <div key={owner} className="systemRow">
                <div className="systemIdentity">
                  <b>{roleLabels[owner] ?? owner.toUpperCase()}</b>
                  <span>{backlog} OPEN ROUTED ITEMS</span>
                  <small>{activity?.lastGeneratedAt ? `LAST EVIDENCE ${runtimeTime(activity.lastGeneratedAt)}` : "NO RECENT EVIDENCE ACTIVITY"}</small>
                </div>
                <div className="systemMetrics">
                  <Bubble active={Boolean(activity && (activity.lastAgeHours ?? 999) <= 2)}>{activity?.lastAgeHours == null ? "STALE" : `${activity.lastAgeHours.toFixed(1)}h`}</Bubble>
                  <span><small>LAST 1H</small><b>{activity?.last1h ?? 0}</b></span>
                  <span><small>LAST 24H</small><b>{activity?.last24h ?? 0}</b></span>
                </div>
              </div>
            );
          })}
        </div>

        {(workgraph.healthAlerts?.length ?? 0) > 0 && (
          <div className="systemRows">
            {workgraph.healthAlerts?.map((alert) => (
              <div key={alert} className="systemRow">
                <div className="systemIdentity">
                  <b>SYSTEM HEALTH ALERT</b>
                  <span>{alert.replaceAll("_", " ").replaceAll(":", " · ")}</span>
                </div>
                <div className="systemMetrics"><Bubble>ATTENTION</Bubble></div>
              </div>
            ))}
          </div>
        )}
      </Deck>

      <Deck>
        <DeckHeader eyebrow={`${registry.lanes.length + 1} ROLES · ${registry.workers.length} WORKERS`} title="EARTH COUNCIL" action={<Bubble active={workgraph.healthy === true}>{registry.architectureVersion ?? "WORKGRAPH-V2"}</Bubble>} />
        <CouncilOperations shifts={registry.operatingShifts} workers={registry.workers} cycleBoundaryMinute={registry.machineScheduleMinute} />
        <div className="councilRoster">
          {registry.lanes.map((lane) => (
            <article key={lane.id}>
              <span>{lane.runnerId.replace("earth-council-", "").toUpperCase()}</span>
              <b>{lane.name.replace(" Supervisor", "")}</b>
              <small>{lane.id}</small>
            </article>
          ))}
          <article className="chiefPlate"><span>CHIEF</span><b>{registry.chief.name}</b><small>{registry.chief.id}</small></article>
        </div>
      </Deck>

      <Deck className={queue.items.length ? "" : "compactDeck"}>
        <DeckHeader eyebrow={queue.unresolved} title="EVIDENCE QUEUE" action={<Link href="/ledger" className="textAction">OPEN LEDGER ↗</Link>} />
        {queue.items.length ? (
          <ProgressiveList className="queueMatrix">
            {queue.items.map((item, index) => (
              <div key={item.id ?? index}>
                <b>{item.ticker ?? "—"}</b>
                <span>{item.form ?? "EVENT"}</span>
                <span>{item.filingDate ?? item.detectedAt ?? "—"}</span>
                <Bubble>{String(item.status ?? "pending").toUpperCase()}</Bubble>
                {item.sourceUrl ? <a className="earthBubble" href={item.sourceUrl} target="_blank" rel="noreferrer">SOURCE ↗</a> : <span>—</span>}
              </div>
            ))}
          </ProgressiveList>
        ) : (
          <div className="queueClear"><span>NO UNRESOLVED EVIDENCE</span><b>QUEUE CLEAR</b></div>
        )}
      </Deck>
    </Screen>
  );
}
