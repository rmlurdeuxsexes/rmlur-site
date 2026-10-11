import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ADMIN_SESSION_SECRET = 'test-secret';
process.env.DATABASE_URL ||= 'postgres://u:p@localhost.invalid/db'; // never reached: requests below stop before the database
const mod = await import('../api/admin-delete.js');
const handler = mod.default;

test('delete is admin-only and POST-only', async () => {
  assert.equal((await handler.fetch(new Request('https://x/api/admin-delete', { method: 'POST', body: '{"ids":["a"]}' }))).status, 401);
  assert.equal((await handler.fetch(new Request('https://x/api/admin-delete'))).status, 405);
});

test('ids must be an explicit list of slugs', () => {
  assert.deepEqual(mod.parseIds({ ids: ['midnight-pager', 'getty-tape', 'getty-tape'] }), ['midnight-pager', 'getty-tape']);
  assert.equal(mod.parseIds({ ids: [] }), null);
  assert.equal(mod.parseIds({ ids: ["x'; DROP TABLE products;--"] }), null);
  assert.equal(mod.parseIds({ ids: 'midnight-pager' }), null);
  assert.equal(mod.parseIds(null), null);
  assert.equal(mod.parseIds({ ids: Array.from({ length: 51 }, (_, i) => 'b' + i) }), null);
});

test('never deletes a product with a paid order; reports unknown ids', () => {
  const plan = mod.planDeletion(['midnight-pager', 'getty-tape', 'deux-sexes-drums-v1', 'nope'], ['midnight-pager', 'getty-tape', 'deux-sexes-drums-v1'], ['getty-tape']);
  assert.deepEqual(plan, { remove: ['midnight-pager', 'deux-sexes-drums-v1'], missing: ['nope'], blocked: ['getty-tape'] });
});
