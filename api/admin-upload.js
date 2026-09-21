import { verifySession } from './_lib/auth.js';
import { sql } from './_lib/db.js';

const REQUIRED_FIELDS = ['id', 'type', 'title', 'genre'];
const VALID_TYPES = ['beat', 'kit', 'loopkit', 'sample', 'project'];

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    if (!verifySession(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'invalid JSON body' }, { status: 400 });
    }

    for (const field of REQUIRED_FIELDS) {
      if (!body[field]) {
        return Response.json({ error: `missing required field: ${field}` }, { status: 400 });
      }
    }
    if (!VALID_TYPES.includes(body.type)) {
      return Response.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }

    try {
      const rows = await sql`
        INSERT INTO products (id, type, title, subtitle, bpm, key, bars, genre, cover_url, preview_url, deliverable_url, tags, info, tiers, exclusive)
        VALUES (
          ${body.id}, ${body.type}, ${body.title}, ${body.subtitle ?? null},
          ${body.bpm ?? null}, ${body.key ?? null}, ${body.bars ?? null}, ${body.genre},
          ${body.cover ?? null}, ${body.preview ?? null}, ${body.deliverable ?? null},
          ${body.tags ?? []}, ${body.info ?? null},
          ${JSON.stringify(body.tiers ?? [])}, ${body.exclusive ? JSON.stringify(body.exclusive) : null}
        )
        ON CONFLICT (id) DO UPDATE SET
          type = EXCLUDED.type, title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
          bpm = EXCLUDED.bpm, key = EXCLUDED.key, bars = EXCLUDED.bars, genre = EXCLUDED.genre,
          cover_url = EXCLUDED.cover_url, preview_url = EXCLUDED.preview_url, deliverable_url = EXCLUDED.deliverable_url,
          tags = EXCLUDED.tags, info = EXCLUDED.info, tiers = EXCLUDED.tiers, exclusive = EXCLUDED.exclusive
        RETURNING *
      `;
      return Response.json(rows[0], { status: 201 });
    } catch (err) {
      console.error('[api/admin-upload] DB error:', err);
      return Response.json({ error: 'database write failed' }, { status: 500 });
    }
  },
};
