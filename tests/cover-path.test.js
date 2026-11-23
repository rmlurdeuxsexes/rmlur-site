import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL ||= 'postgres://u:p@localhost/db';
const { coverPath } = await import('../api/products.js');

test('r2 covers are served same-origin, https covers pass through', () => {
  assert.match(coverPath({ id: 'walk', cover_url: 'r2:media/walk/cover/a.jpg' }), /^\/api\/products\?cover=walk&v=[0-9a-f]{10}$/);
  assert.equal(coverPath({ id: 'walk', cover_url: 'https://img.example/a.jpg' }), 'https://img.example/a.jpg');
  assert.equal(coverPath({ id: 'walk', cover_url: null }), null);
});
