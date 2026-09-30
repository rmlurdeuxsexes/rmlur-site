import { sql } from './_lib/db.js';
import { findTier, deliverableFor, retrieveSession } from './_lib/checkout.js';

// Returns the files for a PAID Checkout session. The session id (cs_...) is the credential.
export async function loadPaidOrder(sessionId) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !/^cs_[A-Za-z0-9_]+$/.test(sessionId || '')) return null;
  const session = await retrieveSession(sessionId, { secretKey });
  if (session.payment_status !== 'paid') return null;
  const rows = await sql`SELECT * FROM products WHERE id = ${session.metadata?.product_id}`;
  if (!rows.length) return null;
  const product = rows[0];
  const tier = findTier(product, session.metadata?.tier_id);
  if (!tier) return null;
  return { session, product, tier, file: deliverableFor(product, tier) };
}

export default {
  async fetch(request) {
    const id = new URL(request.url).searchParams.get('session_id');
    try {
      const o = await loadPaidOrder(id);
      if (!o) return Response.json({ error: 'order not found or unpaid' }, { status: 404 });
      return Response.json({
        title: o.product.title,
        license: o.tier.label,
        email: o.session.customer_details?.email ?? null,
        files: o.file ? [{ label: `${o.product.title} — ${o.tier.label}`, url: o.file }] : [],
        licenseUrl: `/api/license?session_id=${encodeURIComponent(id)}`,
        fulfilment: o.file ? 'ready' : 'manual',
      });
    } catch (err) {
      console.error('[api/order]', err);
      return Response.json({ error: 'lookup failed' }, { status: 502 });
    }
  },
};
