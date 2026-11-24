import { sql } from './_lib/db.js';
import { siteUrl, isTestKey, findTier, deliverableFor, createCheckoutSession, createRewardSession } from './_lib/checkout.js';
import { getCard, balance, costFor, holdTokens, isCardId } from './_lib/rewards.js';
import { deliverableReachable } from './_lib/dropbox.js';

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
    const { productId, tierId, card, useTokens } = body || {};
    if (typeof productId !== 'string' || typeof tierId !== 'string') {
      return Response.json({ error: 'productId and tierId required' }, { status: 400 });
    }

    try {
      const rows = await sql`SELECT * FROM products WHERE id = ${productId}`;
      if (!rows.length) return Response.json({ error: 'unknown product' }, { status: 404 });
      const product = rows[0];
      const tier = findTier(product, tierId);
      if (!tier) return Response.json({ error: 'unknown license' }, { status: 404 });
      // Never take money for a file we can't hand over — the store falls back to contact.
      if (!deliverableFor(product, tier)) return Response.json({ error: 'not available yet' }, { status: 409 });
      // ...and the file has to actually download right now, not just be on record.
      if (!(await deliverableReachable(deliverableFor(product, tier)))) {
        console.error('[api/checkout] deliverable not reachable for', product.id, tier.id);
        return Response.json({ error: 'not available yet' }, { status: 409 });
      }
      // RMLUR Tokens: pay with tokens instead of money
      if (useTokens) {
        const cost = costFor(tier.id);
        if (!cost) return Response.json({ error: 'this license can\'t be bought with tokens' }, { status: 400 });
        const c = await getCard(sql, card);
        if (!c) return Response.json({ error: 'token card not found' }, { status: 404 });
        const b = await balance(sql, c);
        if (b.balance < cost) return Response.json({ error: `not enough tokens (${b.balance}/${cost})` }, { status: 402 });
        const session = await createRewardSession({ product, tier, origin: siteUrl(request), secretKey, card: c.id, tokens: cost });
        await holdTokens(sql, { card: c, sessionId: session.id, productId: product.id, tierId: tier.id, tokens: cost,
          expiresAt: new Date((session.expires_at || Math.floor(Date.now() / 1000) + 1860) * 1000).toISOString() });
        return Response.json({ url: session.url });
      }
      const session = await createCheckoutSession({ product, tier, origin: siteUrl(request), secretKey, card: isCardId(card) ? card : undefined });
      return Response.json({ url: session.url });
    } catch (err) {
      console.error('[api/checkout]', err);
      return Response.json({ error: 'could not start checkout' }, { status: 502 });
    }
  },
};
