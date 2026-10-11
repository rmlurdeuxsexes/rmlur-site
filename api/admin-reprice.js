import { verifySession } from './_lib/auth.js';
import { sql } from './_lib/db.js';
import { STANDARD_PRICES, repriceProduct, publicTier } from './_lib/checkout.js';

// Admin-only: apply STANDARD_PRICES to every beat (kits keep their own prices).
// The response doubles as a report of which beats have no downloadable file.
export default {
  async fetch(request) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    if (!verifySession(request)) return new Response('Unauthorized', { status: 401 });
    try {
      const rows = await sql`SELECT * FROM products WHERE type = 'beat' ORDER BY created_at ASC`;
      const beats = [];
      for (const row of rows) {
        const { tiers, exclusive } = repriceProduct(row);
        await sql`UPDATE products SET tiers = ${JSON.stringify(tiers)},
          exclusive = ${exclusive ? JSON.stringify(exclusive) : null} WHERE id = ${row.id}`;
        const pub = [...tiers, ...(exclusive ? [{ id: 'exclusive', label: 'EXCLUSIVE', ...exclusive }] : [])]
          .map(t => publicTier(t, row));
        beats.push({ id: row.id, title: row.title, tiers: pub.map(t => ({ id: t.id, price: t.price, buyable: t.buyable })) });
      }
      return Response.json({ updated: beats.length, prices: STANDARD_PRICES, beats });
    } catch (err) {
      console.error('[api/admin-reprice]', err);
      return Response.json({ error: 'database write failed' }, { status: 500 });
    }
  },
};
