import { createHash } from "node:crypto";

// Source observations are not underwriting evidence. This produces an audit
// signal only: no worker reactivation, no score writes, no materiality decision.
const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function accessionMap(observation) {
  const map = new Map();
  for (const filing of observation?.filings || []) {
    const number = typeof filing?.accessionNumber === "string" ? filing.accessionNumber.trim() : "";
    if (number) map.set(number, {
      accessionNumber: number,
      form: filing.form || null,
      filingDate: filing.filingDate || null,
      reportDate: filing.reportDate || null,
    });
  }
  return map;
}

export function auditObservedFilingChanges(previous, current, asOf) {
  if (!Number.isFinite(Date.parse(asOf || ""))) throw new Error("Invalid source-change audit time");
  if (!current || !current.candidates || typeof current.candidates !== "object")
    throw new Error("Current company observations are required");
  const previousRows = previous?.candidates && typeof previous.candidates === "object"
    ? previous.candidates : {};
  const changes = [];
  const summary = {
    unchanged: 0,
    changedWithAddedAccessions: 0,
    changedWithoutAddedAccessions: 0,
    initialOrUntrustedBaseline: 0,
    recoveredObservation: 0,
    retrievalFailed: 0,
    fingerprintMismatch: 0,
  };
  for (const ticker of Object.keys(current.candidates).sort()) {
    const before = previousRows[ticker] || null;
    const after = current.candidates[ticker] || {};
    const priorTrusted = before?.status === "observed" && typeof before.filingFingerprint === "string"
      && before.filingFingerprint.length > 0;
    const currentTrusted = after?.status === "observed" && typeof after.filingFingerprint === "string"
      && after.filingFingerprint.length > 0;
    let classification;
    let added = [], removed = [], fingerprintChanged = false;
    if (!currentTrusted) {
      classification = "retrieval_failed_or_unverified";
      summary.retrievalFailed++;
    } else if (!priorTrusted) {
      classification = before ? "observation_recovered_without_comparable_prior" : "initial_observation";
      summary[before ? "recoveredObservation" : "initialOrUntrustedBaseline"]++;
    } else {
      const beforeAccessions = accessionMap(before);
      const afterAccessions = accessionMap(after);
      added = [...afterAccessions.values()].filter(x => !beforeAccessions.has(x.accessionNumber));
      removed = [...beforeAccessions.keys()].filter(x => !afterAccessions.has(x));
      fingerprintChanged = before.filingFingerprint !== after.filingFingerprint;
      if (added.length && fingerprintChanged) {
        classification = "observed_window_new_accessions";
        summary.changedWithAddedAccessions++;
      } else if (fingerprintChanged) {
        classification = "window_changed_without_new_accession";
        summary.changedWithoutAddedAccessions++;
      } else {
        classification = "unchanged";
        summary.unchanged++;
      }
      if (!fingerprintChanged && (added.length || removed.length)) summary.fingerprintMismatch++;
    }
    if (classification !== "unchanged") changes.push({
      ticker,
      status: classification,
      previousFingerprint: priorTrusted ? before.filingFingerprint : null,
      currentFingerprint: currentTrusted ? after.filingFingerprint : null,
      priorStatus: before?.status || null,
      currentStatus: after.status || null,
      addedAccessions: added,
      droppedFromWindow: removed,
      sourceUrl: currentTrusted ? after.sourceUrl || null : null,
      reviewStatus: "not_a_materiality_or_new_filing_date_determination",
      actionableWithoutIndependentReview: false,
    });
  }
  const total = Object.keys(current.candidates).length;
  return {
    version: 1,
    contract: "earth2036-source-delta-observation-audit-v1",
    generatedAt: asOf,
    previousCycleAt: previous?.capturedAt || null,
    currentCycleAt: current.capturedAt || null,
    scope: "current SEC submissions rolling recent-filing window (may be truncated)",
    authority: {
      observationOnly: true,
      workerActivation: false,
      evidenceDisposition: false,
      scoreWrites: false,
      canonicalPromotion: false,
      trialTickQualification: false,
    },
    caveat: "Accessions newly visible within a capped SEC window are not proven newly filed since the previous cycle. Missing accessions may be truncation. No automatic retry, source assertion or worker restart follows this report.",
    companiesChecked: total,
    summary,
    changes,
    fingerprint: sha(changes.map(x => [x.ticker,x.status,x.previousFingerprint,x.currentFingerprint,x.addedAccessions.map(a=>a.accessionNumber)])),
  };
}
