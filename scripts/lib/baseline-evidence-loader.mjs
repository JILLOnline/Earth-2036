import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function walkJsonFiles(dir) {
  const files = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return files;
    throw error;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(full);
  }
  return files.sort();
}

export async function loadBaselineEvidence(root) {
  const evidenceDir = path.join(root, "data", "baseline-evidence");
  const files = await walkJsonFiles(evidenceDir);
  const candidates = {};
  const errors = [];

  for (const file of files) {
    try {
      const record = await readJson(file);
      if (!record?.ticker || record?.methodologyVersion !== "1.0.0") continue;
      const ticker = String(record.ticker).trim().toUpperCase();
      const existing = candidates[ticker];
      const existingTime = Date.parse(existing?.updatedAt ?? 0) || 0;
      const nextTime = Date.parse(record.updatedAt ?? 0) || 0;
      if (!existing || nextTime >= existingTime) candidates[ticker] = record;
    } catch (error) {
      errors.push({ file: path.relative(root, file), error: String(error?.message ?? error) });
    }
  }

  return {
    evidenceDir,
    filesScanned: files.length,
    candidateCount: Object.keys(candidates).length,
    candidates,
    errors,
  };
}

export function mergeScoreState(runtimeScoreState, evidence) {
  return {
    version: 1,
    methodologyVersion: "1.0.0",
    updatedAt: new Date().toISOString(),
    candidates: {
      ...(runtimeScoreState?.candidates ?? {}),
      ...(evidence?.candidates ?? {}),
    },
    evidenceLoader: {
      filesScanned: evidence?.filesScanned ?? 0,
      candidateCount: evidence?.candidateCount ?? 0,
      errors: evidence?.errors ?? [],
    },
  };
}
