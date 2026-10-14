import { sql } from './_lib/db.js';
import { publicTier } from './_lib/checkout.js';
import { createHash } from 'node:crypto';
import { servePreview } from './_lib/preview.js';

// tiers/exclusive carry deliverableUrl (paid files) — never expose it publicly;
// publicTier() swaps it for a buyable flag.

// previews are served same-origin through /api/products?preview=<id> (see _lib/preview.js); the
// v= param changes whenever the stored file does, so the CDN never serves a stale one
export function previewPath(row) {
  if (!row.preview_url) return null;
  const v = createHash('sha1').update(row.preview_url).digest('hex').slice(0, 10);
  return `/api/products?preview=${encodeURIComponent(row.id)}&v=${v}`;
}

function toProduct(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    bpm: row.bpm,
    key: row.key,
    bars: row.bars,
    genre: row.genre,
    cover: row.cover_url,
    preview: previewPath(row),
    tags: row.tags,
    info: row.info,
    tiers: Array.isArray(row.tiers) ? row.tiers.map(t => publicTier(t, row)) : row.tiers,
    exclusive: publicTier(row.exclusive, row),
  };
}

export default {
  async fetch(request) {
    const preview = new URL(request.url).searchParams.get('preview');
    if (preview !== null && (request.method === 'GET' || request.method === 'HEAD')) return servePreview(request, preview);
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    try {
      const rows = await sql`SELECT * FROM products ORDER BY created_at ASC`;
      return Response.json(rows.map(toProduct));
    } catch (err) {
      console.error('[api/products] DB error:', err);
      return Response.json({ error: 'internal error' }, { status: 500 });
    }
  },
};
