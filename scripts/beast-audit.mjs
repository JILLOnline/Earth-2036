import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditSystem } from '../engine/beast-integrity.mjs';

const ROOT = process.cwd();
const RUNTIME = path.join(ROOT, 'data', 'runtime');

async function readJson(name, fallback) {
  try {
    return JSON.parse(await readFile(path.join(RUNTIME, name), 'utf8'));
  } catch {
    return fallback;
  }
}

await mkdir(RUNTIME, { recursive: true });

const [scoreState, graph, sourceHealth, automatedSourceHealth, evidenceQueue] = await Promise.all([
  readJson('score-state.json', { candidates: {} }),
  readJson('causal-graph.json', { nodes: [], edges: [], structuralSignals: [] }),
  readJson('source-health.json', { sources: [] }),
  readJson('automated-source-health.json', null),
  readJson('evidence-review-queue.json', { unresolved: 0, items: [] }),
]);

const result = auditSystem({ scoreState, graph, sourceHealth, automatedSourceHealth, evidenceQueue });
await writeFile(path.join(RUNTIME, 'intelligence-integrity.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  beastIntegrity: result.passed ? 'PASS' : 'FAIL',
  scoreRecordsAudited: result.scoreRecordsAudited,
  scoreRecordsPassed: result.scoreRecordsPassed,
  sourceMesh: result.sourceMesh.passed ? 'PASS' : 'FAIL',
  reasons: result.reasons,
}, null, 2));

if (!result.passed) process.exitCode = 1;
