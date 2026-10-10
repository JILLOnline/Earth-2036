import { createHash } from 'node:crypto';

// Preparation for #46: byte-authenticated SEC source artifacts, NOT review approval.
// No source fetch or hash assertion can make a filing non-gating by itself.
const CONTRACT = 'earth2036-sec-document-archive-v1';
const ACCESSION = /^\d{10}-\d{2}-\d{6}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_BYTES = 2 * 1024 * 1024;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function assertSecDocumentIdentity(filing) {
  if (!filing || typeof filing !== 'object' || !ACCESSION.test(filing.accessionNumber || '')) {
    throw new Error('sec_document_invalid_accession');
  }
  if (!/^\d{1,10}$/.test(String(filing.cik ?? '')) || BigInt(filing.cik) < 1n ||
      typeof filing.ticker !== 'string' || !/^[A-Z0-9.\-]{1,16}$/.test(filing.ticker) ||
      filing.id !== `${filing.ticker}:${filing.accessionNumber}`) {
    throw new Error('sec_document_invalid_filing_identity');
  }
  const primary = filing.primaryDocument;
  if (typeof primary !== 'string' || !primary ||
      primary.split('/').some(s => !s || s === '.' || s === '..' || !/^[A-Za-z0-9_.-]+$/.test(s))) {
    throw new Error('sec_document_unsafe_primary_path');
  }
  let url;
  try { url = new URL(filing.sourceUrl); }
  catch { throw new Error('sec_document_invalid_source_url'); }
  const expected = `/Archives/edgar/data/${BigInt(filing.cik).toString()}/${filing.accessionNumber.replaceAll('-', '')}/${primary}`;
  if (url.protocol !== 'https:' || url.hostname !== 'www.sec.gov' || url.port ||
      url.username || url.password || url.search || url.hash || url.pathname !== expected) {
    throw new Error('sec_document_source_identity_mismatch');
  }
  return url.href;
}

function bytesFromArtifact(artifact) {
  if (!artifact || artifact.contract !== CONTRACT || typeof artifact.bodyBase64 !== 'string' ||
      !artifact.bodyBase64.length || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(artifact.bodyBase64)) {
    throw new Error('sec_document_missing_or_invalid_bytes');
  }
  const bytes = Buffer.from(artifact.bodyBase64, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_BYTES || bytes.toString('base64') !== artifact.bodyBase64) {
    throw new Error('sec_document_bad_archive_payload');
  }
  return bytes;
}

export function verifySecDocumentArchive(filing, artifact, { reviewedAt = null, now = new Date().toISOString() } = {}) {
  const sourceUrl = assertSecDocumentIdentity(filing);
  if (!artifact || artifact.id !== filing.id || artifact.ticker !== filing.ticker ||
      String(artifact.cik) !== String(filing.cik) ||
      artifact.accessionNumber !== filing.accessionNumber || artifact.sourceUrl !== sourceUrl ||
      artifact.httpStatus !== 200 || artifact.redirected !== false) {
    throw new Error('sec_document_archive_lineage_mismatch');
  }
  if (!validTime(artifact.fetchedAt) || !validTime(now) || Date.parse(artifact.fetchedAt) > Date.parse(now)) {
    throw new Error('sec_document_invalid_retrieval_time');
  }
  if (reviewedAt !== null && (!validTime(reviewedAt) || Date.parse(reviewedAt) < Date.parse(artifact.fetchedAt))) {
    throw new Error('sec_document_not_archived_before_review');
  }
  const bytes = bytesFromArtifact(artifact);
  if (artifact.byteLength !== bytes.length || !SHA256.test(artifact.sourceDocumentSha256 || '') ||
      artifact.sourceDocumentSha256 !== sha256(bytes)) {
    throw new Error('sec_document_hash_or_length_mismatch');
  }
  const prefix = bytes.subarray(0, 2048).toString('utf8');
  if (/request rate threshold exceeded|your request originates from an undeclared automated tool|access denied/i.test(prefix)) {
    throw new Error('sec_document_sec_error_page');
  }
  return { id: filing.id, sourceUrl, sourceDocumentSha256: artifact.sourceDocumentSha256,
    byteLength: bytes.length, fetchedAt: artifact.fetchedAt, verified: true };
}

// Bounded, one-document acquisition. Callers must persist original bytes to an
// immutable source-controlled artifact and independently verify it at review time.
// Returning an object does NOT persist proof or approve a disposition.
export async function fetchSecDocumentArtifact(filing, {
  userAgent, fetchImpl = fetch, now = () => new Date().toISOString(),
  maxBytes = MAX_BYTES, timeoutMs = 12000,
} = {}) {
  const sourceUrl = assertSecDocumentIdentity(filing);
  if (typeof userAgent !== 'string' || !/\S+@\S+\.\S+/.test(userAgent)) {
    throw new Error('sec_document_contact_user_agent_required');
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_BYTES) {
    throw new Error('sec_document_invalid_max_bytes');
  }
  const response = await fetchImpl(sourceUrl, {
    headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xml,text/xml,application/pdf,*/*' },
    redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status !== 200 || response.redirected || response.url !== sourceUrl) {
    throw new Error(`sec_document_http_or_redirect_failure:${response.status}`);
  }
  if (Number(response.headers?.get('content-length') || 0) > maxBytes) {
    throw new Error('sec_document_response_too_large');
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw new Error('sec_document_missing_response_body');
  }
  const reader = response.body.getReader();
  const chunks = []; let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw new Error('sec_document_response_too_large');
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  if (!length) throw new Error('sec_document_empty_response');
  const bytes = Buffer.concat(chunks);
  const artifact = {
    version: 1, contract: CONTRACT, id: filing.id, ticker: filing.ticker,
    cik: String(filing.cik), accessionNumber: filing.accessionNumber,
    sourceUrl, fetchedAt: now(), httpStatus: 200, redirected: false,
    contentType: response.headers?.get('content-type') || null,
    byteLength: bytes.length, sourceDocumentSha256: sha256(bytes),
    bodyBase64: bytes.toString('base64'), reviewStatus: 'unreviewed',
  };
  verifySecDocumentArchive(filing, artifact, { now: artifact.fetchedAt });
  return artifact;
}
