import { sql } from './_lib/db.js';

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
    preview: row.preview_url,
    tags: row.tags,
    info: row.info,
    tiers: row.tiers,
    exclusive: row.exclusive,
  };
}

export default {
  async fetch(request) {
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    try {
      const rows = await sql`SELECT * FROM products ORDER BY created_at ASC`;
      return Response.json(rows.map(toProduct));
    } catch (err) {
      console.error('[api/products] DB error:', err);
      return Response.json([], { status: 200 }); // shop.js's empty-state handles this gracefully
    }
  },
};
