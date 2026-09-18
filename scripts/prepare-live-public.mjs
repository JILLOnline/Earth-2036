import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public", "live");

const files = [
  ["data/runtime/system-state.json", "system-state.json"],
  ["data/runtime/source-health.json", "source-health.json"],
  ["data/runtime/automated-source-health.json", "automated-source-health.json"],
  ["data/runtime/intelligence-integrity.json", "intelligence-integrity.json"],
  ["data/runtime/evidence-review-queue.json", "evidence-review-queue.json"],
  ["data/runtime/discovery-pool.json", "discovery-pool.json"],
  ["data/runtime/score-state.json", "score-state.json"],
  ["data/runtime/current-ranking.json", "current-ranking.json"],
  ["data/runtime/company-observations.json", "company-observations.json"],
  ["data/runtime/causal-graph.json", "causal-graph.json"],
  ["data/runtime/supervisor-state.json", "supervisor-state.json"],
  ["data/baselines/earth2036-official-t0-2026-09-12/manifest.json", "baseline-manifest.json"],
];

async function main() {
  await mkdir(OUT, { recursive: true });

  for (const [source, target] of files) {
    try {
      const content = await readFile(path.join(ROOT, source), "utf8");
      await writeFile(path.join(OUT, target), content, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const systemState = JSON.parse(await readFile(path.join(ROOT, "data/runtime/system-state.json"), "utf8"));
  await writeFile(
    path.join(OUT, "build-meta.json"),
    `${JSON.stringify({
      builtAt: new Date().toISOString(),
      cycleKey: systemState.cycleKey ?? null,
      lastCycleAt: systemState.lastCycleAt ?? null,
      methodologyVersion: systemState.methodologyVersion ?? null,
      universeVersion: systemState.universeVersion ?? null,
    }, null, 2)}\n`,
    "utf8",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
