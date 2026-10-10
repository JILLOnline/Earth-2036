// Manual, single-filing SEC byte capture for #46.
// Usage: SEC_USER_AGENT="Earth2036 research contact@example.org" node scripts/archive-sec-primary.mjs TICKER:ACCESSION
// Does not update SEC queue, issue dispositions, scores, T0 or trial ticks.
// Commit the resulting data/operations/sec-primary-archive/ artifact through a
// reviewed Git change before treating it as source proof.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchSecDocumentArtifact } from './lib/sec-document-authentication.mjs';
import { persistSecDocumentArtifact } from './lib/sec-review-archive.mjs';

const itemId = process.argv[2];
if (!/^[A-Z0-9.\-]{1,16}:\d{10}-\d{2}-\d{6}$/.test(itemId || '')) {
  throw new Error('Expected a single queue filing ID: TICKER:0000000000-00-000000');
}
const root = process.cwd();
const queue = JSON.parse(await readFile(path.join(root, 'data/runtime/evidence-review-queue.json'), 'utf8'));
const filing = queue?.items?.find(item => item.id === itemId);
if (!filing) throw new Error('SEC queue item was not found: ' + itemId);
const artifact = await fetchSecDocumentArtifact(filing, { userAgent: process.env.SEC_USER_AGENT });
const output = await persistSecDocumentArtifact(filing, artifact,
  path.join(root, 'data/operations/sec-primary-archive'));
console.log(JSON.stringify({
  status: output.created ? 'source_bytes_archived_locally_unreviewed' : 'existing_archived_source_verified',
  itemId, sourceDocumentSha256: output.sourceDocumentSha256,
  path: path.relative(root, output.file), reviewApproved: false, committedToGit: false,
}, null, 2));
