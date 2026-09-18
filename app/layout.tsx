import type { Metadata } from "next";
import EarthShell from "./components/EarthShell";
import runtimeState from "../data/runtime/system-state.json";
import "./globals.css";
import "./interaction.css";
import "./adaptive-type.css";

export const metadata: Metadata = {
  title: "Earth 2036",
  description: "Autonomous future-tech intelligence system",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <EarthShell
          cycleKey={runtimeState.cycleKey ?? null}
          phase={runtimeState.phase}
          lastCycleAt={runtimeState.lastCycleAt ?? null}
        >
          {children}
        </EarthShell>
      </body>
    </html>
  );
}
