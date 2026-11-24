import test from 'node:test';
import assert from 'node:assert/strict';
import { tokensForCents, costFor, isCardId, newCardId, REDEEM_COST, publicCard } from '../api/_lib/rewards.js';
import { createRewardSession, createCheckoutSession, isFulfillable, findTier } from '../api/_lib/checkout.js';

const product = { id: 'wrk', title: 'WRK', tiers: [{ id: 'mp3', label: 'MP3', price: 24.99 }, { id: 'wav', label: 'WAV', price: 34.99 }], exclusive: { price: 249.99 } };
const fake = () => { const seen = {}; return { seen, fetchImpl: async (url, init) => { seen.url = url; seen.init = init; return { ok: true, json: async () => ({ id: 'cs_test_r', url: 'https://checkout.stripe.com/r', expires_at: 1 }) }; } }; };

test('1 token per whole dollar, never negative', () => {
  assert.equal(tokensForCents(2499), 24);
  assert.equal(tokensForCents(3499), 34);
  assert.equal(tokensForCents(0), 0);
  assert.equal(tokensForCents(-500), 0);
  assert.equal(tokensForCents(null), 0);
});

test('only MP3/WAV leases are redeemable', () => {
  assert.equal(costFor('mp3'), REDEEM_COST.mp3);
  assert.equal(costFor('wav'), REDEEM_COST.wav);
  assert.equal(costFor('exclusive'), null);
  assert.equal(costFor('stems'), null);
});

test('card ids are unguessable and validated', () => {
  const a = newCardId(), b = newCardId();
  assert.ok(isCardId(a) && isCardId(b)); assert.notEqual(a, b);
  assert.equal(isCardId('rt_short'), false);
  assert.equal(isCardId("rt_aaaaaaaaaaaaaaaaaaaaaaa'"), false);
  assert.equal(isCardId(undefined), false);
});

test('a token redemption is a $0 Stripe session tied to the card', async () => {
  const { seen, fetchImpl } = fake();
  await createRewardSession({ product, tier: findTier(product, 'mp3'), origin: 'https://rmlur.com', secretKey: 'sk_test_x', fetchImpl, card: 'rt_' + 'a'.repeat(24), tokens: 100, now: 0 });
  const p = new URLSearchParams(seen.init.body);
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), '0');
  assert.equal(p.get('metadata[reward_card]'), 'rt_' + 'a'.repeat(24));
  assert.equal(p.get('metadata[reward_tokens]'), '100');
  assert.equal(p.get('client_reference_id'), 'rt_' + 'a'.repeat(24));
  assert.equal(p.get('expires_at'), String(30 * 60 + 60));
  assert.ok(seen.init.headers['Stripe-Version'], 'no-cost orders need a recent API version');
});

test('paid checkout carries the card so the purchase earns tokens; no card = unchanged', async () => {
  const a = fake();
  await createCheckoutSession({ product, tier: findTier(product, 'wav'), origin: 'https://rmlur.com', secretKey: 'sk_test_x', fetchImpl: a.fetchImpl, card: 'rt_' + 'b'.repeat(24) });
  assert.equal(new URLSearchParams(a.seen.init.body).get('client_reference_id'), 'rt_' + 'b'.repeat(24));
  assert.equal(new URLSearchParams(a.seen.init.body).get('line_items[0][price_data][unit_amount]'), '3499');
  const b = fake();
  await createCheckoutSession({ product, tier: findTier(product, 'wav'), origin: 'https://rmlur.com', secretKey: 'sk_test_x', fetchImpl: b.fetchImpl });
  assert.equal(new URLSearchParams(b.seen.init.body).get('client_reference_id'), null);
});

test('only paid orders or real token redemptions get files', () => {
  assert.equal(isFulfillable({ payment_status: 'paid' }), true);
  assert.equal(isFulfillable({ payment_status: 'no_payment_required', metadata: { reward_card: 'rt_x' } }), true);
  assert.equal(isFulfillable({ payment_status: 'no_payment_required', metadata: {} }), false);
  assert.equal(isFulfillable({ payment_status: 'unpaid' }), false);
});

test('public card view hides nothing secret and caps history', () => {
  const v = publicCard({ id: 'rt_' + 'c'.repeat(24), email: 'x@y.z' }, { balance: 5, earned: 5, spent: 0, history: Array(50).fill({}) });
  assert.equal(v.history.length, 30); assert.equal(v.email, undefined); assert.equal(v.balance, 5);
});
