// RMLUR Tokens — buy beats, earn tokens, spend them on a free lease.
//
// No accounts: a "card" is a random id the buyer keeps (browser storage + a
// private link). Balances are never stored as a number the browser could
// touch — they're worked out on the server from real Stripe orders:
//   earned = paid orders on this card or this card's email (1 token / $1)
//   spent  = finished token redemptions + redemptions still open (holds)
// A hold lasts as long as the $0 Checkout Session that uses it (30 min), so
// tokens can't be spent twice at the same time and come back if you bail.
import { randomBytes } from 'node:crypto';

// ---- the numbers (change here only) ----
export const TOKENS_PER_DOLLAR = 1;
export const REDEEM_COST = { mp3: 100, wav: 200 };   // tier id -> tokens; tiers not listed (exclusive, stems) can't be redeemed
export const HOLD_MINUTES = 30;                      // = Stripe's minimum Checkout Session lifetime

export const tokensForCents = cents => Math.floor(Math.max(0, Number(cents) || 0) / 100 * TOKENS_PER_DOLLAR);
export const costFor = tierId => REDEEM_COST[tierId] ?? null;
export const isCardId = id => typeof id === 'string' && /^rt_[A-Za-z0-9]{24}$/.test(id);
export const newCardId = () => 'rt_' + randomBytes(18).toString('base64url').replace(/[-_]/g, 'x').slice(0, 24);

let ready = null;
export function ensureTables(sql) {
  ready ||= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS orders (
      session_id TEXT PRIMARY KEY, product_id TEXT, tier_id TEXT, email TEXT, name TEXT,
      amount_cents INTEGER, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_id TEXT`;
    await sql`CREATE TABLE IF NOT EXISTS reward_cards (
      id TEXT PRIMARY KEY, email TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS reward_spends (
      session_id TEXT PRIMARY KEY, card_id TEXT NOT NULL, product_id TEXT, tier_id TEXT,
      tokens INTEGER NOT NULL, status TEXT NOT NULL, expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  })().catch(e => { ready = null; throw e; });
  return ready;
}

export async function getCard(sql, id) {
  if (!isCardId(id)) return null;
  await ensureTables(sql);
  return (await sql`SELECT * FROM reward_cards WHERE id = ${id}`)[0] || null;
}

// The card for a buyer's email, made on first use. Only call this with an
// email proven by a paid Stripe session — never one typed into a form.
export async function cardForEmail(sql, email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  await ensureTables(sql);
  const have = (await sql`SELECT * FROM reward_cards WHERE email = ${e}`)[0];
  if (have) return have;
  await sql`INSERT INTO reward_cards (id, email) VALUES (${newCardId()}, ${e}) ON CONFLICT (email) DO NOTHING`;
  return (await sql`SELECT * FROM reward_cards WHERE email = ${e}`)[0];
}

export async function balance(sql, card) {
  await ensureTables(sql);
  const earnedRows = await sql`SELECT session_id, product_id, tier_id, amount_cents, created_at FROM orders
    WHERE status = 'paid' AND (card_id = ${card.id} OR (${card.email}::text IS NOT NULL AND lower(email) = ${card.email}))
    ORDER BY created_at DESC`;
  const spendRows = await sql`SELECT session_id, product_id, tier_id, tokens, status, created_at FROM reward_spends
    WHERE card_id = ${card.id} AND (status = 'spent' OR (status = 'hold' AND expires_at > now()))
    ORDER BY created_at DESC`;
  const earned = earnedRows.reduce((a, r) => a + tokensForCents(r.amount_cents), 0);
  const spent = spendRows.reduce((a, r) => a + r.tokens, 0);
  const history = [
    ...earnedRows.map(r => ({ type: 'earn', product: r.product_id, tier: r.tier_id, tokens: tokensForCents(r.amount_cents), at: r.created_at })),
    ...spendRows.map(r => ({ type: r.status === 'hold' ? 'pending' : 'spend', product: r.product_id, tier: r.tier_id, tokens: -r.tokens, at: r.created_at })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  return { earned, spent, balance: earned - spent, history };
}

export async function holdTokens(sql, { card, sessionId, productId, tierId, tokens, expiresAt }) {
  await sql`INSERT INTO reward_spends (session_id, card_id, product_id, tier_id, tokens, status, expires_at)
    VALUES (${sessionId}, ${card.id}, ${productId}, ${tierId}, ${tokens}, 'hold', ${expiresAt})`;
}
export async function finishSpend(sql, sessionId) {
  await ensureTables(sql);
  await sql`UPDATE reward_spends SET status = 'spent', expires_at = NULL WHERE session_id = ${sessionId}`;
}
export async function releaseHold(sql, sessionId) {
  await ensureTables(sql);
  await sql`DELETE FROM reward_spends WHERE session_id = ${sessionId} AND status = 'hold'`;
}

// what the store / card page get to see
export function publicCard(card, b) {
  return { card: card.id, balance: b.balance, earned: b.earned, spent: b.spent, costs: REDEEM_COST, perDollar: TOKENS_PER_DOLLAR, history: b.history.slice(0, 30) };
}
