import { createHash } from "node:crypto";
import { REQUIRED_SCORE_COMPONENTS } from "./runtime-gates.mjs";

export const TRAJECTORY_CONTRACT_VERSION = "1.0.0";
export const TRAJECTORY_FEATURE_SCHEMA_VERSION = "1.0.0";
export const TRAJECTORY_HORIZONS_MONTHS = Object.freeze([12, 24, 36, 60]);

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
  );
}

function evidenceReferences(record) {
  const refs = new Set();
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const value of node) visit(value);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node.sourceIds)) {
      for (const value of node.sourceIds) if (value) refs.add(String(value));
    }
    for (const value of Object.values(node)) visit(value);
  };
  visit(record?.factorEvidence);
  visit(record?.riskEvidence);
  visit(record?.dataConfidenceEvidence);
  for (const value of record?.primarySourceUrls || []) if (value) refs.add(String(value));
  for (const value of record?.independentSourceUrls || []) if (value) refs.add(String(value));
  return [...refs].sort();
}

export function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

export function trajectoryHash(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function addUtcMonths(iso, months) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid trajectory asOf: ${iso}`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString();
}

export function buildTrajectoryFeatureRow(record, observation = null, workgraphRow = null) {
  const components = Object.fromEntries(
    REQUIRED_SCORE_COMPONENTS.map((key) => [
      key,
      finiteOrNull(record?.[key] ?? record?.components?.[key])
    ])
  );

  const sourceRefs = evidenceReferences(record);
  const featureCore = {
    ticker: record?.ticker ?? null,
    rank: finiteOrNull(record?.rank),
    rankClass: record?.rankClass ?? null,
    earthScore: finiteOrNull(record?.earthScore),
    risk: finiteOrNull(record?.risk),
    dataConfidence: finiteOrNull(record?.dataConfidence),
    components,
    scoreBreakdown: {
      rawWeightedScore: finiteOrNull(record?.scoreBreakdown?.rawWeightedScore),
      confidenceMultiplier: finiteOrNull(record?.scoreBreakdown?.confidenceMultiplier),
      riskPenalty: finiteOrNull(record?.scoreBreakdown?.riskPenalty),
    },
    evidenceState: {
      sourceRefCount: sourceRefs.length,
      sourceRefsHash: trajectoryHash(sourceRefs),
      primarySourceCount: Array.isArray(record?.primarySourceUrls) ? record.primarySourceUrls.filter(Boolean).length : 0,
      independentSourceCount: Array.isArray(record?.independentSourceUrls) ? record.independentSourceUrls.filter(Boolean).length : 0,
      causalMapped: record?.causalMapped === true,
    },
  };

  const requiredNumeric = [
    featureCore.earthScore,
    featureCore.risk,
    featureCore.dataConfidence,
    ...Object.values(components),
  ];
  const missingFeatures = [];
  if (!featureCore.ticker) missingFeatures.push("ticker");
  if (featureCore.earthScore == null) missingFeatures.push("earthScore");
  if (featureCore.risk == null) missingFeatures.push("risk");
  if (featureCore.dataConfidence == null) missingFeatures.push("dataConfidence");
  for (const [key, value] of Object.entries(components)) {
    if (value == null) missingFeatures.push(`component:${key}`);
  }

  const provenance = {
    methodologyVersion: record?.methodologyVersion ?? record?.scoreBreakdown?.methodologyVersion ?? null,
    scoreFormulaHash: record?.scoreContract?.formulaHash ?? null,
    filingFingerprint: observation?.filingFingerprint ?? null,
    workId: workgraphRow?.workId ?? null,
    workgraphState: workgraphRow?.state ?? null,
    workgraphEvidencePath: workgraphRow?.evidencePath ?? null,
    workgraphUpdatedAt: workgraphRow?.updatedAt ?? null,
    featureHash: trajectoryHash(featureCore),
  };

  return {
    ...featureCore,
    featureComplete: missingFeatures.length === 0 && requiredNumeric.every(Number.isFinite),
    missingFeatures,
    provenance,
  };
}

export function buildTrajectorySnapshot({
  rankings,
  observations = {},
  workgraphCompanies = {},
  asOf,
  generatedAt = asOf,
  methodologyVersion = null,
  universeVersion = null,
  trialTickNumber = null,
}) {
  const asOfDate = new Date(asOf);
  if (Number.isNaN(asOfDate.getTime())) throw new Error(`Invalid trajectory asOf: ${asOf}`);

  const rows = (Array.isArray(rankings) ? rankings : [])
    .map((record) => buildTrajectoryFeatureRow(
      record,
      observations?.[record?.ticker] ?? null,
      workgraphCompanies?.[record?.ticker] ?? null
    ))
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || String(a.ticker).localeCompare(String(b.ticker)));

  const base = {
    version: 1,
    contract: "earth2036-trajectory-shadow-v1",
    contractVersion: TRAJECTORY_CONTRACT_VERSION,
    featureSchemaVersion: TRAJECTORY_FEATURE_SCHEMA_VERSION,
    canonicalWriteAuthority: false,
    pointInTimeOnly: true,
    futureLeakageForbidden: true,
    placeholderForecastsAllowed: false,
    generatedAt,
    asOf,
    sourceCutoff: asOf,
    methodologyVersion,
    universeVersion,
    trialTickNumber,
    horizons: TRAJECTORY_HORIZONS_MONTHS.map((months) => ({
      months,
      targetAt: addUtcMonths(asOf, months),
      outcomeStatus: "pending",
      outcomeContract: "earth2036-trajectory-outcome-v1",
    })),
    records: rows.length,
    completeRecords: rows.filter((row) => row.featureComplete).length,
    incompleteRecords: rows.filter((row) => !row.featureComplete).length,
    rows,
  };

  return { ...base, snapshotHash: trajectoryHash(base) };
}

export function validateTrajectorySnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== "object") return ["trajectory snapshot missing"];
  if (snapshot.canonicalWriteAuthority !== false) errors.push("trajectory must never have canonical write authority");
  if (snapshot.pointInTimeOnly !== true) errors.push("trajectory must be point-in-time only");
  if (snapshot.futureLeakageForbidden !== true) errors.push("future leakage must be forbidden");
  if (snapshot.placeholderForecastsAllowed !== false) errors.push("placeholder forecasts must be forbidden");

  const asOfMs = Date.parse(snapshot.asOf || "");
  const cutoffMs = Date.parse(snapshot.sourceCutoff || "");
  if (!Number.isFinite(asOfMs)) errors.push("invalid snapshot asOf");
  if (!Number.isFinite(cutoffMs)) errors.push("invalid source cutoff");
  if (Number.isFinite(asOfMs) && Number.isFinite(cutoffMs) && cutoffMs > asOfMs) {
    errors.push("source cutoff exceeds snapshot asOf");
  }

  const seen = new Set();
  for (const row of snapshot.rows || []) {
    if (!row?.ticker) errors.push("trajectory row missing ticker");
    if (seen.has(row?.ticker)) errors.push(`duplicate trajectory ticker ${row?.ticker}`);
    seen.add(row?.ticker);
    if (row?.featureComplete !== true) {
      errors.push(`incomplete trajectory features for ${row?.ticker || "unknown"}: ${(row?.missingFeatures || []).join(",")}`);
    }
    if (row?.forecast != null || row?.probability != null || row?.probabilities != null) {
      errors.push(`placeholder/live forecast fields are not allowed in capture row ${row?.ticker || "unknown"}`);
    }
    const featureHash = row?.provenance?.featureHash;
    const featureCore = {
      ticker: row?.ticker ?? null,
      rank: row?.rank ?? null,
      rankClass: row?.rankClass ?? null,
      earthScore: row?.earthScore ?? null,
      risk: row?.risk ?? null,
      dataConfidence: row?.dataConfidence ?? null,
      components: row?.components ?? {},
      scoreBreakdown: row?.scoreBreakdown ?? {},
      evidenceState: row?.evidenceState ?? {},
    };
    if (!featureHash || featureHash !== trajectoryHash(featureCore)) {
      errors.push(`trajectory feature hash mismatch for ${row?.ticker || "unknown"}`);
    }
  }

  for (const horizon of snapshot.horizons || []) {
    const targetMs = Date.parse(horizon?.targetAt || "");
    if (!Number.isFinite(targetMs) || (Number.isFinite(asOfMs) && targetMs <= asOfMs)) {
      errors.push(`invalid future outcome target for ${horizon?.months ?? "unknown"} months`);
    }
    if (horizon?.outcomeStatus !== "pending") errors.push("new trajectory snapshot outcome must start pending");
  }

  if (snapshot.records !== (snapshot.rows || []).length) errors.push("trajectory record count mismatch");
  if (snapshot.completeRecords + snapshot.incompleteRecords !== snapshot.records) errors.push("trajectory completeness count mismatch");

  const { snapshotHash, validation, captureRole, mode, note, ...hashable } = snapshot;
  if (!snapshotHash || snapshotHash !== trajectoryHash(hashable)) errors.push("trajectory snapshot hash mismatch");
  return errors;
}
