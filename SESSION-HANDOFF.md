# Session handoff — beat store, Stripe, R2, admin upload

Paste this file (or tell the new chat to read it) at the start of a fresh session.
Repo: `rmlurdeuxsexes/rmlur-site` (rmlur.com, static site + Vercel `/api`, no build step). Read `CLAUDE.md`, `PROGRESS.md` too.

## How to talk to this user
- Wants SHORT, plain, "dumbed down" answers. Numbered steps, no jargon, no walls of text.
- **Never rename or "fix" a beat title.** Their spelling is final (e.g. `spiretrual trance`, not "spiritual"). Title is shown exactly as typed.
- They want everything automated — no "send the files by hand". Don't suggest manual fulfilment as the answer.
- They ask for things to go live on `main` (Vercel deploys from `main`). Push branch `claude/happy-brahmagupta-lnksdr`, then fast-forward `main`. Another session also pushes to `main` (floppy lab work) — always `git fetch origin main` and merge before pushing; never force-push.
- Cloud session can't open their screen or Vercel/Stripe/Cloudflare. Everything account-side they do themselves from your steps. `rmlur.com` has been added to this environment's allowed hosts, so `curl https://rmlur.com/...` works (occasionally flaky; retry).

## The goal
Sell beats from rmlur.com with no BeatStars: buyer pays via Stripe, gets a download link automatically. Files live in private storage the user owns for free (Cloudflare R2). The beat being listed first: **SPIRETRUAL TRANCE**, 120 BPM, `@jayrewind + @mikewavvs`, a buyer is waiting ("time to shine buddy"). Stems come later.

## What is built and merged to `main` (tests: `npm test`, 22 passing)
- **Store** (`store.html`, `store.js`): default license is **WAV**; MP3 is the cheaper option. Reads `/api/products` (Neon DB) first; falls back to `data/beats.catalog.json` + `products.js` only if the API fails/empty.
- **Checkout**: Stripe Checkout REST (`api/checkout.js`, `api/stripe-webhook.js`, `api/order.js`, `/thanks.html`). Live check showed `/api/checkout` → `{"enabled":true,"testMode":false}` = **live Stripe key, real charges**.
- **Cloudflare R2 delivery** (`api/_lib/r2.js`, wired into `api/_lib/dropbox.js` `resolveDeliverable`): stored value `r2:deliverables/<id>/<kind>/<file>` → 4-hour presigned download link on the thanks page. SigV4 verified against AWS's reference vector AND against real R2 (bucket `rmlur-beats`, keys valid, was empty).
- **Publishing paths**: `npm run publish-beats -- --sync` and `scripts/beat-drop-watch.mjs` both upload deliverables to R2 when `R2_*` env vars exist (priority: sidecar `dropbox` entry > R2 > Vercel Blob).
- **Browser admin** (`/admin`, `admin/index.html`, `admin/admin.js`, `api/admin-r2-presign.js`, `api/admin-upload.js`): log in, fill title/genre/BPM, choose WAV (+ optional MP3, stems zip, cover, preview), Publish. Browser PUTs files straight to R2 via presigned URL; writes product row with tiers WAV/MP3/STEMS + EXCLUSIVE ($34.99 / $24.99 / $59.99 / $249.99 defaults). Tier only appears if its file was added. Last fix: asset paths made absolute so `/admin` works without a trailing slash (before that the page was unstyled and Log In did nothing).

## Where we stopped (unverified — check first)
1. User set `ADMIN_PASSWORD` (and was told to set `ADMIN_SESSION_SECRET`) in Vercel and redeployed, but had **not yet confirmed a successful login** after the `/admin` path fix. Ask what the page shows.
2. **SPIRETRUAL TRANCE is NOT in the live store yet.** Last check: `/api/products` had 24 beats, none of them this one. The entry in `data/beats.catalog.json` is only a fallback and the store never reads it while the DB works. It goes live only when published via `/admin` (or `publish-beats --sync`) — needs the user's WAV, which is only on their computer.
3. User said they added the **R2 CORS rule** (`AllowedOrigins` rmlur.com + www, `PUT`, headers `*`). Not yet proven by a real upload.
4. Never tested end to end: upload → store listing → Stripe purchase → thanks page download. Verify after the first publish (a live-key purchase charges a real card; suggest a refund-able small test or Stripe test mode).
5. Stripe webhook destination was created (event `checkout.session.completed`, endpoint `https://rmlur.com/api/stripe-webhook`); whether `STRIPE_WEBHOOK_SECRET` is set and deliveries succeed is unconfirmed (user must look in Stripe → Webhooks).

## Security follow-ups (tell the user again)
- The user pasted an **R2 S3 access key + secret and a `cfat_` Cloudflare account token into chat**. They are in this transcript history. They should delete that R2 API token and the `cfat_` token in Cloudflare and create a fresh R2 token, putting the new values **only into Vercel env vars** (never chat). No secrets were written to the repo (checked).
- Admin session cookie, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`: must be set in Vercel Production; redeploy after changes.

## Vercel env vars needed (Production)
`DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (=`rmlur-beats`), `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN` (cover/preview images still use Vercel Blob via admin), optional `RESEND_API_KEY` + `MAIL_FROM`.

## Known gaps / ideas
- Cover + preview in admin still go to public Vercel Blob (small files). Could move previews/covers to a public R2 path later.
- Admin has no MP3 transcoding: MP3 tier exists only if the user uploads an MP3 file.
- A WAV preview for "Play" needs an MP3 preview upload; without it the store's Play shows "Unavailable".
- `HANDOFF.md` (older) = UI/UX audit history; this file = store/payments/R2 state.
- `CLAUDE.md` standing direction (MPC-as-nav hero, deferred radio station) is unrelated to this work stream and untouched.

## Suggested first message in the new chat
"Read SESSION-HANDOFF.md. Check whether I can log in at rmlur.com/admin and publish `spiretrual trance`, then verify the live store shows it with WAV as default and test checkout."
