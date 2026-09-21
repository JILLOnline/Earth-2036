"use client";

import { useState } from "react";
import discoveryPoolJson from "../../data/runtime/discovery-pool.json";
import runtimeJson from "../../data/runtime/system-state.json";
import { runtimeTime } from "../../lib/dashboard-runtime";
import { Bubble, Deck, DeckHeader, Screen, ScreenHeader } from "../components/Display";
import ProgressiveList from "../components/ProgressiveList";

type DiscoveryItem = { ticker?: string; companyName?: string; company?: string; status?: string; exchange?: string; listingStage?: string; division?: string; lane?: string; discoveredAt?: string; firstDetectedAt?: string; dataConfidence?: number; evidenceNote?: string; notes?: string; primarySourceUrls?: string[]; independentSourceUrls?: string[]; sourceUrl?: string; admissionEligible?: boolean };
const pool = discoveryPoolJson as unknown as { updatedAt?: string | null; items: DiscoveryItem[] };
const runtime = runtimeJson as typeof runtimeJson;
const display = (value?: string) => (value ?? "—").replaceAll("_", " ").toUpperCase();

function evidence(item: DiscoveryItem) {
  const unique = [...new Set([item.evidenceNote, item.notes].filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
  const full = unique.join(" ");
  if (!full) return { full: "", summary: "—" };
  const firstSentence = full.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? full;
  const source = firstSentence.length >= 48 ? firstSentence : full;
  const summary = source.length > 112 ? `${source.slice(0, 109).replace(/\s+\S*$/, "")}…` : source;
  return { full, summary };
}
function sources(item: DiscoveryItem) {
  return [...new Set([...(item.primarySourceUrls ?? []), ...(item.independentSourceUrls ?? []), ...(item.sourceUrl ? [item.sourceUrl] : [])])];
}
function sourceLabel(url: string, index: number) {
  try { return `${index + 1} · ${new URL(url).hostname.replace(/^www\./, "")}`; }
  catch { return `SOURCE ${index + 1}`; }
}

export default function DiscoveryPage() {
  const [selected, setSelected] = useState<DiscoveryItem | null>(null);
  const selectedEvidence = selected ? evidence(selected) : null;
  const selectedSources = selected ? sources(selected) : [];

  return (
    <Screen>
      <ScreenHeader eyebrow="DISCOVERY" title={<>{pool.items.length} <em>OUTSIDE</em></>} stats={[{ label: "THIS CYCLE", value: runtime.newDiscoveries }, { label: "MACHINE", value: runtime.machineDiscoveryComplete ? "YES" : "NO" }, { label: "FULL", value: runtime.discoveryScanCompleted ? "YES" : "NO" }]} />
      <Deck>
        <DeckHeader eyebrow={runtimeTime(pool.updatedAt)} title="CHALLENGERS" />
        {pool.items.length ? <ProgressiveList className="ledgerList discoveryLedger">
          {pool.items.map((item, index) => {
            const note = evidence(item);
            return <article key={`${item.ticker ?? "unknown"}-${index}`} className="ledgerRow discoveryLedgerRow">
              <div className="ledgerIdentity"><b>{item.ticker ?? "—"}</b><span>{item.companyName ?? item.company ?? "—"}</span></div>
              <div className="ledgerStage"><span>STAGE</span><b>{display(item.listingStage)}</b></div>
              <div className="ledgerMetric"><span>CONF.</span><b>{item.dataConfidence ?? "—"}</b></div>
              <div className="ledgerSummary"><span>EVIDENCE</span><b title={note.full}>{note.summary}</b></div>
              <Bubble active={item.admissionEligible}>{item.admissionEligible ? "ELIGIBLE" : "PENDING"}</Bubble>
              <button type="button" className="miniAction ledgerAction" onClick={() => setSelected(item)}>DETAILS</button>
            </article>;
          })}
        </ProgressiveList> : <div className="emptyState">NO OUTSIDE CHALLENGERS</div>}
      </Deck>

      {selected && <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
        <section className="modalPanel modalPanelWide" role="dialog" aria-modal="true" aria-label={`${selected.ticker ?? "challenger"} discovery record`}>
          <header><span>DISCOVERY RECORD</span><button type="button" onClick={() => setSelected(null)}>CLOSE</button></header>
          <div className="modalBody">
            <b>{selected.ticker ?? "—"} · {selected.companyName ?? selected.company ?? "—"}</b>
            <span>{display(selected.status)}</span>
            <div className="detailGrid">
              <div><small>EXCHANGE</small><b>{selected.exchange ?? "—"}</b></div>
              <div><small>STAGE</small><b>{display(selected.listingStage)}</b></div>
              <div><small>DIVISION</small><b>{display(selected.division)}</b></div>
              <div><small>CONFIDENCE</small><b>{selected.dataConfidence ?? "—"}</b></div>
              <div><small>DISCOVERED</small><b>{runtimeTime(selected.discoveredAt ?? selected.firstDetectedAt)}</b></div>
              <div><small>ADMISSION</small><b>{selected.admissionEligible ? "ELIGIBLE" : "PENDING"}</b></div>
            </div>
            <div className="detailNarrative"><small>EVIDENCE</small><p>{selectedEvidence?.full || "No evidence note recorded."}</p></div>
            <div className="detailSources">
              <small>SOURCES · {selectedSources.length}</small>
              {selectedSources.length ? <div className="sourceList">{selectedSources.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer"><b>{sourceLabel(url, index)}</b><span>{url}</span><i>↗</i></a>)}</div> : <p>—</p>}
            </div>
          </div>
        </section>
      </div>}
    </Screen>
  );
}
