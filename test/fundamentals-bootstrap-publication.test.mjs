import test from "node:test";
import assert from "node:assert/strict";
import { createBridgeIndex } from "../scripts/lib/fundamentals-bridge-index.mjs";
import { unknownFundamentalsBridge, invalidFundamentalsBridge, fundamentalsAuditProjection, fundamentalsBridgeHealth } from "../scripts/lib/fundamentals-trajectory-bridge.mjs";
import { buildSourceArchiveManifest, sourceSetHash, validateBootstrapPublication } from "../scripts/lib/fundamentals-bootstrap-publication.mjs";

const asOf = "2026-09-24T12:29:24.022Z";
const registry = {
  expected: 2,
  candidates: [
    { ticker: "AAA", cik: "0000000001" },
    { ticker: "BBB", cik: "0000000002" },
  ],
};
const observations = {
  candidates: {
    AAA: { ticker: "AAA", cik: "0000000001" },
    BBB: { ticker: "BBB", cik: "0000000002" },
  },
};

function unknownEntry(ticker, cik) {
  const reference = unknownFundamentalsBridge({ ticker, observation: { ticker, cik }, asOf, reason: "company_facts_unavailable" });
  return { reference, auditProjection: fundamentalsAuditProjection(null, reference) };
}

test("live bootstrap publication permits explicit unknown fundamentals without poisoning the universe", () => {
  const entries = {
    AAA: unknownEntry("AAA", "0000000001"),
    BBB: unknownEntry("BBB", "0000000002"),
  };
  const index = createBridgeIndex({ asOf, entries, mode: "live-shadow", generatedAt: asOf });
  const healthBase = fundamentalsBridgeHealth(Object.values(entries).map((row) => row.reference));
  const health = {
    contract: "earth2036-fundamentals-bridge-health-v1",
    system: "shadow",
    asOf,
    generatedAt: asOf,
    ...healthBase,
    futureLeakage: 0,
    canonicalWriteAuthority: false,
  };
  const cacheManifest = { companies: {} };
  const archive = buildSourceArchiveManifest({
    asOf,
    index,
    cacheManifest,
    releaseTag: "fundamentals-source-test",
    assetName: "fundamentals-source-test.tar.gz",
    archiveSha256: "a".repeat(64),
    bulkZipSha256: "b".repeat(64),
    sourceUrl: "https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip",
    generatedAt: asOf,
  });
  assert.equal(sourceSetHash(cacheManifest), archive.sourceSetHash);
  assert.deepEqual(validateBootstrapPublication({ index, health, archiveManifest: archive, registry, observations }), []);
  assert.equal(health.unknown, 2);
  assert.equal(health.invalid, 0);
});

test("live bootstrap publication fails closed on invalid bridge references and authority leakage", () => {
  const bad = invalidFundamentalsBridge({
    ticker: "AAA", observation: observations.candidates.AAA, asOf, reasons: ["hash_mismatch"],
  });
  const entries = {
    AAA: { reference: bad, auditProjection: fundamentalsAuditProjection(null, bad) },
    BBB: unknownEntry("BBB", "0000000002"),
  };
  const index = createBridgeIndex({ asOf, entries, mode: "live-shadow", generatedAt: asOf });
  const health = {
    ...fundamentalsBridgeHealth(Object.values(entries).map((row) => row.reference)),
    contract: "earth2036-fundamentals-bridge-health-v1",
    system: "shadow",
    asOf,
    generatedAt: asOf,
    futureLeakage: 0,
    canonicalWriteAuthority: true,
  };
  const archive = buildSourceArchiveManifest({
    asOf,
    index,
    cacheManifest: { companies: {} },
    releaseTag: "fundamentals-source-test",
    assetName: "fundamentals-source-test.tar.gz",
    archiveSha256: "a".repeat(64),
    bulkZipSha256: null,
    sourceUrl: "https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip",
    generatedAt: asOf,
  });
  const errors = validateBootstrapPublication({ index, health, archiveManifest: archive, registry, observations });
  assert.ok(errors.some((value) => value.startsWith("invalid_bridge_references:")));
  assert.ok(errors.includes("health_canonical_authority_invalid"));
});
