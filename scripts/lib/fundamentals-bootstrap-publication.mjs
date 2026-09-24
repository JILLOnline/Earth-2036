import { truthHash } from "./sec-fundamentals-truth.mjs";
import { verifyBridgeIndex } from "./fundamentals-bridge-index.mjs";
import { fundamentalsBridgeHealth } from "./fundamentals-trajectory-bridge.mjs";

const HASH = /^[a-f0-9]{64}$/;

export function sourceArchiveEntries(cacheManifest = {}) {
  return Object.entries(cacheManifest?.companies || {})
    .filter(([ticker, row]) => ticker && row?.cik && row?.payloadHash && row?.archivePath)
    .map(([ticker, row]) => ({
      ticker,
      cik: String(row.cik).padStart(10, "0"),
      filingFingerprint: row.filingFingerprint ?? null,
      sourcePayloadHash: row.payloadHash,
      archivePath: row.archivePath,
      lastRawFactsHash: row.lastRawFactsHash ?? null,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function sourceSetHash(cacheManifest = {}) {
  return truthHash(sourceArchiveEntries(cacheManifest));
}

export function buildSourceArchiveManifest({
  asOf,
  index,
  cacheManifest,
  releaseTag,
  assetName,
  archiveSha256,
  bulkZipSha256,
  sourceUrl,
  generatedAt = new Date().toISOString(),
}) {
  const entries = sourceArchiveEntries(cacheManifest);
  return {
    version: 1,
    contract: "earth2036-fundamentals-source-archive-v1",
    system: "shadow",
    canonicalWriteAuthority: false,
    asOf,
    generatedAt,
    source: "SEC_COMPANY_FACTS",
    sourceUrl,
    sourceSetHash: truthHash(entries),
    indexHash: index?.indexHash ?? null,
    releaseTag,
    assetName,
    archiveSha256,
    bulkZipSha256: bulkZipSha256 ?? null,
    entries,
  };
}

export function validateBootstrapPublication({
  index,
  health,
  archiveManifest,
  registry,
  observations,
}) {
  const errors = [];
  const expectedRows = (registry?.candidates || []).filter((row) => row?.ticker && row?.cik);
  const expectedTickers = expectedRows.map((row) => row.ticker).sort();
  const expected = Number(registry?.expected || expectedRows.length);
  if (expectedRows.length !== expected) errors.push(`registry_expected_mismatch:${expectedRows.length}/${expected}`);
  if (!index || index.contract !== "earth2036-fundamentals-bridge-index-v1") errors.push("bridge_index_contract_invalid");
  if (index?.system !== "shadow" || index?.canonicalWriteAuthority !== false || index?.trialEligible !== false || index?.mode !== "live-shadow") {
    errors.push("bridge_index_authority_invalid");
  }
  if (!index?.asOf || health?.asOf !== index.asOf || archiveManifest?.asOf !== index.asOf) errors.push("bridge_cutoff_mismatch");
  const indexTickers = Object.keys(index?.entries || {}).sort();
  if (indexTickers.length !== expected || JSON.stringify(indexTickers) !== JSON.stringify(expectedTickers)) {
    errors.push(`bridge_index_universe_mismatch:${indexTickers.length}/${expected}`);
  }

  const verified = verifyBridgeIndex(index, {
    asOf: index?.asOf,
    observations: observations?.candidates || {},
    tickers: expectedTickers,
  });
  if (Object.keys(verified).length !== expected) errors.push(`bridge_verified_universe_mismatch:${Object.keys(verified).length}/${expected}`);
  const references = expectedTickers.map((ticker) => verified?.[ticker]?.reference).filter(Boolean);
  const computed = fundamentalsBridgeHealth(references);
  for (const key of ["companies", "valid", "unknown", "invalid", "rawFactsReferenced", "uniqueFactStates", "cikMismatches", "hashFailures", "projectionAuthority", "canonicalWrites"]) {
    if (Number(health?.[key] ?? -1) !== Number(computed?.[key] ?? -2)) errors.push(`health_mismatch:${key}`);
  }
  if (computed.companies !== expected) errors.push(`health_company_count:${computed.companies}/${expected}`);
  if (computed.invalid !== 0) errors.push(`invalid_bridge_references:${computed.invalid}`);
  if (Number(health?.futureLeakage || 0) !== 0) errors.push(`future_leakage:${health.futureLeakage}`);
  if (computed.cikMismatches !== 0) errors.push(`cik_mismatches:${computed.cikMismatches}`);
  if (computed.hashFailures !== 0) errors.push(`hash_failures:${computed.hashFailures}`);
  if (computed.projectionAuthority !== 0 || computed.canonicalWrites !== 0) errors.push("authority_leakage");
  if (health?.canonicalWriteAuthority !== false) errors.push("health_canonical_authority_invalid");

  if (archiveManifest?.contract !== "earth2036-fundamentals-source-archive-v1" ||
      archiveManifest?.system !== "shadow" || archiveManifest?.canonicalWriteAuthority !== false) {
    errors.push("source_archive_contract_invalid");
  }
  if (!archiveManifest?.releaseTag || !archiveManifest?.assetName) errors.push("source_archive_release_pointer_missing");
  if (!HASH.test(archiveManifest?.archiveSha256 || "")) errors.push("source_archive_hash_invalid");
  if (archiveManifest?.bulkZipSha256 != null && !HASH.test(archiveManifest.bulkZipSha256)) errors.push("bulk_zip_hash_invalid");
  if (archiveManifest?.indexHash !== index?.indexHash) errors.push("source_archive_index_hash_mismatch");
  if (archiveManifest?.sourceSetHash !== truthHash(archiveManifest?.entries || [])) errors.push("source_set_hash_mismatch");

  const archiveByTicker = Object.fromEntries((archiveManifest?.entries || []).map((row) => [row.ticker, row]));
  for (const ticker of expectedTickers) {
    const reference = verified?.[ticker]?.reference;
    if (reference?.status !== "valid") continue;
    const archived = archiveByTicker[ticker];
    if (!archived) {
      errors.push(`valid_reference_missing_source_archive:${ticker}`);
      continue;
    }
    if (archived.cik !== reference.cik) errors.push(`source_archive_cik_mismatch:${ticker}`);
    if (archived.sourcePayloadHash !== reference.sourcePayloadHash) errors.push(`source_archive_payload_hash_mismatch:${ticker}`);
  }
  return [...new Set(errors)];
}
