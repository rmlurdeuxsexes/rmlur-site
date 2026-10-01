import test from 'node:test';
import assert from 'node:assert/strict';
import { presign, r2Config, r2DownloadUrl, r2Put, isR2Key } from '../api/_lib/r2.js';
import { resolveDeliverable } from '../api/_lib/dropbox.js';

const env = { R2_ACCOUNT_ID: 'acct123', R2_ACCESS_KEY_ID: 'AKID', R2_SECRET_ACCESS_KEY: 'sek', R2_BUCKET: 'beats' };

test('SigV4 presign matches the AWS documented example signature', () => {
  const url = presign({
    host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', region: 'us-east-1',
    accessKey: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    expires: 86400, now: new Date('2013-05-24T00:00:00Z'),
  });
  assert.match(url, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/);
});

test('r2 deliverable resolves to a presigned, forced-download link on the R2 endpoint', async () => {
  const r = await resolveDeliverable('r2:deliverables/spiretrual-trance/wav/Spiretrual Trance.wav', { env });
  const u = new URL(r.url);
  assert.equal(u.host, 'acct123.r2.cloudflarestorage.com');
  assert.equal(u.pathname, '/beats/deliverables/spiretrual-trance/wav/Spiretrual%20Trance.wav');
  assert.equal(u.searchParams.get('X-Amz-Expires'), '14400');
  assert.match(u.searchParams.get('response-content-disposition'), /attachment; filename="Spiretrual Trance.wav"/);
  assert.ok(u.searchParams.get('X-Amz-Signature'));
  assert.equal(r.expiresInSec, 14400);
});

test('r2 without credentials -> null (manual fulfilment), never throws; bad keys rejected', async () => {
  assert.equal(await resolveDeliverable('r2:deliverables/x.wav', { env: {} }), null);
  assert.equal(r2Config({}), null);
  assert.equal(isR2Key('r2:../etc/passwd'), false);
  assert.equal(isR2Key('r2:a/b.wav'), true);
});

test('r2Put signs a PUT and returns the r2: reference', async () => {
  const calls = [];
  const ref = await r2Put('deliverables/x/wav/x.wav', Buffer.from('abc'), { env, fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true }; } });
  assert.equal(ref, 'r2:deliverables/x/wav/x.wav');
  assert.equal(calls[0].init.method, 'PUT');
  assert.match(calls[0].url, /^https:\/\/acct123\.r2\.cloudflarestorage\.com\/beats\/deliverables\/x\/wav\/x\.wav\?/);
  await assert.rejects(r2Put('k', Buffer.from('a'), { env, fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'denied' }) }), /403/);
});
