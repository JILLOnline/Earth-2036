"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  cycleKey: string | null;
  phase: string;
  lastCycleAt: string | null;
  children: React.ReactNode;
};

const nav = [
  ["/", "COMMAND"],
  ["/contenders", "UNIVERSE"],
  ["/discovery", "DISCOVERY"],
  ["/system", "SYSTEM"],
  ["/ledger", "LEDGER"],
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function EarthShell({ cycleKey, phase, lastCycleAt, children }: Props) {
  const pathname = usePathname();
  return (
    <div id="earth-top" className="earthShell">
      <header className="earthHeader">
        <div className="earthHeaderInner">
          <Link className="earthBrand" href="/" aria-label="Earth 2036 command">
            <span className="earthGem" aria-hidden="true"><i /></span>
            <span className="earthWordmark"><b>EARTH</b><strong>2036</strong></span>
          </Link>

          <nav className="earthNav" aria-label="Earth 2036 primary navigation">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} data-active={isActive(pathname, href) ? "true" : "false"}>{label}</Link>
            ))}
          </nav>

          <div className="earthRuntime" title={lastCycleAt ?? "No completed machine cycle"}>
            <span>{cycleKey ?? "WAITING"}</span>
            <b>{phase.replaceAll("_", " ").toUpperCase()}</b>
          </div>
        </div>
      </header>

      <div className="earthViewport">
        {children}
      </div>

      <footer className="earthFooter">
        <span>EARTH 2036</span>
        <span>{cycleKey ?? "WAITING"}</span>
      </footer>
    </div>
  );
}
