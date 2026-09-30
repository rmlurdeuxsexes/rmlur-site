import { sql } from './_lib/db.js';
import { siteUrl, isTestKey, findTier, createCheckoutSession } from './_lib/checkout.js';

export default {
  async fetch(request) {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    // GET: lets the store know whether checkout is live and whether to show the TEST MODE banner.
    if (request.method === 'GET') {
      return Response.json({ enabled: !!secretKey, testMode: isTestKey(secretKey) });
    }
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    if (!secretKey) return Response.json({ error: 'checkout not configured' }, { status: 503 });

    let body;
    try { body = await request.json(); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }
    const { productId, tierId } = body || {};
    if (typeof productId !== 'string' || typeof tierId !== 'string') {
      return Response.json({ error: 'productId and tierId required' }, { status: 400 });
    }

    try {
      const rows = await sql`SELECT * FROM products WHERE id = ${productId}`;
      if (!rows.length) return Response.json({ error: 'unknown product' }, { status: 404 });
      const product = rows[0];
      const tier = findTier(product, tierId);
      if (!tier) return Response.json({ error: 'unknown license' }, { status: 404 });
      const session = await createCheckoutSession({ product, tier, origin: siteUrl(request), secretKey });
      return Response.json({ url: session.url });
    } catch (err) {
      console.error('[api/checkout]', err);
      return Response.json({ error: 'could not start checkout' }, { status: 502 });
    }
  },
};
