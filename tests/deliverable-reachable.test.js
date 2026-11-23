import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverableReachable } from '../api/_lib/dropbox.js';

const res = status => ({ status, body: { cancel: async () => {} } });

test('a file that serves its first byte is reachable', async () => {
  let seen;
  const ok = await deliverableReachable('https://files.example/beat.wav', { fetchImpl: async (u, init) => { seen = init; return res(206); } });
  assert.equal(ok, true);
  assert.equal(seen.headers.Range, 'bytes=0-0');
});

test('a blocked store (403) is not reachable', async () => {
  assert.equal(await deliverableReachable('https://x.public.blob.vercel-storage.com/a.wav', { fetchImpl: async () => res(403) }), false);
});

test('network failure is not reachable', async () => {
  assert.equal(await deliverableReachable('https://files.example/a.wav', { fetchImpl: async () => { throw new Error('down'); } }), false);
});

test('missing reference is not reachable', async () => {
  assert.equal(await deliverableReachable(null, { fetchImpl: async () => res(200) }), false);
});

test('r2 refs need R2 config to be reachable', async () => {
  assert.equal(await deliverableReachable('r2:deliverables/x/wav/a.wav', { env: {}, fetchImpl: async () => res(200) }), false);
  const env = { R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', R2_BUCKET: 'b' };
  let url;
  const ok = await deliverableReachable('r2:deliverables/x/wav/a.wav', { env, fetchImpl: async u => { url = u; return res(206); } });
  assert.equal(ok, true);
  assert.match(url, /deliverables\/x\/wav\/a\.wav\?X-Amz-/);
});
