import { sql } from './_lib/db.js';
import { siteUrl, verifyStripeSignature, findTier, deliverableFor, manualFulfilmentEmail, isFulfillable } from './_lib/checkout.js';
import { ensureTables, finishSpend, releaseHold, isCardId } from './_lib/rewards.js';

const PRODUCER_EMAIL = () => process.env.ORDERS_NOTIFY_EMAIL || 'rmlurdeuxsexes@gmail.com';

async function recordOrder(session) {
  await ensureTables(sql);
  const card = isCardId(session.client_reference_id) ? session.client_reference_id : null;
  // token redemptions are recorded as 'redeemed' (they earn nothing); money orders as 'paid'
  const status = session.metadata?.reward_card ? 'redeemed' : 'paid';
  await sql`INSERT INTO orders (session_id, product_id, tier_id, email, name, amount_cents, status, card_id)
    VALUES (${session.id}, ${session.metadata?.product_id}, ${session.metadata?.tier_id},
            ${session.customer_details?.email ?? null}, ${session.customer_details?.name ?? null},
            ${session.amount_total ?? null}, ${status}, ${card})
    ON CONFLICT (session_id) DO UPDATE SET status = ${status}, card_id = COALESCE(orders.card_id, ${card})`;
  if (session.metadata?.reward_card) await finishSpend(sql, session.id);
}

async function sendMail({ to, subject, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'RMLUR <orders@rmlur.com>', to, subject, text }),
  });
}

// Optional: email the download page link if a Resend key is configured.
async function emailDownloadLink(session, origin) {
  const link = `${origin}/thanks.html?session_id=${session.id}`;
  await sendMail({
    to: session.customer_details?.email,
    subject: 'Your RMLUR beat download',
    text: `Thanks for your order. Your files and license PDF: ${link}\n\nProd. by JayRewind`,
  });
}

// Checkout refuses tiers with no file, but an order can still slip through
// (file removed after checkout started, older sessions) — tell the producer.
async function alertIfNoFile(session) {
  const rows = await sql`SELECT * FROM products WHERE id = ${session.metadata?.product_id}`;
  const product = rows[0] || null;
  const tier = product ? findTier(product, session.metadata?.tier_id) : null;
  if (product && tier && deliverableFor(product, tier)) return;
  await sendMail({ to: PRODUCER_EMAIL(), ...manualFulfilmentEmail({ session, product, tier }) });
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const raw = await request.text();
    if (!verifyStripeSignature(raw, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) {
      return new Response('bad signature', { status: 400 });
    }
    const event = JSON.parse(raw);
    // a token checkout that was abandoned gives its tokens back straight away (holds also lapse on their own)
    if (event.type === 'checkout.session.expired' && event.data.object.metadata?.reward_card) {
      try { await releaseHold(sql, event.data.object.id); } catch (e) { console.error('[stripe-webhook] release', e); }
    }
    if (event.type === 'checkout.session.completed' && isFulfillable(event.data.object)) {
      try {
        await recordOrder(event.data.object);
        await emailDownloadLink(event.data.object, siteUrl(request)).catch(e => console.error('[mail]', e));
        await alertIfNoFile(event.data.object).catch(e => console.error('[mail:producer]', e));
      } catch (err) {
        console.error('[stripe-webhook]', err);
        return new Response('error', { status: 500 }); // Stripe retries
      }
    }
    return Response.json({ received: true });
  },
};
