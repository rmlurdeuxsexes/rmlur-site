// Shared checkout helpers: Stripe REST (no SDK), webhook signature check,
// license PDF. Pure functions so they can be unit-tested with a fake fetch.
import { createHmac, timingSafeEqual } from 'node:crypto';

export function siteUrl(request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
}

export function isTestKey(key) { return /^sk_test_|^rk_test_/.test(key || ''); }

// tiers are {id,label,price}; the exclusive buyout is addressed as id "exclusive"
export function findTier(product, tierId) {
  if (tierId === 'exclusive' && product.exclusive) {
    return { id: 'exclusive', label: 'EXCLUSIVE', price: product.exclusive.price, deliverableUrl: product.exclusive.deliverableUrl };
  }
  return (Array.isArray(product.tiers) ? product.tiers : []).find(t => t.id === tierId) || null;
}

export function deliverableFor(product, tier) {
  return tier.deliverableUrl || product.deliverable_url || null;
}

async function stripe(path, { method = 'GET', params, secretKey, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Stripe ${res.status}`);
  return json;
}

// Price always comes from the server-side catalog, never from the browser.
export async function createCheckoutSession({ product, tier, origin, secretKey, fetchImpl }) {
  const cents = Math.round(Number(tier.price) * 100);
  if (!Number.isFinite(cents) || cents < 50) throw new Error('invalid price');
  return stripe('checkout/sessions', {
    method: 'POST', secretKey, fetchImpl,
    params: {
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(cents),
      'line_items[0][price_data][product_data][name]': `${product.title} — ${tier.label} license`,
      'metadata[product_id]': product.id,
      'metadata[tier_id]': tier.id,
      'payment_intent_data[metadata][product_id]': product.id,
      'payment_intent_data[metadata][tier_id]': tier.id,
      success_url: `${origin}/thanks.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/store.html`,
    },
  });
}

export function retrieveSession(id, { secretKey, fetchImpl }) {
  return stripe(`checkout/sessions/${encodeURIComponent(id)}`, { secretKey, fetchImpl });
}

// Stripe-Signature: t=timestamp,v1=hexsig[,v1=...]
export function verifyStripeSignature(rawBody, header, secret, { toleranceSec = 300, now = Date.now() } = {}) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')).filter(p => p.length === 2));
  const sigs = header.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
  return sigs.some(s => {
    const b = Buffer.from(s, 'hex');
    return b.length === expected.length && timingSafeEqual(b, expected);
  });
}

// ---- one-page license PDF (hand-rolled, Helvetica, no dependency) ----
const pdfEsc = s => String(s).replace(/[^\x20-\x7e]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export function buildLicensePdf({ title, tierLabel, buyerName, buyerEmail, orderId, date, producer = 'RMLUR / JayRewind' }) {
  const rows = [
    [24, 'BEAT LICENSE', 'F2'],
    [11, 'RMLUR :: deux SEXES  -  rmlur.com', 'F1'],
    null,
    [12, `Beat: ${title}`, 'F2'],
    [12, `License: ${tierLabel}`, 'F2'],
    [11, `Producer: ${producer}`, 'F1'],
    [11, `Licensee: ${buyerName || buyerEmail || 'Customer'}${buyerName && buyerEmail ? ' <' + buyerEmail + '>' : ''}`, 'F1'],
    [11, `Date: ${date}`, 'F1'],
    [11, `Order ID: ${orderId}`, 'F1'],
    null,
    [11, 'Grant: a non-transferable license to use this beat in the licensed', 'F1'],
    [11, 'format and scope described at rmlur.com/licenses.html. Credit required:', 'F1'],
    [11, '"Prod. by JayRewind". Ownership of the composition stays with the producer', 'F1'],
    [11, 'unless the EXCLUSIVE license applies. Redistribution of the beat files', 'F1'],
    [11, 'themselves is not permitted.', 'F1'],
    null,
    [10, 'Questions: jayrewindbeatz@gmail.com', 'F1'],
  ];
  let y = 780, content = '';
  for (const r of rows) {
    if (!r) { y -= 14; continue; }
    content += `BT /${r[2]} ${r[0]} Tf 56 ${y} Td (${pdfEsc(r[1])}) Tj ET\n`;
    y -= r[0] + 8;
  }
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
