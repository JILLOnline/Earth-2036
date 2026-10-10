import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assessWorkerPersistence, collectWorkerReceipts } from '../scripts/audit-worker-persistence.mjs';

const at = '2026-10-10T14:00:00.000Z';
const metrics = () => ({
  generatedAt: at,
  roleActivity: {
    'earth-scout': {lastGeneratedAt: '2026-10-08T08:03:41Z', lastRunAt: '2026-10-04T09:04:16Z'},
    'council-alpha': {lastGeneratedAt: '2026-10-10T13:00:00Z', lastRunAt: '2026-10-10T13:15:00Z'},
    'council-beta': {lastGeneratedAt: '2026-10-07T18:21:19Z', lastRunAt: null},
    'deep-resolver': {lastGeneratedAt: null, lastRunAt: '2026-10-10T13:35:00Z'},
  },
  effectiveOwnerBacklog: {'earth-scout': 1, 'council-alpha': 2, 'council-beta': 1, 'deep-resolver': 0},
});

test('historical write denial is reported as blocker, never positive evidence or current task disablement', () => {
  const report = assessWorkerPersistence(metrics(), [{
    role: 'earth-scout', generatedAt: '2026-10-08T21:05:01Z',
    status: 'evidence_write_blocked', evidenceCommit: 'not_committed',
    sourcePath: 'data/runtime/workgraph/receipts/scout.json', sourceSha256: 'abcdef',
  }]);
  const scout = report.roles.find(x => x.role === 'earth-scout');
  assert.equal(scout.persistedActivityStatus, 'no_recent_persisted_activity');
  assert.equal(scout.lastReportedWriteBlocker.path, 'data/runtime/workgraph/receipts/scout.json');
  assert.equal(scout.taskAutomationEnabled, 'not_available_from_repository');
  assert.equal(scout.actualClosuresProvenByThisAudit, false);
  assert.equal(report.governance.taskRestart, false);
  assert.equal(report.summary.historicalWriteBlockerRoles, 1);
});

test('fresh role-run, operational receipt and evidence are distinct; future receipts ignored', () => {
  const report = assessWorkerPersistence(metrics(), [
    {role:'council-beta',generatedAt:'2026-10-10T13:20:00Z',status:'no-duplicate',
      sourcePath:'beta.json',sourceSha256:'aa'},
    {role:'council-beta',generatedAt:'2026-10-11T13:20:00Z',status:'completed',
      sourcePath:'future.json',sourceSha256:'bb'},
  ]);
  const by = Object.fromEntries(report.roles.map(row => [row.role,row]));
  assert.equal(by['council-alpha'].persistedActivityStatus,'recent_evidence_file_detected');
  assert.equal(by['deep-resolver'].persistedActivityStatus,'recent_role_run_only');
  assert.equal(by['council-beta'].persistedActivityStatus,'recent_operational_receipt_only');
  assert.equal(by['council-beta'].lastPersistedOperationalReceipt.path,'beta.json');
  assert.equal(by['council-beta'].actualClosuresProvenByThisAudit,false);
  assert.equal(report.excludedReceipts.length,1);
  assert.equal(by['chief-earth'].persistedActivityStatus,'no_recent_persisted_activity');
});

test('receipt loader reads actual source bytes and nested receipt paths without changing files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'earth2036-worker-audit-'));
  try {
    const dir = path.join(root,'data/runtime/workgraph/receipts/council-beta');
    await mkdir(dir,{recursive:true});
    const original = JSON.stringify({role:'council-beta',generatedAt:'2026-10-09T22:00:00Z',
      disposition:'no-duplicate',evidenceArtifactCreated:false})+'\n';
    const file = path.join(dir,'safe.json');
    await writeFile(file,original);
    await writeFile(path.join(dir,'not-json.txt'),'untouched');
    const receipts = await collectWorkerReceipts(root);
    assert.equal(receipts.length,1);
    assert.equal(receipts[0].role,'council-beta');
    assert.match(receipts[0].sourceSha256,/^[a-f0-9]{64}$/);
    assert.equal(receipts[0].sourcePath,'data/runtime/workgraph/receipts/council-beta/safe.json');
    assert.equal(await readFile(file,'utf8'),original);
  } finally {
    await rm(root,{recursive:true,force:true});
  }
});

test('malformed receipts fail the read-only audit rather than silently passing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'earth2036-worker-invalid-'));
  try {
    const dir = path.join(root,'data/runtime/workgraph/receipts');
    await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'bad.json'),'{ invalid }');
    await assert.rejects(collectWorkerReceipts(root),/worker_receipt_invalid_json/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
