import { readFile } from "node:fs/promises";
import { truthHash } from "./sec-fundamentals-truth.mjs";
import { invalidFundamentalsBridge, validateFundamentalsBridgeDescriptor } from "./fundamentals-trajectory-bridge.mjs";

export const BRIDGE_INDEX_CONTRACT = "earth2036-fundamentals-bridge-index-v1";

export function createBridgeIndex({ asOf, entries, generatedAt = new Date().toISOString(), mode = "live-shadow" }) {
  const base = {
    contract: BRIDGE_INDEX_CONTRACT, system: "shadow", canonicalWriteAuthority: false,
    trialEligible: false, mode, asOf, generatedAt, entries,
  };
  return { ...base, indexHash: truthHash(base) };
}

/** Malformed input must become invalid references, never truth or a tick gate. */
export function verifyBridgeIndex(index, { asOf, observations = {}, tickers = [] }) {
  const result = {};
  const named = new Set(tickers.length ? tickers : Object.keys(index?.entries ?? {}));
  if (!index || index.contract !== BRIDGE_INDEX_CONTRACT || index.asOf !== asOf ||
      index.canonicalWriteAuthority !== false || index.system !== "shadow" || index.trialEligible !== false ||
      index.mode !== "live-shadow") return result;
  const { indexHash, ...base } = index;
  const indexValid = indexHash === truthHash(base);
  for (const ticker of named) {
    const entry = index.entries?.[ticker];
    if (!entry) continue;
    const observation = observations?.[ticker] ?? null;
    const reference = entry.reference;
    const issues = indexValid
      ? validateFundamentalsBridgeDescriptor(reference, { ticker, cik: observation?.cik, asOf })
      : ["bridge_index_hash_mismatch"];
    if (issues.length) {
      result[ticker] = { reference: invalidFundamentalsBridge({ ticker, asOf, observation, reasons: issues }) };
      continue;
    }
    const auditProjection = entry.auditProjection;
    if (auditProjection?.learningEligible !== false ||
        auditProjection?.projectionHash !== (reference.status === "valid" ? reference.projectionHash : null)) {
      result[ticker] = { reference: invalidFundamentalsBridge({
        ticker, asOf, observation, reasons: ["invalid_audit_projection"],
      }) };
      continue;
    }
    result[ticker] = { reference, auditProjection };
  }
  return result;
}

export async function loadVerifiedBridgeIndex({ file, asOf, observations = {}, tickers = [] }) {
  try {
    const index = JSON.parse(await readFile(file, "utf8"));
    return verifyBridgeIndex(index, { asOf, observations, tickers });
  } catch {
    return {};
  }
}
