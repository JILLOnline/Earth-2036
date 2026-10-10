import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { verifySecDocumentArchive } from './sec-document-authentication.mjs';

const HASH64 = /^[a-f0-9]{64}$/;
const ACCESSION = /^\d{10}-\d{2}-\d{6}$/;
const sha256 = text => createHash('sha256').update(text).digest('hex');

function archivePath(root, filing, digest) {
  if (!root || !/^[A-Z0-9.\-]{1,16}$/.test(filing?.ticker || '') ||
      !ACCESSION.test(filing?.accessionNumber || '') || !HASH64.test(digest || '')) {
    throw new Error('sec_review_archive_invalid_path_identity');
  }
  return path.join(root, filing.ticker, filing.accessionNumber, digest + '.json');
}

// Do not rewrite a previously archived source. A different fetched body gets a
// different hash-addressed path; an existing bad file fails closed.
export async function persistSecDocumentArtifact(filing, artifact, archiveRoot, at = new Date().toISOString()) {
  const verified = verifySecDocumentArchive(filing, artifact, { now: at });
  const file = archivePath(archiveRoot, filing, verified.sourceDocumentSha256);
  await mkdir(path.dirname(file), { recursive: true });
  const payload = JSON.stringify(artifact, null, 2) + '\n';
  try {
    await writeFile(file, payload, { encoding: 'utf8', flag: 'wx' });
    return { file, created: true, sourceDocumentSha256: verified.sourceDocumentSha256 };
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const existing = await readFile(file, 'utf8');
    const prior = JSON.parse(existing);
    verifySecDocumentArchive(filing, prior, { now: at });
    if (prior.sourceDocumentSha256 !== verified.sourceDocumentSha256) {
      throw new Error('sec_review_archive_existing_hash_mismatch');
    }
    return { file, created: false, sourceDocumentSha256: verified.sourceDocumentSha256 };
  }
}

// Every clearance-bearing review, including superseded history, must be backed
// by a real persisted byte archive. Missing or corrupted proof throws, never
// silently transforms an unreviewed filing into a non-gating disposition.
export async function loadVerifiedSecReviewProofs(queue, reviews, archiveRoot, asOf) {
  if (!queue || !Array.isArray(queue.items) || !Array.isArray(reviews)) {
    throw new Error('sec_review_invalid_queue_or_ledger');
  }
  const byId = new Map(queue.items.map(x => [x.id, x]));
  const proofs = new Map();
  for (const review of reviews) {
    if (review?.disposition !== 'resolved' && review?.disposition !== 'non_gating') continue;
    const filing = byId.get(review.itemId);
    if (!filing) throw new Error('sec_review_archive_unknown_filing');
    const file = archivePath(archiveRoot, filing, review.sourceDocumentSha256);
    let raw;
    try { raw = await readFile(file, 'utf8'); }
    catch { throw new Error('sec_review_archive_missing:' + review.itemId); }
    let artifact;
    try { artifact = JSON.parse(raw); }
    catch { throw new Error('sec_review_archive_corrupt_json:' + review.itemId); }
    const verified = verifySecDocumentArchive(filing, artifact, {
      reviewedAt: review.reviewedAt, now: asOf,
    });
    if (verified.sourceDocumentSha256 !== review.sourceDocumentSha256 ||
        verified.sourceUrl !== review.primarySourceUrl) {
      throw new Error('sec_review_archive_review_mismatch:' + review.itemId);
    }
    proofs.set(review.reviewId, {
      verified: true, sourceDocumentSha256: verified.sourceDocumentSha256,
      primarySourceUrl: verified.sourceUrl, archiveDigest: sha256(raw),
    });
  }
  return proofs;
}
