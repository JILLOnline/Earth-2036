#!/usr/bin/env node
// Independent, append-only operational audit of the PREVIOUS UTC hourly slot.
// This is observational telemetry: it cannot score, promote, publish or qualify ticks.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const keyPattern = /^\d{8}T\d{2}00Z$/;

export function hourKeyFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('Invalid UTC date');
  return date.toISOString().slice(0, 13).replace(/[-:]/g, '') + '00Z';
}

export function previousHourKey(now = new Date()) {
  return hourKeyFromDate(new Date(now.getTime() - 60 * 60 * 1000));
}

export function hourStart(hourKey) {
  if (!keyPattern.test(hourKey)) throw new Error('Invalid canonical UTC hourly slot');
  const iso = hourKey.slice(0, 4) + '-' + hourKey.slice(4, 6) + '-' + hourKey.slice(6, 8) +
    'T' + hourKey.slice(9, 11) + ':00:00.000Z';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || hourKeyFromDate(date) !== hourKey) throw new Error('Nonexistent UTC hourly slot');
  return date;
}

export function parseCycleHistory(content) {
  return String(content).split(/\r?\n/).filter(Boolean).map((line, index) => {
    let parsed;
    try { parsed = JSON.parse(line); }
    catch { throw new Error('Invalid cycle-history JSON on line ' + (index + 1)); }
    if (!parsed || typeof parsed.cycleKey !== 'string') throw new Error('Cycle-history key missing at line ' + (index + 1));
    return { record: parsed, raw: line, lineNumber: index + 1 };
  });
}

export function assessHour({ hourKey, cycleHistory, workflowRuns, checkedAt, runLookupError = null }) {
  const start = hourStart(hourKey);
  const audited = new Date(checkedAt);
  if (Number.isNaN(audited.getTime()) || audited.getTime() < start.getTime() + 3600000)
    throw new Error('Hourly audit may only assess a completed UTC slot');
  const end = new Date(start.getTime() + 3600000);
  const matches = cycleHistory.filter(x => x.record.cycleKey === hourKey);
  const selected = matches.at(-1) || null;
  const record = selected?.record || null;
  const runs = workflowRuns.filter(run => {
    if (!run || run.path !== '.github/workflows/earth2036-scheduler.yml') return false;
    const ts = new Date(run.created_at).getTime();
    return Number.isFinite(ts) && ts >= start.getTime() && ts < end.getTime();
  }).map(run => ({
    id: run.id, event: run.event, status: run.status, conclusion: run.conclusion ?? null,
    createdAt: run.created_at, startedAt: run.run_started_at ?? null, completedAt: run.updated_at ?? null,
    attempt: run.run_attempt ?? 1, sha: run.head_sha ?? null,
    url: run.html_url ?? null
  }));
  const observation = record ? {
    cycleKey: record.cycleKey,
    observedAt: record.lastCycleAt ?? null,
    cycleStatus: record.cycleStatus ?? null,
    expected: record.companiesExpected ?? null,
    observed: record.companiesObserved ?? null,
    identityValidated: record.identityValidated ?? null,
    tradabilityValidated: record.tradabilityValidated ?? null,
    scored: record.scoredCompanies ?? null,
    publishable: record.publishableCompanies ?? null,
    sourceCoverage: record.combinedSourceCoverageRatio ?? null,
    discoveryCompleted: record.discoveryScanCompleted === true,
    unresolvedEvidence: record.unresolvedEvidence ?? null,
    phase: record.phase ?? null,
    qualifiedTrialTick: record.qualifiedTick === true,
    qualifiedTrialCount: record.qualifiedTrialTicks ?? null,
    sourceLine: selected.lineNumber,
    sourceLineSha256: createHash('sha256').update(selected.raw).digest('hex')
  } : null;
  const issues = [];
  if (!record) issues.push('no_persisted_observation_for_hour_as_of_audit');
  if (matches.length > 1) issues.push('duplicate_cycle_history_hour_key');
  if (runLookupError) issues.push('scheduler_run_lookup_unavailable');
  else {
    if (runs.length === 0) issues.push('no_scheduler_run_created_in_slot');
    if (runs.some(run => run.conclusion === 'failure' || run.conclusion === 'timed_out'))
      issues.push('scheduler_failed_or_timed_out');
  }
  if (record && record.cycleStatus !== 'completed') issues.push('partial_machine_observation');
  if (record && record.phase === 'trial' && !record.qualifiedTick) issues.push('trial_hour_not_qualified');
  return {
    contract: 'earth2036-hourly-accountability-v1',
    status: 'as_of_audit_snapshot',
    governance: {canonicalWrites:false, scoreWrites:false, qualifyTicks:false, reconstructMissingObservations:false},
    hourKey, hourStart: start.toISOString(), hourEndExclusive: end.toISOString(),
    auditedAt: audited.toISOString(),
    observationStatus: record ? 'persisted' : 'missing_as_of_audit',
    observation,
    schedulerLookup: runLookupError ? {status:'unavailable', error:String(runLookupError).slice(0,500)} : {status:'available', observedRuns:runs.length},
    schedulerRunsCreatedInHour: runs,
    issues,
    caveat: 'A missing hourly observation does not prove the scheduler did not execute; a delayed or failed persistence attempt may have occurred. This receipt is an as-of audit, not a backfilled machine observation.'
  };
}

export function auditReceiptPath(hourKey) {
  const date=hourStart(hourKey);
  const iso=date.toISOString().slice(0,10).replace(/-/g,'/');
  return path.join('data','operations','hourly-audits',iso,hourKey+'.json');
}

async function main() {
  const hourKey = process.env.EARTH_AUDIT_HOUR_KEY || previousHourKey();
  const now = new Date();
  const filename = path.join(ROOT, auditReceiptPath(hourKey));
  try { await readFile(filename, 'utf8'); console.log('Existing immutable hourly receipt: '+filename); return; }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const historyText = await readFile(path.join(ROOT,'data/runtime/cycle-history.jsonl'), 'utf8');
  const cycles = parseCycleHistory(historyText);
  let runs = [], runLookupError=null;
  try {
    const repository = process.env.GITHUB_REPOSITORY || 'JILLOnline/Earth-2036';
    // Request only run fields needed for accountability; large raw Actions API responses
    // exceed execFileSync's default 1MB stdout buffer (observed live 2026-10-09).
    const fields='[.workflow_runs[] | {id, path, created_at, run_started_at, updated_at, event, status, conclusion, run_attempt, head_sha, html_url}]';
    const out = execFileSync('gh', [
      'api', 'repos/'+repository+'/actions/workflows/earth2036-scheduler.yml/runs?per_page=100',
      '--jq', fields
    ], {encoding:'utf8', timeout:30000, maxBuffer:16*1024*1024});
    const response = JSON.parse(out);
    if (!Array.isArray(response)) throw new Error('GitHub Actions scheduler run projection must be an array');
    runs=response;
  } catch(e) { runLookupError=e.message; }
  const receipt=assessHour({hourKey,cycleHistory:cycles,workflowRuns:runs,checkedAt:now.toISOString(),runLookupError});
  await mkdir(path.dirname(filename), {recursive:true});
  await writeFile(filename, JSON.stringify(receipt,null,2)+'\n', {flag:'wx'});
  console.log(JSON.stringify({hourKey,path:auditReceiptPath(hourKey),status:receipt.observationStatus,issues:receipt.issues},null,2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e=>{console.error(e);process.exitCode=1});
}
