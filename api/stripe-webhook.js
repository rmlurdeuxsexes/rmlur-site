import { sql } from './_lib/db.js';
import { siteUrl, verifyStripeSignature } from './_lib/checkout.js';

async function recordOrder(session) {
  await sql`CREATE TABLE IF NOT EXISTS orders (
    session_id TEXT PRIMARY KEY, product_id TEXT, tier_id TEXT, email TEXT, name TEXT,
    amount_cents INTEGER, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`INSERT INTO orders (session_id, product_id, tier_id, email, name, amount_cents, status)
    VALUES (${session.id}, ${session.metadata?.product_id}, ${session.metadata?.tier_id},
            ${session.customer_details?.email ?? null}, ${session.customer_details?.name ?? null},
            ${session.amount_total ?? null}, 'paid')
    ON CONFLICT (session_id) DO UPDATE SET status = 'paid'`;
}

// Optional: email the download page link if a Resend key is configured.
async function emailDownloadLink(session, origin) {
  const key = process.env.RESEND_API_KEY;
  const to = session.customer_details?.email;
  if (!key || !to) return;
  const link = `${origin}/thanks.html?session_id=${session.id}`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'RMLUR <orders@rmlur.com>',
      to, subject: 'Your RMLUR beat download',
      text: `Thanks for your order. Your files and license PDF: ${link}\n\nProd. by JayRewind`,
    }),
  });
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const raw = await request.text();
    if (!verifyStripeSignature(raw, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) {
      return new Response('bad signature', { status: 400 });
    }
    const event = JSON.parse(raw);
    if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
      try {
        await recordOrder(event.data.object);
        await emailDownloadLink(event.data.object, siteUrl(request)).catch(e => console.error('[mail]', e));
      } catch (err) {
        console.error('[stripe-webhook]', err);
        return new Response('error', { status: 500 }); // Stripe retries
      }
    }
    return Response.json({ received: true });
  },
};
