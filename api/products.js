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

// covers stored in the private R2 bucket are served same-origin like previews;
// plain https covers (older uploads) are passed through unchanged
export function coverPath(row) {
  if (!row.cover_url) return null;
  if (!String(row.cover_url).startsWith('r2:')) return row.cover_url;
  const v = createHash('sha1').update(row.cover_url).digest('hex').slice(0, 10);
  return `/api/products?cover=${encodeURIComponent(row.id)}&v=${v}`;
}

// Older rows still carry the retired inbox in their "ask the producer" mailto links;
// swap it on the way out so every fallback reaches the current one.
const OLD_CONTACT = /jayrewindbeatz(@|%40)gmail\.com/gi;
const withContact = t => (t && typeof t.stripeLink === 'string') ? { ...t, stripeLink: t.stripeLink.replace(OLD_CONTACT, 'rmlurdeuxsexes$1gmail.com') } : t;

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
    cover: coverPath(row),
    preview: previewPath(row),
    tags: row.tags,
    info: row.info,
    tiers: Array.isArray(row.tiers) ? row.tiers.map(t => withContact(publicTier(t, row))) : row.tiers,
    exclusive: withContact(publicTier(row.exclusive, row)),
  };
}

export default {
  async fetch(request) {
    const q = new URL(request.url).searchParams;
    const preview = q.get('preview'), cover = q.get('cover');
    if (preview !== null && (request.method === 'GET' || request.method === 'HEAD')) return servePreview(request, preview, 'preview');
    if (cover !== null && (request.method === 'GET' || request.method === 'HEAD')) return servePreview(request, cover, 'cover');
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
