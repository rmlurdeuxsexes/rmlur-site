import { verifySession } from './_lib/auth.js';
import { sql } from './_lib/db.js';
import { KINDS, validatePost, publicPost } from './_lib/posts.js';

// GET    /api/posts?kind=rant|art   public feed, newest first
// POST   /api/posts                 admin: { kind, category?, title?, body?, image? }
// DELETE /api/posts?id=N            admin
// Created on first use, same as the orders table in stripe-webhook.js.
let tableReady = null;
function ensureTable() {
  tableReady ||= sql`CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'rant',
    category TEXT,
    title TEXT,
    body TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`.catch(err => { tableReady = null; throw err; });
  return tableReady;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET') {
        await ensureTable();
        const kind = KINDS.includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'rant';
        const rows = await sql`SELECT * FROM posts WHERE kind = ${kind} ORDER BY created_at DESC LIMIT 100`;
        return Response.json(rows.map(publicPost), { headers: { 'Cache-Control': 'no-store' } });
      }
      if (request.method !== 'POST' && request.method !== 'DELETE') return new Response('Method Not Allowed', { status: 405 });
      if (!verifySession(request)) return new Response('Unauthorized', { status: 401 });
      await ensureTable();

      if (request.method === 'DELETE') {
        const id = Number(url.searchParams.get('id'));
        if (!Number.isInteger(id) || id < 1) return Response.json({ error: 'invalid id' }, { status: 400 });
        const rows = await sql`DELETE FROM posts WHERE id = ${id} RETURNING id`;
        return rows.length ? Response.json({ deleted: id }) : Response.json({ error: 'not found' }, { status: 404 });
      }

      let body;
      try { body = await request.json(); } catch { return Response.json({ error: 'invalid JSON body' }, { status: 400 }); }
      const v = validatePost(body);
      if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
      const p = v.post;
      const rows = await sql`INSERT INTO posts (kind, category, title, body, image_url)
        VALUES (${p.kind}, ${p.category}, ${p.title}, ${p.body}, ${p.image}) RETURNING *`;
      return Response.json(publicPost(rows[0]), { status: 201 });
    } catch (err) {
      console.error('[api/posts]', err);
      return Response.json({ error: 'database error' }, { status: 500 });
    }
  },
};
