import Link from "next/link";
import doctrineJson from "../../config/earth-doctrine.json";
import enginesJson from "../../config/engine-registry.json";
import methodologyJson from "../../config/methodology-1.0.json";
import workforceJson from "../../config/workforce-contract.json";
import metricsJson from "../../data/runtime/workgraph/metrics.json";
import assistJson from "../../data/runtime/workgraph/assist-bus.json";
import calibrationJson from "../../data/runtime/workgraph/shadow/calibration.json";
import dependenciesJson from "../../data/runtime/workgraph/shadow/dependencies.json";
import allocationJson from "../../data/runtime/workgraph/shadow/value-allocation.json";
import learningJson from "../../data/runtime/workgraph/learning-state.json";
import integrityJson from "../../data/runtime/intelligence-integrity.json";
import { runtimeTime } from "../../lib/dashboard-runtime";
import { Bubble, Deck, DeckHeader, Screen, ScreenHeader, Stat, StatRail } from "../components/Display";

type EngineRegistry = {
  canonicalAuthority: string;
  systems: Record<string,{ purpose: string; canWriteCanonical: boolean }>;
  engines: Array<{ id:string; system:string; status:string; question:string; canonicalAuthority:boolean }>;
};
type AssistBus = {
  generatedAt?: string;
  active:number;
  dormant:number;
  queued?:number;
  total:number;
  byHelper: Record<string,number>;
  requests:Array<{requestId:string;ticker:string;rootOwner:string;helperRole:string;capability:string;status:string;priority?:number}>;
};
type Calibration = {
  generatedAt?:string;
  calibrationVersion:string;
  canonicalRecordsAudited:number;
  canonicalRecordsPassingContract:number;
  frontierGuidance:Array<{ticker:string;missingComponents:string[]}>;
};
type Dependencies = { generatedAt?:string;healthy:boolean;roleCycles:string[][];deadlocks:Array<{requestId:string;ticker:string;reason:string;unlockCondition:string}> };
type Allocation = {
  generatedAt?:string;
  capacityPlan:{mode:string;closure:number;expansion:number;futureLearning:number;rule:string};
  top:Array<{ticker:string;state:string;priority:number;failures:string[]}>;
};
type Learning = { activeLessons:Array<{signature:string;symptom:string;correctiveAction:string;successSignal:string}> };
type Metrics = { generatedAt?:string;healthy:boolean;counts:Record<string,number>;healthAlerts?:string[];canonicalProgressAgeHours?:number|null };
type Integrity = {
  checkedAt?: string;
  mathematicalIntegrity?: {
    passed?: boolean;
    audited?: number;
    passedRecords?: number;
    contractVersion?: string;
    formulaHash?: string;
    maxAbsoluteDelta?: number;
    mismatches?: Array<{ ticker:string; storedEarthScore:number|null; expectedEarthScore:number|null; delta:number|null; reasons:string[] }>;
  };
};

const doctrine = doctrineJson as typeof doctrineJson;
const engines = enginesJson as unknown as EngineRegistry;
const methodology = methodologyJson as typeof methodologyJson;
const workforce = workforceJson as typeof workforceJson;
const metrics = metricsJson as unknown as Metrics;
const assist = assistJson as unknown as AssistBus;
const calibration = calibrationJson as unknown as Calibration;
const dependencies = dependenciesJson as unknown as Dependencies;
const allocation = allocationJson as unknown as Allocation;
const learning = learningJson as unknown as Learning;
const integrity = integrityJson as unknown as Integrity;
const pct = (v:number) => `${Math.round(v*100)}%`;

export default function LedgerPage() {
  const canonical = Number(metrics.counts?.canonical ?? 0);
  const packetReady = Number(metrics.counts?.packet_ready ?? 0);
  const chiefReady = Number(metrics.counts?.chief_ready ?? 0);
  const shadowEngines = engines.engines.filter((engine) => engine.system !== "core");
  const coreEngines = engines.engines.filter((engine) => engine.system === "core");

  return (
    <Screen>
      <ScreenHeader
        eyebrow="TRUST LEDGER"
        title={<>REALITY <em>→ VALUE</em></>}
        stamp={{ label:"WORKGRAPH SNAPSHOT", value: runtimeTime(metrics.generatedAt) }}
      />

      <StatRail>
        <Stat label="CANONICAL" value={canonical} detail="CORE RECORDS" />
        <Stat label="FRONTIER" value={packetReady} detail="PACKET READY" />
        <Stat label="CHIEF READY" value={chiefReady} detail="ZERO-DEFECT PATH" />
        <Stat label="ASSISTS" value={assist.active} detail={`${assist.queued ?? 0} QUEUED · ${assist.dormant} DORMANT`} />
        <Stat label="CALIBRATION" value={`${calibration.canonicalRecordsPassingContract}/${calibration.canonicalRecordsAudited}`} detail="CANONICAL AUDIT" />
        <Stat label="SCORE CONTRACT" value={integrity.mathematicalIntegrity?.passed ? "PASS" : integrity.mathematicalIntegrity ? "LOCKED" : "PENDING"} detail={integrity.mathematicalIntegrity ? `${integrity.mathematicalIntegrity.passedRecords ?? 0}/${integrity.mathematicalIntegrity.audited ?? 0} REPRODUCIBLE` : "NEXT BEAST AUDIT"} />
        <Stat label="DEPENDENCIES" value={dependencies.healthy ? "CLEAR" : "ATTENTION"} detail={`${dependencies.roleCycles.length} CYCLES · ${dependencies.deadlocks.length} DEADLOCKS`} />
      </StatRail>

      <section className="systemPair">
        <Deck>
          <DeckHeader eyebrow={doctrine.status.toUpperCase()} title={doctrine.name.toUpperCase()} action={<Bubble active>CONSTITUTION</Bubble>} />
          <div className="ledgerDoctrine">
            <p>{doctrine.mission}</p>
            <div className="ledgerPrinciples">
              {doctrine.principles.slice(0,8).map((principle) => <div key={principle}><span>◆</span><b>{principle}</b></div>)}
            </div>
          </div>
        </Deck>

        <Deck>
          <DeckHeader eyebrow={methodology.version} title="METHODOLOGY AUTHORITY" action={<Bubble active>{methodology.status.toUpperCase()}</Bubble>} />
          <div className="readoutList">
            <div><span>CALIBRATION</span><b>{methodology.calibrationVersion}</b></div>
            <div><span>COMPONENTS</span><b>{methodology.requiredScoreComponents.length}</b></div>
            <div><span>SOURCE COVERAGE GATE</span><b>{pct(methodology.minimumSourceCoverage)}</b></div>
            <div><span>CONFIDENCE FLOOR</span><b>{methodology.minimumPublishableDataConfidence}</b></div>
            <div><span>CANONICAL AUTHORITY</span><b>{engines.canonicalAuthority}</b></div>
          </div>
        </Deck>
      </section>

      <Deck>
        <DeckHeader
          eyebrow={integrity.mathematicalIntegrity?.contractVersion ?? "EARTH SCORE CONTRACT"}
          title="DETERMINISTIC SCORE CONTRACT"
          action={<Bubble active={integrity.mathematicalIntegrity?.passed === true}>{integrity.mathematicalIntegrity?.passed ? "PASS" : integrity.mathematicalIntegrity ? "LOCKED" : "PENDING"}</Bubble>}
        />
        <div className="readoutList">
          <div><span>REPRODUCIBLE RECORDS</span><b>{integrity.mathematicalIntegrity ? `${integrity.mathematicalIntegrity.passedRecords ?? 0}/${integrity.mathematicalIntegrity.audited ?? 0}` : "NEXT AUDIT"}</b></div>
          <div><span>MAX SCORE DELTA</span><b>{integrity.mathematicalIntegrity?.maxAbsoluteDelta == null ? "—" : Number(integrity.mathematicalIntegrity.maxAbsoluteDelta).toFixed(3)}</b></div>
          <div><span>FORMULA HASH</span><b>{integrity.mathematicalIntegrity?.formulaHash ? integrity.mathematicalIntegrity.formulaHash.slice(0,16).toUpperCase() : "—"}</b></div>
          <div><span>POLICY</span><b>WORKERS SUPPLY EVIDENCE · CORE COMPUTES SCORE</b></div>
        </div>
        {(integrity.mathematicalIntegrity?.mismatches?.length ?? 0) > 0 && (
          <div className="ledgerMiniList">
            {integrity.mathematicalIntegrity?.mismatches?.slice(0,8).map((row) => (
              <div key={row.ticker}>
                <b>{row.ticker}</b>
                <span>{row.storedEarthScore ?? "—"} → {row.expectedEarthScore ?? "—"}</span>
                <small>{row.reasons.join(" · ").replaceAll("_"," ")}</small>
              </div>
            ))}
          </div>
        )}
      </Deck>

      <Deck>
        <DeckHeader eyebrow={coreEngines.length} title="EARTH CORE" action={<Bubble active>CANONICAL AUTHORITY</Bubble>} />
        <div className="engineLedger">
          {coreEngines.map((engine) => (
            <article key={engine.id}>
              <div><span>{engine.system.toUpperCase()}</span><b>{engine.id.replaceAll("-"," ").toUpperCase()}</b><small>{engine.question}</small></div>
              <Bubble active={engine.canonicalAuthority}>{engine.status.toUpperCase()}</Bubble>
            </article>
          ))}
        </div>
      </Deck>

      <Deck>
        <DeckHeader eyebrow={shadowEngines.length} title="SHADOW / LAB ENGINES" action={<Bubble>NO CANONICAL WRITES</Bubble>} />
        <div className="engineLedger">
          {shadowEngines.map((engine) => (
            <article key={engine.id}>
              <div><span>{engine.system.toUpperCase()}</span><b>{engine.id.replaceAll("-"," ").toUpperCase()}</b><small>{engine.question}</small></div>
              <Bubble active={engine.status.includes("active")}>{engine.status.toUpperCase()}</Bubble>
            </article>
          ))}
        </div>
      </Deck>

      <section className="systemPair">
        <Deck>
          <DeckHeader eyebrow={runtimeTime(assist.generatedAt)} title="ASSIST BUS" action={<Bubble active={assist.active > 0}>{assist.active} ACTIVE</Bubble>} />
          <div className="readoutList">
            <div><span>TOTAL CANDIDATES</span><b>{assist.total}</b></div>
            <div><span>ACTIVE</span><b>{assist.active}</b></div>
            <div><span>CAPACITY QUEUED</span><b>{assist.queued ?? 0}</b></div>
            <div><span>DORMANT</span><b>{assist.dormant}</b></div>
          </div>
          <div className="ledgerMiniList">
            {assist.requests.filter((r) => r.status === "active").slice(0,8).map((request) => (
              <div key={request.requestId}><b>{request.ticker}</b><span>{request.rootOwner.replaceAll("-"," ")} → {request.helperRole.replaceAll("-"," ")}</span><small>{request.capability.replaceAll("-"," ")}</small></div>
            ))}
          </div>
        </Deck>

        <Deck>
          <DeckHeader eyebrow={runtimeTime(allocation.generatedAt)} title="VALUE ALLOCATION" action={<Bubble active>{allocation.capacityPlan.mode.replaceAll("-"," ").toUpperCase()}</Bubble>} />
          <div className="capacityRail">
            <div><span>CLOSURE</span><b>{pct(allocation.capacityPlan.closure)}</b></div>
            <div><span>EXPANSION</span><b>{pct(allocation.capacityPlan.expansion)}</b></div>
            <div><span>FUTURE / LEARNING</span><b>{pct(allocation.capacityPlan.futureLearning)}</b></div>
          </div>
          <p className="ledgerNote">{allocation.capacityPlan.rule}</p>
          <div className="ledgerMiniList">
            {allocation.top.slice(0,8).map((row) => (
              <div key={row.ticker}><b>{row.ticker}</b><span>{row.state.replaceAll("_"," ")}</span><small>ATTENTION {row.priority.toFixed(1)} · {row.failures.length} OPEN GATES</small></div>
            ))}
          </div>
        </Deck>
      </section>

      <section className="systemPair">
        <Deck>
          <DeckHeader eyebrow={calibration.calibrationVersion} title="CALIBRATION SHADOW" action={<Bubble active={calibration.canonicalRecordsPassingContract === calibration.canonicalRecordsAudited}>{calibration.canonicalRecordsPassingContract}/{calibration.canonicalRecordsAudited}</Bubble>} />
          <div className="ledgerMiniList">
            {calibration.frontierGuidance.map((row) => (
              <div key={row.ticker}><b>{row.ticker}</b><span>FRONTIER GUIDANCE</span><small>{row.missingComponents.length} SOURCE-ADDRESSED COMPONENTS STILL REQUIRED</small></div>
            ))}
          </div>
        </Deck>

        <Deck>
          <DeckHeader eyebrow={runtimeTime(dependencies.generatedAt)} title="DEPENDENCY HEALTH" action={<Bubble active={dependencies.healthy}>{dependencies.healthy ? "CLEAR" : "ATTENTION"}</Bubble>} />
          <div className="readoutList">
            <div><span>ROLE CYCLES</span><b>{dependencies.roleCycles.length}</b></div>
            <div><span>DORMANT DEADLOCKS</span><b>{dependencies.deadlocks.length}</b></div>
          </div>
          {dependencies.deadlocks.length > 0 && <div className="ledgerMiniList">{dependencies.deadlocks.slice(0,6).map((item) => <div key={item.requestId}><b>{item.ticker}</b><span>{item.reason.replaceAll("_"," ")}</span><small>{item.unlockCondition}</small></div>)}</div>}
        </Deck>
      </section>

      <Deck>
        <DeckHeader eyebrow={learning.activeLessons.length} title="OPERATIONAL LEARNING" action={<Bubble active={metrics.healthy}>{metrics.healthy ? "HEALTHY" : "LEARNING"}</Bubble>} />
        <div className="learningLedger">
          {learning.activeLessons.map((lesson) => (
            <article key={lesson.signature}>
              <span>{lesson.signature.replaceAll("_"," ").toUpperCase()}</span>
              <b>{lesson.symptom}</b>
              <p>{lesson.correctiveAction}</p>
              <small>SUCCESS: {lesson.successSignal}</small>
            </article>
          ))}
        </div>
      </Deck>

      {(metrics.healthAlerts?.length ?? 0) > 0 && (
        <Deck>
          <DeckHeader eyebrow={metrics.healthAlerts?.length ?? 0} title="CURRENT ATTENTION" action={<Bubble>NOT HIDDEN</Bubble>} />
          <div className="ledgerMiniList">{metrics.healthAlerts?.map((alert) => <div key={alert}><b>WORKGRAPH</b><span>{alert.replaceAll("_"," ").replaceAll(":"," · ")}</span></div>)}</div>
        </Deck>
      )}

      <Deck className="compactDeck">
        <DeckHeader eyebrow="SOURCE OF TRUTH" title="GITHUB-NATIVE CONTROL PLANE" action={<Link className="textAction" href="/system">SYSTEM ↗</Link>} />
      </Deck>
    </Screen>
  );
}
