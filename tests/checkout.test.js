import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createCheckoutSession, verifyStripeSignature, buildLicensePdf, findTier, isTestKey } from '../api/_lib/checkout.js';

const product = { id: 'midnight-pager', title: 'MIDNIGHT PAGER', tiers: [{ id: 'wav', label: 'WAV', price: 34.99 }], exclusive: { price: 249.99 } };

test('checkout session uses server-side price, metadata and success url', async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/x' }) }; };
  const s = await createCheckoutSession({ product, tier: findTier(product, 'wav'), origin: 'https://rmlur.com', secretKey: 'sk_test_x', fetchImpl });
  assert.equal(s.url, 'https://checkout.stripe.com/x');
  assert.equal(seen.url, 'https://api.stripe.com/v1/checkout/sessions');
  const body = new URLSearchParams(seen.init.body);
  assert.equal(body.get('line_items[0][price_data][unit_amount]'), '3499');
  assert.equal(body.get('line_items[0][price_data][product_data][name]'), 'MIDNIGHT PAGER — WAV license');
  assert.equal(body.get('metadata[product_id]'), 'midnight-pager');
  assert.equal(body.get('success_url'), 'https://rmlur.com/thanks.html?session_id={CHECKOUT_SESSION_ID}');
});

test('exclusive tier resolves and unknown tier does not', () => {
  assert.equal(findTier(product, 'exclusive').price, 249.99);
  assert.equal(findTier(product, 'nope'), null);
  assert.ok(isTestKey('sk_test_abc') && !isTestKey('sk_live_abc'));
});

test('stripe signature: valid, tampered, stale', () => {
  const secret = 'whsec_test', raw = '{"a":1}', now = 1_700_000_000_000, t = now / 1000;
  const sig = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  assert.equal(verifyStripeSignature(raw, `t=${t},v1=${sig}`, secret, { now }), true);
  assert.equal(verifyStripeSignature(raw + 'x', `t=${t},v1=${sig}`, secret, { now }), false);
  assert.equal(verifyStripeSignature(raw, `t=${t},v1=${sig}`, secret, { now: now + 3600_000 }), false);
  assert.equal(verifyStripeSignature(raw, null, secret), false);
});

test('license pdf is a well-formed single page with order details', () => {
  const pdf = buildLicensePdf({ title: 'MIDNIGHT PAGER (demo)', tierLabel: 'WAV', buyerName: 'A B', buyerEmail: 'a@b.co', orderId: 'cs_test_1', date: '2026-09-30' }).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-1.4') && pdf.trimEnd().endsWith('%%EOF'));
  assert.match(pdf, /MIDNIGHT PAGER \\\(demo\\\)/);
  assert.match(pdf, /Order ID: cs_test_1/);
  const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(xref, xref + 4), 'xref');
});
