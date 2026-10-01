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

## Drop-folder publishing — `npm run publish-beats`
Drop files in `beats-inbox/` (or set `BEATS_INBOX_PATH`), then run it:
```
Name.wav|aiff|flac   master (or just Name.mp3)      Name.json  overrides: title, genre, bpm, key,
Name.mp3             preview (else ffmpeg, 60s)                  price, prices{}, subtitle, info, tags,
Name.jpg|png         cover (else floppy art)                     youtubeUrl, exclusive:false
Name STEMS.zip       adds a STEMS tier
```
- Output: `previews/<id>.mp3`, `assets/covers/<id>.jpg`, `data/beats.catalog.json`; masters move to `beats-published/<id>/` (gitignored, never public).
- Then commit + push `data previews assets/covers` — the store picks the catalog up (used when `/api/products` is down/empty, merged with `products.js`).
- `--sync` (or `DATABASE_URL` + `BLOB_READ_WRITE_TOKEN` set): uploads masters to Vercel Blob and upserts the Neon `products` row so checkout can deliver files. Without it, catalog beats have no deliverable and Buy falls back to mailto.
- `--dry-run` previews what would publish. Re-dropping a file updates its entry, never duplicates.
- Genre uses the one shared classifier (`scripts/lib/beat-meta.mjs`, also used by `beat-drop-watch.mjs`). Fill `data/genre-playlists.json` (`{"Soul / R&B": "<youtube playlist url>"}`) to attach a playlist per genre.
- Prices: existing scheme (MP3 24.99 / WAV 34.99 / STEMS 59.99 / EXCLUSIVE 249.99).
- No HTTP publish endpoint: Vercel functions can't see your local inbox, so the CLI is the publish path.

## Env vars to set in Vercel
| Var | Needed for |
|---|---|
| `STRIPE_SECRET_KEY` | checkout (use `sk_test_…` first) |
| `STRIPE_WEBHOOK_SECRET` | webhook; endpoint `https://rmlur.com/api/stripe-webhook`, event `checkout.session.completed` |
| `NEXT_PUBLIC_SITE_URL` | optional; defaults to request origin |
| `RESEND_API_KEY`, `MAIL_FROM` | optional download email |
| `DROPBOX_REFRESH_TOKEN` + `DROPBOX_APP_KEY` + `DROPBOX_APP_SECRET` | Dropbox delivery (recommended; never expires) |
| `DROPBOX_ACCESS_TOKEN` | Dropbox delivery, simple alternative (short-lived unless it is a long-lived legacy token) |
| `DATABASE_URL` | already in use |

## Still open
- Real floppy photo: save watermark-free image at `assets/store/floppy-3.5-blue.png` (SVG placeholder used until then).
- Deliverables: tiers without a `deliverableUrl` show "files will be emailed" on `/thanks.html`.
- Track B (floppy cabinet) not started.

## Track B — floppy cabinet (lab, not linked from the site)
- Route: `/lab/floppy/` (noindex). Code: `lab/floppy/{index.html,cabinet.js,cabinet-data.js}`; content config: `data/cabinet.config.json`.
- 2×3 beige drawer cabinet built procedurally in Three.js (no Blender asset): cream ABS with procedural wear, clear label windows, lock plates, finger slots, red slides, grey dividers in the vault, white diamond key. Drawers slide on real z-travel; camera drops to look into the open bin. Esc closes.
- Drawers are driven by `data/cabinet.config.json` (genre → drawer; anything unmatched → UNSORTED). Disks show title / genre / bpm·key on a ruled label; selecting one lifts it and opens a panel with Play, license picker and Buy (same `/api/checkout` flow as `/store`).
- VAULT (locked): holds products flagged `vault:true` (sidecar `{"vault":true}` for publish-beats). Key animates into the lock; right password turns and opens, wrong one jams. **Default password `rmlur` — change `passwordHash` in the config** (command in the config's `_comment`). This is UI gating only: the hash and the vault catalog entries are public files, so don't put anything there that must stay secret.
- Tests: `npm test` covers drawer assignment and the password check.
- Not done: Blender/GLB photoreal pass with baked textures, dust/scuff detail maps, mobile polish, `/api/products` does not return `vault` (vault items come from the JSON catalog only), swapping the molded mark text from "rmlur" if you want a different mark.

## Dropbox delivery
- A tier's deliverable can be `dropbox:/path/in/your/Dropbox/Name.wav` or an existing Dropbox share link. `/api/order` (the `/thanks.html` page) resolves a path into a fresh 4-hour temporary link on every load, so the emailed thanks-page link keeps working; share links are forced to `dl=1`. Anything else (Vercel Blob URLs) passes through unchanged.
- No credentials or a Dropbox error -> the buyer sees "files will be emailed" (manual fulfilment) instead of a broken link. Paths and tokens never reach the public `/api/products`.
- Setup: create a Dropbox app (scoped access, permission `files.content.read`, access to the folder holding your masters), then set the env vars above in Vercel. Refresh-token flow: authorize once with `token_access_type=offline` to get the refresh token.
- Per beat, in the `Name.json` sidecar: `{"dropbox": {"mp3": "dropbox:/RMLUR/Beats/Name.mp3", "wav": "dropbox:/RMLUR/Beats/Name.wav", "stems": "dropbox:/RMLUR/Beats/Name STEMS.zip", "exclusive": "dropbox:/RMLUR/Beats/Name STEMS.zip"}}`. With `npm run publish-beats --sync` those tiers point at Dropbox and nothing is uploaded to Blob; any tier without an entry still falls back to Blob.
- The admin upload's `deliverable` field also accepts `dropbox:/...`.
- Not built: uploading masters *to* Dropbox from the CLI (you keep the files there yourself).
