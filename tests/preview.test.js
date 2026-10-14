import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL ||= 'postgres://u:p@localhost/db';
const { upstreamUrl } = await import('../api/_lib/preview.js');
const { previewPath } = await import('../api/products.js');

test('previewPath points at the same-origin proxy and versions by stored URL', () => {
  const a = previewPath({ id: 'jerseyween', preview_url: 'https://x.public.blob.vercel-storage.com/previews/a.mp3' });
  const b = previewPath({ id: 'jerseyween', preview_url: 'https://x.public.blob.vercel-storage.com/previews/b.mp3' });
  assert.match(a, /^\/api\/products\?preview=jerseyween&v=[0-9a-f]{10}$/);
  assert.notEqual(a, b);
  assert.equal(previewPath({ id: 'x', preview_url: null }), null);
});

test('upstreamUrl accepts https and r2 keys only', () => {
  assert.equal(upstreamUrl('https://h.example/p.mp3'), 'https://h.example/p.mp3');
  assert.equal(upstreamUrl('http://h.example/p.mp3'), null);
  assert.equal(upstreamUrl('/previews/p.mp3'), null);
  assert.equal(upstreamUrl(null), null);
  assert.equal(upstreamUrl('r2:previews/p.mp3', {}), null);
  const env = { R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', R2_BUCKET: 'b' };
  assert.match(upstreamUrl('r2:previews/p.mp3', env), /^https:\/\/a\.r2\.cloudflarestorage\.com\/b\/previews\/p\.mp3\?/);
});
