"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import decisionIndexJson from "../../data/decisions/index.json";
import systemStateJson from "../../data/runtime/system-state.json";
import { liveRankingOfficial, liveUniverse, liveUniverseByTicker, liveUniverseSummary, type LiveUniverseRow } from "../../lib/live-universe";
import { Bubble, Deck, Screen, ScreenHeader } from "../components/Display";

type View = "LIVE" | "CHAMPIONSHIP" | "CONTENDERS" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
type DecisionSelection = { ticker: string; company?: string; rank?: number | null; earthScore?: number | null; dataConfidence?: number | null; risk?: number | null; exchange?: string | null; division?: string | null; entityState?: string | null; actionState?: string | null; reason?: string | null; selectedAt?: string | null };
type DecisionBucket = { status: string; periodId: string | null; asOf: string | null; selections: DecisionSelection[] };
type DecisionIndex = { t0Published: boolean; liveRankingOfficial: boolean; weekly: DecisionBucket; monthly: DecisionBucket; quarterly: DecisionBucket; annual: DecisionBucket };
type DisplayRow = { ticker: string; company: string; exchange: string | null; division: string | null; rank: number | null; earthScore: number | null; dataConfidence: number | null; risk: number | null; cohort: string | null; state: string; why: string; linkable: boolean; scoreStatus?: LiveUniverseRow["scoreStatus"]; officialTop3: boolean };

const decisionIndex = decisionIndexJson as unknown as DecisionIndex;
const systemState = systemStateJson as typeof systemStateJson;
const periodViews = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"] as const;
const views: Array<{ id: View; label: string }> = [
  { id: "LIVE", label: "LIVE" }, { id: "CHAMPIONSHIP", label: "CHAMPIONSHIP" }, { id: "CONTENDERS", label: "CONTENDERS" }, { id: "WEEKLY", label: "WEEKLY" }, { id: "MONTHLY", label: "MONTHLY" }, { id: "QUARTERLY", label: "QUARTERLY" }, { id: "ANNUAL", label: "ANNUAL" },
];
const FIRST_BATCH = 10;
const SECOND_BATCH = 50;

function bucketFor(view: View): DecisionBucket | null {
  if (view === "WEEKLY") return decisionIndex.weekly;
  if (view === "MONTHLY") return decisionIndex.monthly;
  if (view === "QUARTERLY") return decisionIndex.quarterly;
  if (view === "ANNUAL") return decisionIndex.annual;
  return null;
}
function highestFrozen(ticker: string) {
  for (const view of [...periodViews].reverse()) {
    const selection = bucketFor(view)?.selections.find((item) => item.ticker === ticker);
    if (selection) return { view, selection };
  }
  return null;
}
function liveWhy(row: LiveUniverseRow) {
  const frozen = highestFrozen(row.ticker);
  if (frozen?.selection.reason) return frozen.selection.reason;
  if (!liveRankingOfficial) {
    if (row.scoreStatus === "publishable") return "Publishable methodology-1.0 workbench record, but T0 has not frozen an official rank yet.";
    if (row.scoreStatus === "scored") return "Scored in the T0 workbench, but not yet publishable under the full official baseline gate.";
    return "Active T0 baseline member awaiting a publishable methodology-1.0 record. No official rank exists yet.";
  }
  if (row.officialRank && row.officialRank <= 10) return `Official live rank #${row.officialRank} places this company on the Championship Board.`;
  if (row.officialRank) return `Official live rank #${row.officialRank} places this company in Contenders.`;
  return "Active universe member without an official publishable rank.";
}
function currentRow(row: LiveUniverseRow): DisplayRow {
  const frozen = highestFrozen(row.ticker);
  const verified = row.identityStatus === "validated" && row.tradabilityStatus === "validated";
  return { ticker: row.ticker, company: row.company, exchange: row.exchange, division: row.division, rank: row.officialRank, earthScore: row.earthScore, dataConfidence: row.dataConfidence, risk: row.risk, cohort: frozen?.view ?? null, state: verified ? "VERIFIED" : "REVIEW", why: liveWhy(row), linkable: true, scoreStatus: row.scoreStatus, officialTop3: liveRankingOfficial && Boolean(row.officialRank && row.officialRank <= 3) };
}
function frozenRow(view: View, selection: DecisionSelection, bucket: DecisionBucket): DisplayRow {
  const current = liveUniverseByTicker.get(selection.ticker);
  return { ticker: selection.ticker, company: selection.company ?? selection.ticker, exchange: selection.exchange ?? null, division: selection.division ?? null, rank: selection.rank ?? null, earthScore: selection.earthScore ?? null, dataConfidence: selection.dataConfidence ?? null, risk: selection.risk ?? null, cohort: view, state: selection.entityState ?? "—", why: selection.reason ?? "", linkable: Boolean(current), officialTop3: bucket.status === "frozen" && Boolean(selection.rank && selection.rank <= 3) };
}
function readinessSort(a: DisplayRow, b: DisplayRow) {
  const order = { publishable: 0, scored: 1, pending: 2 } as const;
  const scoreOrder = order[a.scoreStatus ?? "pending"] - order[b.scoreStatus ?? "pending"];
  if (scoreOrder) return scoreOrder;
  if ((a.earthScore ?? -1) !== (b.earthScore ?? -1)) return (b.earthScore ?? -1) - (a.earthScore ?? -1);
  if ((a.dataConfidence ?? -1) !== (b.dataConfidence ?? -1)) return (b.dataConfidence ?? -1) - (a.dataConfidence ?? -1);
  if ((a.risk ?? 101) !== (b.risk ?? 101)) return (a.risk ?? 101) - (b.risk ?? 101);
  return a.ticker.localeCompare(b.ticker);
}
function viewRows(view: View): DisplayRow[] {
  if (view === "LIVE") {
    const rows = liveUniverse.map(currentRow);
    return liveRankingOfficial ? rows.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999)) : rows.sort(readinessSort);
  }
  if (view === "CHAMPIONSHIP") return liveRankingOfficial ? liveUniverse.filter((row) => row.officialRank != null && row.officialRank <= 10).map(currentRow).sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999)) : [];
  if (view === "CONTENDERS") return liveRankingOfficial ? liveUniverse.filter((row) => row.officialRank != null && row.officialRank > 10).map(currentRow).sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999)) : [];
  const bucket = bucketFor(view);
  return bucket ? bucket.selections.map((selection) => frozenRow(view, selection, bucket)).sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999)) : [];
}
function viewCount(view: View): number | null {
  if (view === "LIVE") return liveUniverseSummary.total;
  if (view === "CHAMPIONSHIP") return liveRankingOfficial ? liveUniverse.filter((row) => row.officialRank != null && row.officialRank <= 10).length : null;
  if (view === "CONTENDERS") return liveRankingOfficial ? liveUniverse.filter((row) => row.officialRank != null && row.officialRank > 10).length : null;
  const bucket = bucketFor(view);
  return bucket?.status === "frozen" ? bucket.selections.length : null;
}
function emptyMessage(view: View) {
  if ((view === "CHAMPIONSHIP" || view === "CONTENDERS") && !liveRankingOfficial) return "OPENS WHEN T0 FREEZES THE OFFICIAL LIVE RANKING";
  const bucket = bucketFor(view);
  if (bucket && bucket.status !== "frozen") return `NO OFFICIAL ${view} DECISION YET`;
  return "NO MATCHING RECORDS";
}
const number = (value: number | null) => value == null ? "—" : value.toFixed(1);

export default function UniversePage() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("LIVE");
  const [selected, setSelected] = useState<DisplayRow | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(FIRST_BATCH);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = viewRows(view);
    return needle ? source.filter((row) => [row.ticker, row.company, row.exchange ?? "", row.division ?? "", row.cohort ?? ""].join(" ").toLowerCase().includes(needle)) : source;
  }, [query, view]);
  const visibleRows = rows.slice(0, visibleLimit);
  const hasMore = visibleRows.length < rows.length;
  const nextLimit = visibleLimit <= FIRST_BATCH ? Math.min(SECOND_BATCH, rows.length) : rows.length;
  const sortMode = periodViews.includes(view as (typeof periodViews)[number]) ? (bucketFor(view)?.status === "frozen" ? "FROZEN" : "PENDING") : (liveRankingOfficial ? "OFFICIAL RANK" : "READINESS");

  function chooseView(nextView: View) {
    setView(nextView);
    setVisibleLimit(FIRST_BATCH);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setVisibleLimit(FIRST_BATCH);
  }

  function handleLoadControl() {
    if (hasMore) {
      setVisibleLimit(nextLimit);
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <Screen>
      <ScreenHeader eyebrow="UNIVERSE" title={<>{liveUniverseSummary.total} <em>ACTIVE</em></>} stats={[{ label: "VERIFIED", value: liveUniverseSummary.verified }, { label: "PUBLISHABLE", value: liveUniverseSummary.publishable }, { label: "RANKING", value: liveRankingOfficial ? "OFFICIAL" : "PENDING" }]} />

      <Deck className="controlDeck">
        <div className="universeControls">
          <div className="segmentRail">
            {views.map((item) => { const count = viewCount(item.id); return <button type="button" key={item.id} onClick={() => chooseView(item.id)} className={`segmentButton ${view === item.id ? "segmentButtonActive" : ""}`}><span>{item.label}</span><b>{count ?? "—"}</b></button>; })}
          </div>
          <div className="searchRow">
            <input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="SEARCH TICKER OR COMPANY" aria-label="Search universe" />
            <div className="microReadout"><span>AUTO</span><b>{sortMode}</b></div>
            <div className="microReadout"><span>VISIBLE</span><b>{visibleRows.length} / {rows.length}</b></div>
          </div>
        </div>
      </Deck>

      <Deck>
        {rows.length ? <>
          <div className="ledgerList universeLedger">
            {visibleRows.map((row) => {
              const topClass = row.officialTop3 && row.rank === 1 ? "top1" : row.officialTop3 && row.rank === 2 ? "top2" : row.officialTop3 && row.rank === 3 ? "top3" : "";
              return <article key={`${view}-${row.ticker}-${row.rank ?? "na"}`} className={`ledgerRow universeLedgerRow ${topClass}`}>
                <div className="ledgerRank"><span>RANK</span><b>{row.rank ? `#${row.rank}` : "—"}</b></div>
                <div className="ledgerIdentity"><b>{row.ticker}</b><span>{row.company}</span></div>
                <div className="ledgerMetric"><span>EARTH</span><b className="ledgerScore">{number(row.earthScore)}</b></div>
                <div className="ledgerMetric ledgerPair"><span>CONF / RISK</span><b>{number(row.dataConfidence)} / {number(row.risk)}</b></div>
                <div className="ledgerStage"><span>STAGE</span><b>{row.cohort ?? (liveRankingOfficial ? "LIVE" : (row.scoreStatus ?? "PENDING").toUpperCase())}</b></div>
                <button type="button" className="miniAction ledgerAction" onClick={() => setSelected(row)}>DETAILS</button>
              </article>;
            })}
          </div>
          <div className="universeLoadRail">
            <button type="button" className="universeLoadButton" onClick={handleLoadControl}>{hasMore ? "SHOW MORE" : "BACK TO TOP"}</button>
            <span className="universeLoadCount">{hasMore ? `SHOWING ${visibleRows.length}–${rows.length}` : "SHOWING ALL"}</span>
          </div>
        </> : <div className="emptyState">{emptyMessage(view)}</div>}
      </Deck>

      {selected && <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
        <section className="modalPanel modalPanelWide" role="dialog" aria-modal="true" aria-label={`${selected.ticker} universe record`}>
          <header><span>UNIVERSE RECORD</span><button type="button" onClick={() => setSelected(null)}>CLOSE</button></header>
          <div className="modalBody">
            <b>{selected.ticker} · {selected.company}</b>
            <span>{selected.cohort ?? (liveRankingOfficial ? "LIVE" : systemState.phase.replaceAll("_", " ").toUpperCase())}</span>
            <div className="detailGrid">
              <div><small>RANK</small><b>{selected.rank ? `#${selected.rank}` : "—"}</b></div>
              <div><small>EARTH</small><b>{number(selected.earthScore)}</b></div>
              <div><small>CONFIDENCE</small><b>{number(selected.dataConfidence)}</b></div>
              <div><small>RISK</small><b>{number(selected.risk)}</b></div>
              <div><small>EXCHANGE</small><b>{selected.exchange ?? "—"}</b></div>
              <div><small>DIVISION</small><b>{selected.division?.replaceAll("_", " ") ?? "—"}</b></div>
              <div><small>STATE</small><b>{selected.state}</b></div>
              <div><small>COHORT</small><b>{selected.cohort ?? "—"}</b></div>
            </div>
            <div className="detailNarrative"><small>WHY</small><p>{selected.why || "No additional decision note."}</p></div>
            {selected.linkable && <Link className="miniAction modalPrimaryAction" href={`/company/${encodeURIComponent(selected.ticker)}`}>OPEN INTELLIGENCE ↗</Link>}
          </div>
        </section>
      </div>}
    </Screen>
  );
}
