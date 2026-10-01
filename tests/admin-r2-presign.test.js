import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ADMIN_SESSION_SECRET = 'test-secret';
process.env.R2_ACCOUNT_ID = 'acct123'; process.env.R2_ACCESS_KEY_ID = 'AKID';
process.env.R2_SECRET_ACCESS_KEY = 'sek'; process.env.R2_BUCKET = 'beats';
const { createSessionCookie } = await import('../api/_lib/auth.js');
const handler = (await import('../api/admin-r2-presign.js')).default;

const req = (body, cookie) => new Request('https://x/api/admin-r2-presign', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
});
const cookie = createSessionCookie().split(';')[0];

test('logged-out requests are refused', async () => {
  assert.equal((await handler.fetch(req({ id: 'a', kind: 'wav', filename: 'a.wav' }))).status, 401);
});

test('admin gets a presigned PUT confined to deliverables/<id>/<kind>/', async () => {
  const r = await handler.fetch(req({ id: 'spiretrual-trance', kind: 'wav', filename: '../../evil/Spiretrual Trance.wav' }, cookie));
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.match(j.ref, /^r2:deliverables\/spiretrual-trance\/wav\/[^/]+$/);
  assert.ok(!j.ref.includes('..'));
  const u = new URL(j.url);
  assert.equal(u.host, 'acct123.r2.cloudflarestorage.com');
  assert.ok(u.pathname.startsWith('/beats/deliverables/spiretrual-trance/wav/'));
});

test('bad id or kind is rejected', async () => {
  assert.equal((await handler.fetch(req({ id: '../x', kind: 'wav', filename: 'a' }, cookie))).status, 400);
  assert.equal((await handler.fetch(req({ id: 'ok', kind: 'exe', filename: 'a' }, cookie))).status, 400);
});
