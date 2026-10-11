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

// ---- safety: no paying for files that don't exist, standard prices ----
import { publicTier, repriceProduct, deliverableFor, manualFulfilmentEmail, STANDARD_PRICES } from '../api/_lib/checkout.js';

test('publicTier hides the file reference but reports buyable', () => {
  const withFile = publicTier({ id: 'wav', label: 'WAV', price: 64.99, deliverableUrl: 'r2:deliverables/x/wav/x.wav' }, {});
  assert.equal(withFile.buyable, true);
  assert.equal('deliverableUrl' in withFile, false);
  assert.equal(publicTier({ id: 'mp3', label: 'MP3', price: 29.99 }, {}).buyable, false);
  // a product-level file covers every tier (older listings)
  assert.equal(publicTier({ id: 'mp3', label: 'MP3', price: 29.99 }, { deliverable_url: 'r2:x' }).buyable, true);
  assert.equal(publicTier(null, {}), null);
});

test('a tier with no file has no deliverable (checkout refuses it with 409)', () => {
  const p = { id: 'a', tiers: [{ id: 'wav', label: 'WAV', price: 64.99 }], exclusive: { price: 1000 } };
  assert.equal(deliverableFor(p, findTier(p, 'wav')), null);
  assert.equal(deliverableFor(p, findTier(p, 'exclusive')), null);
  const q = { ...p, tiers: [{ id: 'wav', label: 'WAV', price: 64.99, deliverableUrl: 'r2:k' }] };
  assert.equal(deliverableFor(q, findTier(q, 'wav')), 'r2:k');
});

test('repriceProduct applies the standard prices by tier id and keeps files', () => {
  assert.deepEqual(STANDARD_PRICES, { mp3: 29.99, wav: 64.99, stems: 99.99, exclusive: 1000 });
  const { tiers, exclusive } = repriceProduct({
    tiers: [
      { id: 'mp3', label: 'MP3', price: 24.99, deliverableUrl: 'r2:m' },
      { id: 'wav', label: 'WAV', price: 34.99 },
      { id: 'stems', label: 'STEMS', price: 59.99 },
      { id: 'custom', label: 'CUSTOM', price: 5 },
    ],
    exclusive: { price: 249.99, deliverableUrl: 'r2:w' },
  });
  assert.deepEqual(tiers.map(t => t.price), [29.99, 64.99, 99.99, 5]);
  assert.equal(tiers[0].deliverableUrl, 'r2:m');
  assert.deepEqual(exclusive, { price: 1000, deliverableUrl: 'r2:w' });
  // no exclusive stays no exclusive; missing tiers array is tolerated
  assert.deepEqual(repriceProduct({ exclusive: null }), { tiers: [], exclusive: null });
});

test('manual-fulfilment email names the beat, license, buyer and session', () => {
  const m = manualFulfilmentEmail({
    session: { id: 'cs_live_1', amount_total: 6499, customer_details: { email: 'b@x.co', name: 'Buyer' }, metadata: {} },
    product: { title: 'WALK' }, tier: { label: 'WAV' },
  });
  assert.match(m.subject, /WALK/);
  assert.match(m.subject, /WAV/);
  assert.match(m.text, /Buyer <b@x\.co>/);
  assert.match(m.text, /\$64\.99/);
  assert.match(m.text, /cs_live_1/);
  // still useful when the product row is gone
  const n = manualFulfilmentEmail({ session: { id: 'cs_2', metadata: { product_id: 'gone', tier_id: 'mp3' } }, product: null, tier: null });
  assert.match(n.subject, /gone/);
});
