import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePost, publicPost, MAX_BODY } from '../api/_lib/posts.js';

process.env.ADMIN_SESSION_SECRET = 'test-secret';
process.env.DATABASE_URL ||= 'postgres://u:p@localhost.invalid/db'; // never reached: requests below stop at auth
const handler = (await import('../api/posts.js')).default;

test('rant keeps text exactly as typed (trimmed, CRLF normalised)', () => {
  const v = validatePost({ kind: 'rant', body: '  line one\r\nline <b>two</b> & "three"  ' });
  assert.equal(v.ok, true);
  assert.equal(v.post.body, 'line one\nline <b>two</b> & "three"');
  assert.equal(v.post.kind, 'rant');
});

test('empty rant, oversize rant, art without image, bad image url are refused', () => {
  assert.equal(validatePost({ kind: 'rant', body: '   ' }).ok, false);
  assert.equal(validatePost({ kind: 'rant', body: 'x'.repeat(MAX_BODY + 1) }).ok, false);
  assert.equal(validatePost({ kind: 'art', body: 'caption' }).ok, false);
  assert.equal(validatePost({ kind: 'rant', body: 'hi', image: 'javascript:alert(1)' }).ok, false);
  assert.equal(validatePost({ kind: 'rant', body: 'hi', image: 'http://x.co/a.png' }).ok, false);
});

test('unknown kind/category fall back safely; art with https image is fine', () => {
  const v = validatePost({ kind: 'admin', category: 'nope', body: 'hey' });
  assert.equal(v.post.kind, 'rant');
  assert.equal(v.post.category, null);
  const a = validatePost({ kind: 'art', image: 'https://blob.vercel-storage.com/a.png', category: 'art' });
  assert.equal(a.ok, true);
  assert.equal(a.post.body, null);
  assert.equal(a.post.category, 'art');
});

test('publicPost maps the db row', () => {
  const p = publicPost({ id: 3, kind: 'rant', category: null, title: null, body: 'b', image_url: null, created_at: new Date('2026-10-11T00:00:00Z') });
  assert.deepEqual(p, { id: 3, kind: 'rant', category: null, title: null, body: 'b', image: null, createdAt: '2026-10-11T00:00:00.000Z' });
});

test('posting and deleting are admin-only', async () => {
  const post = new Request('https://x/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"body":"hi"}' });
  assert.equal((await handler.fetch(post)).status, 401);
  assert.equal((await handler.fetch(new Request('https://x/api/posts?id=1', { method: 'DELETE' }))).status, 401);
  assert.equal((await handler.fetch(new Request('https://x/api/posts', { method: 'PUT' }))).status, 405);
});
