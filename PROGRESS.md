# PROGRESS — Track A status (2026-09-30)

## Shipped (branch `claude/new-session-a0q905`, not yet merged to `main`)
- `/` — static Readymag MPC hero (`assets/hero-mpc-2000xl-readymag.png`). 3D scene files untouched, just not loaded on `/`.
- `/store.html` — white store, 3.5" floppy disks, beat info handwritten on the label rules, Play / license picker / Buy.
- Checkout — Stripe Checkout (REST, no SDK):
  - `POST /api/checkout {productId, tierId}` → session URL. Price comes from the DB, never the browser.
  - `GET /api/checkout` → `{enabled, testMode}`; store shows a TEST MODE banner for `sk_test_` keys.
  - `POST /api/stripe-webhook` → verifies signature, records the order in `orders` (auto-created), emails the download link if `RESEND_API_KEY` is set.
  - `/thanks.html` → `GET /api/order?session_id=` (paid-only) lists files; `GET /api/license?session_id=` returns the license PDF.
  - Without `STRIPE_SECRET_KEY` Buy falls back to each tier's existing `stripeLink` (mailto today).
- Security fix: `/api/products` no longer leaks `deliverableUrl` inside `tiers`/`exclusive`.
- Tests: `npm test` (checkout session, signature, PDF).

## Env vars to set in Vercel
| Var | Needed for |
|---|---|
| `STRIPE_SECRET_KEY` | checkout (use `sk_test_…` first) |
| `STRIPE_WEBHOOK_SECRET` | webhook; endpoint `https://rmlur.com/api/stripe-webhook`, event `checkout.session.completed` |
| `NEXT_PUBLIC_SITE_URL` | optional; defaults to request origin |
| `RESEND_API_KEY`, `MAIL_FROM` | optional download email |
| `DATABASE_URL` | already in use |

## Still open
- Real floppy photo: save watermark-free image at `assets/store/floppy-3.5-blue.png` (SVG placeholder used until then).
- Drop-folder pipeline (`npm run publish-beats`, inbox, JSON catalog fallback) — extend `scripts/beat-drop-watch.mjs`.
- Deliverables: tiers without a `deliverableUrl` show "files will be emailed" on `/thanks.html`.
- Dropbox link delivery (not built).
- Track B (floppy cabinet) not started.
