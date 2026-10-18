#!/usr/bin/env node
// Committed GitHub artifacts are observations, not permission for a recovery action.
import { readFile, appendFile } from 'node:fs/promises';
import { assessT0Recovery } from './lib/t0-recovery-readiness.mjs';
const read = async (name) => JSON.parse(await readFile(name, 'utf8'));
const [system,manifest,metrics,sourceHealth,integrity,reconciliation,leases] = await Promise.all([
  read('data/runtime/system-state.json'),
  read('data/baselines/earth2036-official-t0-2026-09-12/manifest.json'),
  read('data/runtime/workgraph/metrics.json'),
  read('data/runtime/source-health.json'),
  read('data/runtime/intelligence-integrity.json'),
  read('data/operations/hourly-reconciliation/latest.json'),
  read('data/operations/phoenix/worker-leases.json'),
]);
const report=assessT0Recovery({system,manifest,metrics,sourceHealth,integrity,reconciliation,leases,now:new Date().toISOString()});
console.log(JSON.stringify(report,null,2));
if(process.env.GITHUB_STEP_SUMMARY){
  const items = [...report.violations.map(code => ({code,owner:'integrity-review'})), ...report.blockers];
  const lines=['## T0 cross-plane recovery readiness (read only)','',
    'Canonical: '+report.baseline.canonical+'/'+report.baseline.expected+'; unfinished '+report.baseline.unfinished+'; qualified ticks '+report.baseline.qualifiedTicks,
    'Invariants: '+(report.passedInvariants?'PASS':'FAIL')+'; publication ready: '+(report.readyForPublication?'YES':'NO'), '',
    '| Blocker / invariant | Owner |','|---|---|',
    ...items.map(i=>'| '+i.code+' | '+i.owner+' |'),'',
    'Worker task enablement cannot be inferred from GitHub. No unsafe restarts, evidence admissions, hourly backfills, or T0 gate waivers.',''];
  await appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n'));
}
if(!report.passedInvariants)process.exitCode=1;
