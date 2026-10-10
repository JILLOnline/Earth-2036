#!/usr/bin/env node
// Read-only operator audit. Repository persistence is not task execution,
// successful source research, authenticated review or worker restart consent.
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROLES = Object.freeze([
  'earth-scout', 'council-alpha', 'council-beta', 'deep-resolver', 'chief-earth',
]);
const recent = (value, referenceMs, hours = 24) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) && time <= referenceMs &&
    (referenceMs - time) <= hours * 60 * 60 * 1000;
};
const validAtOrBefore = (value, referenceMs) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) && time <= referenceMs;
};

export async function collectWorkerReceipts(root) {
  const base = path.join(root, 'data/runtime/workgraph/receipts');
  const receipts = [];
  async function walk(dir, depth) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch (error) {
      if (error.code === 'ENOENT' && depth === 0) return;
      throw error;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth >= 2) throw new Error('worker_receipt_depth_exceeded');
        await walk(file, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        const raw = await readFile(file, 'utf8');
        let parsed;
        try { parsed = JSON.parse(raw); }
        catch { throw new Error('worker_receipt_invalid_json:' + path.relative(root, file)); }
        const role = parsed?.role || parsed?.worker;
        if (!ROLES.includes(role)) continue; // not a workforce-role receipt
        receipts.push({
          role, generatedAt: parsed.generatedAt ?? null,
          status: parsed.status ?? null, disposition: parsed.disposition ?? null,
          evidenceCommit: parsed.evidenceCommit ?? null,
          evidenceArtifactCreated: parsed.evidenceArtifactCreated ?? null,
          sourcePath: path.relative(root, file).replaceAll(path.sep, '/'),
          sourceSha256: createHash('sha256').update(raw).digest('hex'),
        });
      }
    }
  }
  await walk(base, 0);
  return receipts;
}

export function assessWorkerPersistence(metrics, receipts = [], reference = metrics?.generatedAt) {
  const referenceMs = Date.parse(reference || '');
  if (!Number.isFinite(referenceMs)) throw new Error('worker_audit_invalid_reference_time');
  if (!metrics || typeof metrics !== 'object' || !metrics.roleActivity ||
      !metrics.effectiveOwnerBacklog || !Array.isArray(receipts)) {
    throw new Error('worker_audit_missing_runtime_inputs');
  }
  const byRole = Object.fromEntries(ROLES.map(role => [role, []]));
  const excludedReceipts = [];
  for (const row of receipts) {
    if (!row || !ROLES.includes(row.role)) continue;
    if (!validAtOrBefore(row.generatedAt, referenceMs)) {
      excludedReceipts.push({ sourcePath: row.sourcePath || null, reason: 'invalid_or_future_receipt_time' });
      continue;
    }
    byRole[row.role].push(row);
  }
  const roles = ROLES.map(role => {
    const data = metrics.roleActivity[role] || {};
    const evidenceTime = validAtOrBefore(data.lastGeneratedAt, referenceMs)
      ? data.lastGeneratedAt : null;
    const runTime = validAtOrBefore(data.lastRunAt, referenceMs)
      ? data.lastRunAt : null;
    const stored = byRole[role].sort((a, b) =>
      Date.parse(b.generatedAt) - Date.parse(a.generatedAt) ||
      a.sourcePath.localeCompare(b.sourcePath));
    const latest = stored[0] || null;
    const lastReportedWriteBlocker = stored.find(item =>
      item.status === 'evidence_write_blocked' && item.evidenceCommit === 'not_committed') || null;
    const hasRecentEvidence = recent(evidenceTime, referenceMs);
    const hasRecentRoleRun = recent(runTime, referenceMs);
    const hasRecentReceipt = recent(latest?.generatedAt, referenceMs);
    const status = hasRecentEvidence ? 'recent_evidence_file_detected'
      : hasRecentRoleRun ? 'recent_role_run_only'
        : hasRecentReceipt ? 'recent_operational_receipt_only'
          : 'no_recent_persisted_activity';
    return {
      role,
      taskAutomationEnabled: 'not_available_from_repository',
      persistedActivityStatus: status,
      lastPersistedEvidenceAt: evidenceTime,
      lastPersistedRoleRunAt: runTime,
      lastPersistedOperationalReceipt: latest
        ? { at: latest.generatedAt, path: latest.sourcePath,
            sha256: latest.sourceSha256, status: latest.status,
            disposition: latest.disposition } : null,
      lastReportedWriteBlocker: lastReportedWriteBlocker
        ? { at: lastReportedWriteBlocker.generatedAt,
            path: lastReportedWriteBlocker.sourcePath, sha256: lastReportedWriteBlocker.sourceSha256 } : null,
      effectiveOwnerBacklog: metrics.effectiveOwnerBacklog[role] ?? 0,
      actualClosuresProvenByThisAudit: false,
    };
  });
  return {
    contract: 'earth2036-worker-persistence-readonly-audit-v1',
    checkedAgainstWorkgraphAt: new Date(referenceMs).toISOString(),
    governance: {
      repositoryWrites: false, taskRestart: false, rejectedPayloadRetry: false,
      evidenceDispositions: false, canonicalWrites: false, qualifiedTicks: false,
    },
    classificationRule: 'File-backed evidence, role-run receipts and operational blocker receipts are separate. No task status, task outcome, positive research yield or review approval may be inferred from these timestamps.',
    roles,
    excludedReceipts,
    summary: {
      recentEvidenceRoles: roles.filter(x => x.persistedActivityStatus === 'recent_evidence_file_detected').length,
      noRecentPersistenceRoles: roles.filter(x => x.persistedActivityStatus === 'no_recent_persisted_activity').length,
      historicalWriteBlockerRoles: roles.filter(x => x.lastReportedWriteBlocker).length,
    },
    nextRequiredExternalEvidence: 'Obtain authorized ChatGPT task run/disable-event logs before deciding whether any currently paused automation can safely restart.',
  };
}

async function main() {
  const root = process.cwd();
  const metrics = JSON.parse(await readFile(path.join(root, 'data/runtime/workgraph/metrics.json'), 'utf8'));
  const receipts = await collectWorkerReceipts(root);
  const report = assessWorkerPersistence(metrics, receipts);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
