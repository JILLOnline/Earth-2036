import Link from "next/link";
import { notFound } from "next/navigation";
import observationsJson from "../../../data/runtime/company-observations.json";
import causalGraphJson from "../../../data/runtime/causal-graph.json";
import evidenceQueueJson from "../../../data/runtime/evidence-review-queue.json";
import scoreStateJson from "../../../data/runtime/score-state.json";
import { liveUniverse, liveUniverseByTicker } from "../../../lib/live-universe";
import { runtimeTime } from "../../../lib/dashboard-runtime";
import { Bubble, Deck, DeckHeader, Screen, ScreenHeader, Stat, StatRail } from "../../components/Display";
import ProgressiveList from "../../components/ProgressiveList";

type ScoreFactor = { value?: number; sourceIds?: string[]; note?: string };
type ScoreRecord = { methodologyVersion?: string; updatedAt?: string; earthScore?: number; risk?: number; dataConfidence?: number; components?: Record<string, number>; factorEvidence?: Record<string, Record<string, ScoreFactor>>; primarySourceUrls?: string[]; independentSourceUrls?: string[]; causalMapped?: boolean; evidenceTier?: string; thesis?: string; keyRisk?: string; nextCatalyst?: string };
type Observation = { observedAt?: string; status?: string; cik?: string | null; secName?: string | null; sic?: string | null; fiscalYearEnd?: string | null; sourceUrl?: string; filings?: Array<{ accessionNumber?: string | null; filingDate?: string | null; reportDate?: string | null; form?: string | null }> };
type GraphNode = { id?: string; type?: string; label?: string };
type GraphEdge = { id?: string; from?: string; to?: string; sourceNodeId?: string; targetNodeId?: string; relationship?: string; strength?: number; confidence?: number; evidenceTier?: string; sourceIds?: string[] };
type QueueItem = { id?: string; ticker?: string; status?: string };

const scoreState = scoreStateJson as unknown as { candidates: Record<string, ScoreRecord> };
const observations = observationsJson as unknown as { candidates: Record<string, Observation> };
const graph = causalGraphJson as unknown as { nodes: GraphNode[]; edges: GraphEdge[] };
const queue = evidenceQueueJson as unknown as { items: QueueItem[] };

function pretty(key: string) { return key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim().toUpperCase(); }
export function generateStaticParams() { return liveUniverse.map((row) => ({ ticker: row.ticker })); }

export default async function CompanyPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = decodeURIComponent(rawTicker).toUpperCase();
  const row = liveUniverseByTicker.get(ticker);
  if (!row) notFound();

  const score = scoreState.candidates[ticker] ?? null;
  const observation = observations.candidates[ticker] ?? null;
  const pendingEvidence = queue.items.filter((item) => item.ticker === ticker && item.status !== "resolved");
  const node = graph.nodes.find((item) => item.type === "company" && (item.id === `company:${ticker}` || item.label?.toUpperCase().includes(ticker)));
  const edges = node?.id ? graph.edges.filter((edge) => (edge.from ?? edge.sourceNodeId) === node.id || (edge.to ?? edge.targetNodeId) === node.id) : [];
  const components = Object.entries(score?.components ?? {});
  const factors = Object.entries(score?.factorEvidence ?? {});
  const filings = observation?.filings ?? [];
  const sourceBundle = [...(score?.primarySourceUrls ?? []), ...(score?.independentSourceUrls ?? [])];

  return (
    <Screen>
      <Link href="/contenders" className="backLink">← UNIVERSE</Link>
      <ScreenHeader eyebrow={row.officialRank ? `RANK #${row.officialRank}` : row.scoreStatus.toUpperCase()} title={ticker} stats={[{ label: row.company, value: row.earthScore == null ? "—" : row.earthScore.toFixed(1) }]} />

      <StatRail>
        <Stat label="EXCHANGE" value={row.exchange ?? "—"} detail={`CIK ${row.cik ?? "—"}`} />
        <Stat label="IDENTITY" value={row.identityStatus.toUpperCase()} detail={`TRADABLE ${row.tradabilityStatus.toUpperCase()}`} />
        <Stat label="CONFIDENCE" value={row.dataConfidence == null ? "—" : row.dataConfidence.toFixed(1)} detail={score?.evidenceTier ?? "—"} />
        <Stat label="RISK" value={row.risk == null ? "—" : row.risk.toFixed(1)} detail={score?.methodologyVersion ?? "—"} />
        <Stat label="CAUSAL" value={score?.causalMapped ? "MAPPED" : "—"} detail={`${edges.length} EDGES`} />
        <Stat label="QUEUE" value={pendingEvidence.length} detail="UNRESOLVED" />
      </StatRail>

      {components.length > 0 && <Deck><DeckHeader eyebrow={runtimeTime(score?.updatedAt)} title="SCORE COMPONENTS" /><div className="componentMatrix">{components.map(([key, value]) => <div key={key}><span>{pretty(key)}</span><b>{Number(value).toFixed(1)}</b><div className="meter"><i style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }} /></div></div>)}</div></Deck>}

      {(score?.thesis || score?.keyRisk || score?.nextCatalyst) && <section className="thesisGrid">
        {score?.thesis && <Deck><div className="narrative"><span>THESIS</span><p>{score.thesis}</p></div></Deck>}
        {score?.keyRisk && <Deck><div className="narrative"><span>KEY RISK</span><p>{score.keyRisk}</p></div></Deck>}
        {score?.nextCatalyst && <Deck><div className="narrative"><span>NEXT CATALYST</span><p>{score.nextCatalyst}</p></div></Deck>}
      </section>}

      <section className="displayGrid displayGridWide">
        <Deck>
          <DeckHeader eyebrow={runtimeTime(observation?.observedAt)} title="MACHINE OBSERVATION" action={<Bubble>{observation?.status?.toUpperCase() ?? "—"}</Bubble>} />
          <div className="readoutList"><div><span>SEC NAME</span><b>{observation?.secName ?? "—"}</b></div><div><span>SIC</span><b>{observation?.sic ?? "—"}</b></div><div><span>FISCAL YEAR END</span><b>{observation?.fiscalYearEnd ?? "—"}</b></div><div><span>FILINGS STORED</span><b>{filings.length}</b></div></div>
          {observation?.sourceUrl && <a href={observation.sourceUrl} className="goldLink inlineAction" target="_blank" rel="noreferrer">SEC SUBMISSIONS ↗</a>}
        </Deck>
        <Deck>
          <DeckHeader eyebrow={edges.length} title="CAUSAL EDGES" />
          {edges.length ? <ProgressiveList className="edgeMatrix">{edges.map((edge, index) => <div key={edge.id ?? index}><b>{pretty(edge.relationship ?? "relationship")}</b><span>STRENGTH {edge.strength ?? "—"}</span><span>CONFIDENCE {edge.confidence ?? "—"}</span><small>{edge.sourceIds?.join(" · ") ?? ""}</small></div>)}</ProgressiveList> : <div className="empty">NO CAUSAL EDGES</div>}
        </Deck>
      </section>

      {factors.length > 0 && <Deck><DeckHeader eyebrow={factors.length} title="RUBRIC EVIDENCE" /><ProgressiveList className="factorMatrix">{factors.map(([component, group]) => <details key={component}><summary>{pretty(component)}</summary><ProgressiveList className="factorEvidenceGrid">{Object.entries(group).map(([factor, evidence]) => <article key={factor}><span>{pretty(factor)}</span><b>{evidence.value ?? "—"}</b>{evidence.note && <p>{evidence.note}</p>}<small>{evidence.sourceIds?.join(" · ") ?? ""}</small></article>)}</ProgressiveList></details>)}</ProgressiveList></Deck>}

      <section className="displayGrid displayGridEqual">
        <Deck><DeckHeader eyebrow={filings.length} title="RECENT FILINGS" />{filings.length ? <ProgressiveList className="filingMatrix">{filings.map((filing, index) => <div key={filing.accessionNumber ?? index}><b>{filing.form ?? "—"}</b><span>{filing.filingDate ?? "—"}</span><small>{filing.reportDate ?? ""}</small></div>)}</ProgressiveList> : <div className="empty">NO FILINGS STORED</div>}</Deck>
        <Deck><DeckHeader eyebrow={sourceBundle.length} title="SOURCE BUNDLE" />{sourceBundle.length ? <ProgressiveList className="sourceRail sourceBundle">{sourceBundle.map((url, index) => <a className="earthBubble" key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">SOURCE {index + 1} ↗</a>)}</ProgressiveList> : <div className="empty">NO SCORE SOURCES</div>}</Deck>
      </section>
    </Screen>
  );
}
