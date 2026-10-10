import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSecDocumentIdentity, verifySecDocumentArchive, fetchSecDocumentArtifact } from '../scripts/lib/sec-document-authentication.mjs';

const filing = {
  id: 'MRVL:0001628280-26-065570', ticker: 'MRVL', cik: '0001835632',
  accessionNumber: '0001628280-26-065570', primaryDocument: 'xslF345X06/wk-form4_1791591056.xml',
  sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1835632/000162828026065570/xslF345X06/wk-form4_1791591056.xml',
};
const body = '<ownershipDocument><issuer>MRVL</issuer></ownershipDocument>';
const at = '2026-10-10T00:00:00.000Z';
const stub = (text=body, { status = 200, url = filing.sourceUrl, redirected = false, contentLength = null } = {}) =>
  async () => ({ status, url, redirected, headers: new Headers({ 'content-type': 'application/xml', ...(contentLength ? { 'content-length': String(contentLength) } : {}) }), body: new Response(text).body });
const fetchArchive = (f=filing, opts={}) => fetchSecDocumentArtifact(f, {
  userAgent: 'Earth2036 researcher research@example.com', now:()=>at, fetchImpl:stub(), ...opts,
});

test('positive: exact SEC CIK/accession URL, response bytes and review chronology', async () => {
  assert.equal(assertSecDocumentIdentity(filing),filing.sourceUrl);
  const artifact=await fetchArchive();
  assert.equal(artifact.reviewStatus,'unreviewed');
  assert.equal(artifact.byteLength,Buffer.byteLength(body));
  assert.equal(verifySecDocumentArchive(filing,artifact,{now:at,reviewedAt:'2026-10-10T01:00:00Z'}).verified,true);
});
test('rejects mismatched accession, CIK, unsafe path, other hosts and URL query', () => {
  for (const bad of [
    {...filing,accessionNumber:'0001628280-26-065571'},
    {...filing,cik:'9999999'},
    {...filing,primaryDocument:'../../evil.xml'},
    {...filing,sourceUrl:filing.sourceUrl.replace('www.sec.gov','example.com')},
    {...filing,sourceUrl:filing.sourceUrl+'?fake=1'},
  ]) assert.throws(()=>assertSecDocumentIdentity(bad));
});
test('rejects tampering in archived bytes, hash, length, provenance and time', async () => {
  const a=await fetchArchive();
  for(const bad of [
    {...a,bodyBase64:Buffer.from('fake').toString('base64')},
    {...a,sourceDocumentSha256:'a'.repeat(64)},
    {...a,byteLength:a.byteLength+1},
    {...a,accessionNumber:'0001628280-26-065571'},
    {...a,fetchedAt:'2026-10-11T00:00:00Z'},
    {...a,bodyBase64:'not base64'},
  ]) assert.throws(()=>verifySecDocumentArchive(filing,bad,{now:at}));
  assert.throws(()=>verifySecDocumentArchive(filing,a,{reviewedAt:'2026-10-09T23:59:00Z',now:at}));
});
test('fails closed on rate limits, redirect, 403, empty body, oversize and SEC denial page', async () => {
  for(const fetchImpl of [
    stub('blocked',{status:429}), stub('blocked',{status:403}),
    stub(body,{redirected:true}), stub('',{}),
    stub(body,{contentLength:2*1024*1024+1}),
    stub('Your Request Originates from an Undeclared Automated Tool'),
  ]) await assert.rejects(()=>fetchArchive(filing,{fetchImpl}));
  await assert.rejects(()=>fetchArchive(filing,{fetchImpl:stub('too big'),maxBytes:2}));
  await assert.rejects(()=>fetchArchive(filing,{userAgent:'Anonymous bot'}));
});
test('does not write, clear a queue, or award a non-gating disposition',async()=>{
  const artifact=await fetchArchive();
  assert.equal(artifact.reviewStatus,'unreviewed');
  assert.equal('disposition' in artifact,false);
  assert.equal('approvedBy' in artifact,false);
});
