import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDeliverable, normalizeShareLink, isDropboxPath, dropboxToken } from '../api/_lib/dropbox.js';

const fakeFetch = (routes, calls = []) => async (url, init) => {
  calls.push({ url, init });
  const r = routes[url]; if (!r) throw new Error('unexpected ' + url);
  return { ok: r.ok !== false, json: async () => r.body };
};

test('dropbox path -> temporary link using the access token', async () => {
  const calls = [];
  const fetchImpl = fakeFetch({ 'https://api.dropboxapi.com/2/files/get_temporary_link': { body: { link: 'https://dl.dropboxusercontent.com/t/abc' } } }, calls);
  const r = await resolveDeliverable('dropbox:/RMLUR/Beats/Night Drive.wav', { env: { DROPBOX_ACCESS_TOKEN: 'tok' }, fetchImpl });
  assert.equal(r.url, 'https://dl.dropboxusercontent.com/t/abc');
  assert.equal(r.expiresInSec, 14400);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(JSON.parse(calls[0].init.body).path, '/RMLUR/Beats/Night Drive.wav');
});

test('no Dropbox credentials -> null (manual fulfilment), never throws', async () => {
  assert.equal(await resolveDeliverable('dropbox:/x.wav', { env: {}, fetchImpl: fakeFetch({}) }), null);
});

test('share links are forced to dl=1; other urls pass through; empty is null', async () => {
  assert.equal(normalizeShareLink('https://www.dropbox.com/s/abc/x.wav?dl=0'), 'https://www.dropbox.com/s/abc/x.wav?dl=1');
  assert.equal((await resolveDeliverable('https://www.dropbox.com/scl/fi/x/y.wav?rlkey=k&dl=0')).url, 'https://www.dropbox.com/scl/fi/x/y.wav?rlkey=k&dl=1');
  assert.equal((await resolveDeliverable('https://blob.vercel-storage.com/a.wav')).url, 'https://blob.vercel-storage.com/a.wav');
  assert.equal(await resolveDeliverable(null), null);
  // look-alike host must not be treated as dropbox
  assert.equal((await resolveDeliverable('https://evildropbox.com/a')).url, 'https://evildropbox.com/a');
});

test('path validation rejects traversal and non-dropbox schemes', () => {
  assert.equal(isDropboxPath('dropbox:/a/b.wav'), true);
  assert.equal(isDropboxPath('dropbox:/a/../b.wav'), false);
  assert.equal(isDropboxPath('file:///etc/passwd'), false);
});

test('refresh token flow exchanges for an access token and caches it', async () => {
  const calls = [];
  const fetchImpl = fakeFetch({ 'https://api.dropboxapi.com/oauth2/token': { body: { access_token: 'fresh', expires_in: 14400 } } }, calls);
  const env = { DROPBOX_REFRESH_TOKEN: 'r', DROPBOX_APP_KEY: 'k', DROPBOX_APP_SECRET: 's' };
  assert.equal(await dropboxToken({ env, fetchImpl, now: 1_000 }), 'fresh');
  assert.equal(await dropboxToken({ env, fetchImpl, now: 2_000 }), 'fresh');
  assert.equal(calls.length, 1);
});
