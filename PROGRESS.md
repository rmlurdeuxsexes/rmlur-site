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

## Cloudflare R2 — private beat storage (free 10 GB, no download fees)
Masters/MP3s/stems go to a PRIVATE R2 bucket; the DB stores `r2:<key>`; after payment `/thanks.html` mints a 4-hour presigned link (`api/_lib/r2.js`, no SDK).
1. Cloudflare dashboard → R2 → Create bucket (e.g. `rmlur-beats`), leave it private.
2. R2 → Manage API tokens → Create token, permission **Object Read & Write**, scoped to that bucket. Copy the Access Key ID + Secret.
3. Account ID: R2 overview page (right side).
4. Vercel env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (then redeploy). Put the same four in your local `.env.production.local` with `DATABASE_URL`.
5. `npm run publish-beats -- --sync` (or the `beat-drop-watch.mjs` folder watcher) uploads to R2 whenever the R2 vars are set. Priority per tier: sidecar `dropbox` entry > R2 > Vercel Blob.

### Add a beat from the browser (no CLI) — `/admin`
Log in, fill title/genre/BPM, pick the WAV (+ optional MP3, stems zip, cover, preview), Publish. Paid files go browser -> private R2 via a presigned PUT (`/api/admin-r2-presign`); tiers (WAV default, MP3 cheaper, STEMS, EXCLUSIVE) and the product row are written by `/api/admin-upload`.
One-time bucket setting — R2 -> bucket -> Settings -> CORS policy:
`[{"AllowedOrigins":["https://rmlur.com","https://www.rmlur.com"],"AllowedMethods":["PUT"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]`
Needs Vercel env: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `R2_*`, `DATABASE_URL`.

## Env vars to set in Vercel
| Var | Needed for |
|---|---|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | private file storage + paid downloads (see R2 section) |
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

## Track B — Blender pass
- `scripts/blender/build_cabinet.py` (headless Blender via `pip install bpy numpy pillow`) builds the cabinet kit with real bevels and boolean-cut recesses, a procedural cream-ABS material (edge wear, crevice dust, scuffs, grain), bakes albedo / roughness / normal (2048 for cabinet and drawer) and exports `assets/cabinet/cabinet.glb` (~1.8 MB). Run: `python scripts/blender/build_cabinet.py --out assets/cabinet --res 2048` (the bake takes ~25 min on CPU); `--reuse` skips objects whose PNGs already exist in `--out` (the PNGs are gitignored build intermediates); `--render x.png` writes a showcase render.
- `/lab/floppy/` loads the GLB (shell, drawer with window and label quads, disk, divider, key) and falls back to the procedural cabinet if the file is missing or fails.
- Glyphs on label quads use `flipY: false` because glTF UVs are top-down; disk tints multiply a grey baked shell.
- Material tune (calibrated against the reference photo, measured on plastic-coloured pixels of the closed view): reference mean (181,178,172), p5/p50/p95 value 0.44/0.75/0.79, saturation ~0.05. The first bake was too white with tan dust halos (mean 196, p95 0.88, mottled); now the base albedo is darker/greyer, large-scale blotches are off, dust/edge wear are subtle, and the page uses exposure 1.55, hemisphere 1.0, key 2.0, fill 0.35 plus a cool colour trim (`KIT_TINT`) -> mean ~(175,172,165), sat ~0.06. `window.__cabinet.tune` exposes the renderer and lights for sweeps.
- Still open: compare on a real GPU, a bake for the window frame/lip detail, mobile polish.
