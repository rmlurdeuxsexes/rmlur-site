# Creative Mode CMS — Design

Status: draft, awaiting review
Scope: sub-project 1 of 4 from the RMLUR marketplace vision (see
`CLAUDE.md`'s "Future feature" notes for the other three — YouTube
auto-ingestion and GlamPush-app export are explicitly out of scope here).

## Goal

Replace the hardcoded `products.js` catalog with a real backend so RMLUR
can add new products (beats, kits, and new types — loop kits, sample
packs, project files) through a private upload page, without hand-editing
a JS file and pushing to git for every new item. Modeled on BeatStars
Creative Mode: name it, tag it, upload it, it's live.

## Non-goals (this pass)

- YouTube metadata auto-ingestion (needs the user's own Google API
  credentials — separate sub-project).
- Direct upload from the GlamPush Electron app (separate sub-project,
  touches both codebases).
- Payment automation — purchases still go through Stripe Payment Links +
  manual delivery, exactly as today. This project only changes how a
  product *enters the catalog*, not how it's sold or delivered.
- Multi-user accounts — this is a single-operator (RMLUR) admin tool.

## Architecture

Three new pieces on top of the existing static site, all native to
Vercel — no framework adopted, no build step introduced for the existing
static pages:

1. **Vercel Postgres (Neon)** — one `products` table, replacing the
   `window.PRODUCTS` array in `products.js`.
2. **Vercel Blob** — stores every uploaded file (cover art, audio
   previews, and the actual deliverables: loop kit archives, project
   files, stems). Public access for cover art/previews; the same
   public-URL model the current Stripe+Dropbox delivery already uses for
   trust (RMLUR already hands out direct links today).
3. **Vercel Serverless Functions** (`/api/*.js`, Node runtime, zero
   config) — a handful of small endpoints, listed below. These deploy
   alongside the static files automatically; nothing about `index.html`,
   `shop.html`, etc. changes in how they're served.

```
Browser (admin page)          Browser (shop page)
      |                              |
      | 1. login (password)          | 4. GET /api/products
      v                              v
/api/admin-login              /api/products  ---> Postgres (read)
      | (sets signed cookie)
      v
/api/blob-upload-token  ---> Vercel Blob (direct browser upload)
      |
      | 2. files land in Blob, browser gets back URLs
      v
/api/admin-upload  ---> Postgres (insert/update row)
      | (cookie required)      3. metadata + Blob URLs POSTed here
```

## Data model

`products` table (Postgres), one row per catalog entry — same shape the
site already renders, so `floppy-bay.js` and `shop.js` need **no
rendering changes**, only a different data source:

| column      | type      | notes                                             |
|-------------|-----------|----------------------------------------------------|
| id          | text PK   | slug, e.g. `midnight-pager`                        |
| type        | text      | `beat` \| `kit` \| `loopkit` \| `sample` \| `project` |
| title       | text      |                                                     |
| subtitle    | text      | nullable                                           |
| bpm         | int       | nullable                                           |
| key         | text      | nullable                                           |
| bars        | int       | nullable                                           |
| genre       | text      |                                                     |
| cover_url   | text      | Blob URL                                           |
| preview_url | text      | Blob URL, nullable (project files may have no audio preview) |
| deliverable_url | text  | Blob URL — the actual paid download. One file per product: a loop kit with multiple samples, or a project file with its assets, gets zipped before upload rather than modeling multi-file products. |
| tags        | text[]    |                                                     |
| info        | text      |                                                     |
| tiers       | jsonb     | same `{id, label, price, stripeLink}[]` shape as today |
| exclusive   | jsonb     | nullable, same shape as today                      |
| created_at  | timestamptz | default now()                                    |

`type` grows from the current `beat`/`kit` to include `loopkit`,
`sample`, `project` — `shop.js`'s existing type-tab filter
(`data-filter="beat"` etc.) gets matching tabs added; `floppy-bay.js`'s
genre-compartment logic is untouched since it groups by `genre`, not
`type`.

## Components

**`/api/products.js`** (GET, public) — reads all rows, returns the exact
JSON shape `window.PRODUCTS` is today. `shop.js` fetches this instead of
relying on the `<script src="products.js">` tag.

**`/api/admin-login.js`** (POST `{password}`) — compares against
`process.env.ADMIN_PASSWORD` (constant-time compare), on match sets an
HTTP-only signed cookie (HMAC over an expiry timestamp using
`process.env.ADMIN_SESSION_SECRET`, Node's built-in `crypto` — no new
dependency for something this small).

**`/api/blob-upload-token.js`** (POST, cookie required) — issues a
short-lived Vercel Blob client upload token via `@vercel/blob/client`'s
`handleUpload`, so large files (project files, stems) go straight from
the browser to Blob and never pass through a serverless function's
request-body limit.

**`/api/admin-upload.js`** (POST, cookie required) — receives the product
metadata plus the Blob URLs from step above, validates required fields,
writes the row to Postgres.

**`admin/index.html` + `admin/admin.js`** — a plain HTML form (matching
the site's existing mono/paper visual language, not a separate design
system): password gate, then fields for every column above, file pickers
for cover/preview/deliverable, submit button. No framework — same
vanilla-JS pattern as the rest of the site.

**`shop.js` change** — replace the `<script src="products.js">` tag and
its implicit `window.PRODUCTS` with an async `fetch('/api/products')`
before calling `floppyBay.init(...)`. Everything downstream
(`floppy-bay.js`) is unaffected — it already just receives a `products`
array.

**Migration** — a one-time seed script (run once, by hand, not part of
the app) that inserts the 3 existing `products.js` entries into the new
table, so nothing existing disappears when the switch flips.

## Error handling

- Wrong admin password → 401, form shows "incorrect password," no detail
  leaked about whether the account/session exists (there's only one).
- Missing required field on upload → 400 with the specific field named,
  shown inline on the form.
- Blob upload failure (network, file too large for plan) → surfaced in
  the form before the metadata POST ever fires, so a failed file upload
  never creates a half-written catalog row.
- `/api/admin-upload` DB failure → 500, form keeps the entered data so
  RMLUR doesn't retype everything on retry.
- `/api/products` DB failure (shop-facing) → `shop.js` falls back to
  showing the empty-state message already built for zero results,
  rather than a broken page.

## Testing

No automated test framework exists in this repo today, and this is a
single-operator admin tool, not user-facing logic — verification is
live, matching how every other change in this repo has been checked:

1. Seed migration runs, `/api/products` returns the 3 existing products
   unchanged — shop page renders identically to today.
2. Log into `/admin` with the correct password → succeeds; wrong password
   → rejected.
3. Upload a test loop kit (small file) end to end → appears in
   `/api/products`, appears in the shop's floppy bay in its genre's
   compartment.
4. Upload a large (100MB+) file → confirms the direct-to-Blob path
   works and doesn't hit a serverless body-size limit.
5. Reload the shop page fresh → new item persists (proves it's really in
   Postgres, not just local state).

## Open items for the implementation plan

- Exact Postgres provisioning path (Vercel's native Neon integration via
  the dashboard/CLI — will confirm the precise flow when implementing).
- Whether `tags` needs to be searchable server-side eventually (not
  needed now — `shop.js` already does client-side search over the full
  fetched list).
