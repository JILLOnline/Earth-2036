import { createHash } from "node:crypto";
import { REQUIRED_SCORE_COMPONENTS } from "./runtime-gates.mjs";

export const TRAJECTORY_CONTRACT_VERSION = "1.1.0";
export const TRAJECTORY_FEATURE_SCHEMA_VERSION = "1.1.0";
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

function filingTruthState(observation) {
  const filings = Array.isArray(observation?.filings)
    ? observation.filings.map((filing) => ({
        accessionNumber: filing?.accessionNumber ?? null,
        filingDate: filing?.filingDate ?? null,
        reportDate: filing?.reportDate ?? null,
        form: filing?.form ?? null,
        primaryDocument: filing?.primaryDocument ?? null,
      }))
    : [];
  const formCounts = {};
  for (const filing of filings) {
    const form = String(filing?.form || "UNKNOWN");
    formCounts[form] = (formCounts[form] || 0) + 1;
  }
  const byFilingDate = filings
    .filter((filing) => filing?.filingDate)
    .sort((a, b) => String(b.filingDate).localeCompare(String(a.filingDate)));

  return {
    observedAt: observation?.observedAt ?? null,
    cik: observation?.cik ?? null,
    secName: observation?.secName ?? null,
    sic: observation?.sic ?? null,
    fiscalYearEnd: observation?.fiscalYearEnd ?? null,
    filingFingerprint: observation?.filingFingerprint ?? null,
    filingCount: filings.length,
    latestFilingDate: byFilingDate[0]?.filingDate ?? null,
    latestFilingForm: byFilingDate[0]?.form ?? null,
    filingForms: Object.fromEntries(Object.entries(formCounts).sort(([a],[b]) => a.localeCompare(b))),
    filingSequenceHash: trajectoryHash(filings),
    sourceUrl: observation?.sourceUrl ?? null,
  };
}

function earthAuditContext(record) {
  const components = Object.fromEntries(
    REQUIRED_SCORE_COMPONENTS.map((key) => [
      key,
      finiteOrNull(record?.[key] ?? record?.components?.[key])
    ])
  );
  return {
    learningEligible: false,
    purpose: "audit-and-methodology-comparison-only",
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
  };
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
  const ticker = record?.ticker ?? observation?.ticker ?? workgraphRow?.ticker ?? null;
  const sourceRefs = evidenceReferences(record);
  const truthState = {
    ticker,
    sec: filingTruthState(observation),
  };
  const earthContext = earthAuditContext(record);

  const missingTruth = [];
  if (!truthState.ticker) missingTruth.push("ticker");
  if (!truthState.sec.observedAt) missingTruth.push("sec.observedAt");
  if (!truthState.sec.cik) missingTruth.push("sec.cik");
  if (!truthState.sec.filingFingerprint) missingTruth.push("sec.filingFingerprint");

  const provenance = {
    learningSource: "source-backed-observation-state",
    methodologyVersion: record?.methodologyVersion ?? record?.scoreBreakdown?.methodologyVersion ?? null,
    scoreFormulaHash: record?.scoreContract?.formulaHash ?? null,
    selectedEvidenceRefCount: sourceRefs.length,
    selectedEvidenceRefsHash: trajectoryHash(sourceRefs),
    primarySourceCount: Array.isArray(record?.primarySourceUrls) ? record.primarySourceUrls.filter(Boolean).length : 0,
    independentSourceCount: Array.isArray(record?.independentSourceUrls) ? record.independentSourceUrls.filter(Boolean).length : 0,
    workId: workgraphRow?.workId ?? null,
    workgraphState: workgraphRow?.state ?? null,
    workgraphEvidencePath: workgraphRow?.evidencePath ?? null,
    workgraphUpdatedAt: workgraphRow?.updatedAt ?? null,
    truthStateHash: trajectoryHash(truthState),
    earthContextHash: trajectoryHash(earthContext),
  };

  return {
    ticker,
    truthState,
    earthContext,
    truthComplete: missingTruth.length === 0,
    missingTruth,
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
    .sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)));

  const base = {
    version: 1,
    contract: "earth2036-trajectory-shadow-v1",
    contractVersion: TRAJECTORY_CONTRACT_VERSION,
    featureSchemaVersion: TRAJECTORY_FEATURE_SCHEMA_VERSION,
    canonicalWriteAuthority: false,
    pointInTimeOnly: true,
    futureLeakageForbidden: true,
    placeholderForecastsAllowed: false,
    learningPolicy: {
      primaryTrainingInput: "truthState",
      earthContextLearningEligible: false,
      subjectiveSuccessLabelsAllowed: false,
    },
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
    truthCompleteRecords: rows.filter((row) => row.truthComplete).length,
    truthIncompleteRecords: rows.filter((row) => !row.truthComplete).length,
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
  if (snapshot?.learningPolicy?.primaryTrainingInput !== "truthState") errors.push("trajectory learner must train from truthState");
  if (snapshot?.learningPolicy?.earthContextLearningEligible !== false) errors.push("Earth context must not be learning-eligible");
  if (snapshot?.learningPolicy?.subjectiveSuccessLabelsAllowed !== false) errors.push("subjective success labels must be forbidden");

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
    if (row?.truthComplete !== true) {
      errors.push(`incomplete trajectory truth for ${row?.ticker || "unknown"}: ${(row?.missingTruth || []).join(",")}`);
    }
    if (row?.earthContext?.learningEligible !== false) {
      errors.push(`Earth context became learning-eligible for ${row?.ticker || "unknown"}`);
    }
    if (row?.forecast != null || row?.probability != null || row?.probabilities != null) {
      errors.push(`placeholder/live forecast fields are not allowed in capture row ${row?.ticker || "unknown"}`);
    }
    if (!row?.provenance?.truthStateHash || row.provenance.truthStateHash !== trajectoryHash(row?.truthState ?? {})) {
      errors.push(`trajectory truth-state hash mismatch for ${row?.ticker || "unknown"}`);
    }
    if (!row?.provenance?.earthContextHash || row.provenance.earthContextHash !== trajectoryHash(row?.earthContext ?? {})) {
      errors.push(`trajectory Earth-context hash mismatch for ${row?.ticker || "unknown"}`);
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
  if (snapshot.truthCompleteRecords + snapshot.truthIncompleteRecords !== snapshot.records) errors.push("trajectory truth completeness count mismatch");

  const { snapshotHash, validation, captureRole, mode, note, ...hashable } = snapshot;
  if (!snapshotHash || snapshotHash !== trajectoryHash(hashable)) errors.push("trajectory snapshot hash mismatch");
  return errors;
}
