import type { ReactNode } from "react";

export function Screen({ children }: { children: ReactNode }) {
  return <main className="screen">{children}</main>;
}

export function ScreenHeader({ eyebrow, title, stats, stamp }: {
  eyebrow: string;
  title: ReactNode;
  stats?: Array<{ label: string; value: ReactNode }>;
  stamp?: { label: string; value: ReactNode };
}) {
  return (
    <section className="screenHeader">
      <div className="screenHeading"><span>{eyebrow}</span><h1>{title}</h1></div>
      {stats?.length ? <div className="screenStats">{stats.map((item) => <div key={item.label}><b>{item.value}</b><span>{item.label}</span></div>)}</div> : stamp ? <div className="screenStamp"><span>{stamp.label}</span><b>{stamp.value}</b></div> : null}
    </section>
  );
}

export function StatRail({ children }: { children: ReactNode }) {
  return <section className="statRail">{children}</section>;
}

export function Stat({ label, value, detail }: { label: ReactNode; value: ReactNode; detail?: ReactNode }) {
  return <article className="stat"><span>{label}</span><strong>{value}</strong>{detail != null && <small>{detail}</small>}</article>;
}

export function Deck({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`deck${className ? ` ${className}` : ""}`}>{children}</section>;
}

export function DeckHeader({ eyebrow, title, action }: { eyebrow?: ReactNode; title: ReactNode; action?: ReactNode }) {
  return <div className="deckHeader"><div>{eyebrow != null && <span>{eyebrow}</span>}<h2>{title}</h2></div>{action != null && <div className="deckAction">{action}</div>}</div>;
}

export function Bubble({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return <span className={`earthBubble${active ? " earthBubbleActive" : ""}`}>{children}</span>;
}
