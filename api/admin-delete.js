import { verifySession } from './_lib/auth.js';
import { sql } from './_lib/db.js';

// Admin-only: delete products by explicit id. Refuses any product with a paid
// order (the buyer's download page looks the product up by id), and reports
// ids that weren't found instead of failing silently.
//   POST { ids: ["midnight-pager", ...] } -> { deleted: [...], missing: [...], blocked: [...] }

const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function parseIds(body) {
  const ids = body && Array.isArray(body.ids) ? body.ids : null;
  if (!ids || !ids.length || ids.length > 50 || !ids.every(i => typeof i === 'string' && ID.test(i))) return null;
  return [...new Set(ids)];
}

export function planDeletion(ids, existing, ordered) {
  const have = new Set(existing), paid = new Set(ordered);
  return {
    remove: ids.filter(i => have.has(i) && !paid.has(i)),
    missing: ids.filter(i => !have.has(i)),
    blocked: ids.filter(i => have.has(i) && paid.has(i)),
  };
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    if (!verifySession(request)) return new Response('Unauthorized', { status: 401 });
    const ids = parseIds(await request.json().catch(() => null));
    if (!ids) return Response.json({ error: 'body must be { ids: [product-id, ...] } (1-50 slugs)' }, { status: 400 });
    try {
      const existing = (await sql`SELECT id FROM products WHERE id = ANY(${ids})`).map(r => r.id);
      const [{ t }] = await sql`SELECT to_regclass('public.orders') AS t`;   // orders is created lazily by the webhook
      const ordered = t ? (await sql`SELECT DISTINCT product_id FROM orders WHERE status = 'paid' AND product_id = ANY(${ids})`).map(r => r.product_id) : [];
      const plan = planDeletion(ids, existing, ordered);
      if (plan.remove.length) await sql`DELETE FROM products WHERE id = ANY(${plan.remove})`;
      return Response.json({ deleted: plan.remove, missing: plan.missing, blocked: plan.blocked });
    } catch (err) {
      console.error('[api/admin-delete]', err);
      return Response.json({ error: 'database write failed' }, { status: 500 });
    }
  },
};
