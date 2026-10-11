import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ADMIN_SESSION_SECRET = 'test-secret';
process.env.DATABASE_URL ||= 'postgres://u:p@localhost.invalid/db'; // never reached: requests below stop at auth
const handler = (await import('../api/admin-reprice.js')).default;

test('reprice is admin-only and POST-only', async () => {
  assert.equal((await handler.fetch(new Request('https://x/api/admin-reprice', { method: 'POST' }))).status, 401);
  assert.equal((await handler.fetch(new Request('https://x/api/admin-reprice'))).status, 405);
});
