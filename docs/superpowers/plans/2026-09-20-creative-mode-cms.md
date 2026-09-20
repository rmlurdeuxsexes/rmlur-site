# Creative Mode CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `products.js` catalog with a Postgres + Vercel Blob backend and a password-gated `/admin` upload page, so new beats/kits/loop-kits/samples/project-files can be added to rmlur.com without hand-editing and pushing a JS file.

**Architecture:** Vercel Serverless Functions (`/api/*.js`, Web-standard `fetch(request)` handlers, no framework) read/write a `products` table in Neon Postgres (provisioned via Vercel's native integration) and issue direct-to-browser upload tokens for Vercel Blob. The existing static pages (`shop.html`, `floppy-bay.js`) are untouched except for `shop.js`, which fetches `/api/products` instead of loading `products.js` as a script tag.

**Tech Stack:** Vercel Functions (Node.js runtime, ESM, Web-standard `Request`/`Response`), `@neondatabase/serverless` (Postgres client), `@vercel/blob` + `@vercel/blob/client` (file storage), Node's built-in `crypto` (session signing — no auth library needed).

**Spec:** `docs/superpowers/specs/2026-09-20-creative-mode-cms-design.md`

## Global Constraints

- No framework is introduced. The existing static HTML/CSS/JS pages keep deploying exactly as they do today; only `/api/*.js` and `admin/*` are new.
- No automated test framework exists in this repo and none is introduced here — every task's "verify" step is a concrete `curl` command or browser check with an exact expected result, per the spec's Testing section.
- All new npm packages go in one `package.json` at the repo root: `@neondatabase/serverless`, `@vercel/blob`. Nothing else.
- Every `/api/*.js` file is a Web-standard handler: `export default { fetch(request) { ... return new Response(...); } }` — this is required for `@vercel/blob/client`'s `handleUpload` to work (it reads `request.headers`), and it's Vercel's current zero-config convention.
- Cookie session secret and admin password are read from `process.env.ADMIN_SESSION_SECRET` / `process.env.ADMIN_PASSWORD` — never hardcoded.

---

## Task 1: Provision infrastructure and project scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore` (add `node_modules/`, `.vercel/`, `.env.local` if not already present)

**Interfaces:**
- Produces: `DATABASE_URL` env var (Neon Postgres connection string), a Vercel Blob store linked to the `rmlur-site` project, `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` env vars. All later tasks depend on these existing.

- [ ] **Step 1: Confirm the Vercel CLI is installed and linked to this project**

Run:
```bash
vercel --version
```
Expected: prints a version number. If the command isn't found: `npm i -g vercel`.

From the repo root (`~/Desktop/rmlur-site`):
```bash
vercel link
```
Follow the prompts to link to the existing `rmlur-site` project under the `rmlur` team. Expected: creates `.vercel/project.json`.

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "rmlur-site",
  "private": true,
  "type": "module",
  "dependencies": {
    "@neondatabase/serverless": "^0.10.0",
    "@vercel/blob": "^0.27.0"
  }
}
```

Run `npm install` locally so the packages resolve (needed for later local verification scripts).

- [ ] **Step 3: Add `.gitignore` entries**

Append to `.gitignore` (create the file if it doesn't exist):
```
node_modules/
.vercel/
.env.local
```

- [ ] **Step 4: Provision Neon Postgres**

```bash
vercel install neon --name rmlur-catalog --plan free -e production -e preview -e development
```
Follow any interactive prompts (choose the `rmlur` team/`rmlur-site` project if asked).

Verify the env var it created:
```bash
vercel env ls
```
Expected: a `DATABASE_URL` entry (or similarly named Postgres connection var — if the name differs, e.g. `POSTGRES_URL`, use that exact name in every task below instead of `DATABASE_URL`, and note the substitution here in this file).

- [ ] **Step 5: Provision Vercel Blob**

```bash
vercel blob store add rmlur-uploads
```
If that subcommand isn't available in your CLI version, use the dashboard instead: Vercel dashboard → rmlur team → Storage → Create → Blob → name it `rmlur-uploads` → connect it to the `rmlur-site` project.

Verify:
```bash
vercel env ls
```
Expected: a `BLOB_READ_WRITE_TOKEN` entry now exists.

- [ ] **Step 6: Generate and set the admin auth secrets**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output. Then:
```bash
vercel env add ADMIN_SESSION_SECRET production
# paste the generated hex string when prompted
vercel env add ADMIN_SESSION_SECRET preview
# paste the same value
```
Pick a real password RMLUR will actually use to log into `/admin`, then:
```bash
vercel env add ADMIN_PASSWORD production
vercel env add ADMIN_PASSWORD preview
```

- [ ] **Step 7: Pull env vars locally for the rest of this plan's local verification steps**

```bash
vercel env pull .env.local
```
Expected: `.env.local` now contains `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD`. Every later "run locally" step in this plan assumes these are loaded, e.g. via `node --env-file=.env.local scripts/foo.mjs`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "Add package.json for Vercel Functions dependencies (Neon Postgres, Vercel Blob)"
```

(`.env.local` and `.vercel/` are gitignored — never commit real secrets.)

---

## Task 2: Session auth helper

**Files:**
- Create: `api/_lib/auth.js`

**Interfaces:**
- Produces: `checkPassword(candidate: string): boolean`, `createSessionCookie(): string` (a full `Set-Cookie` header value), `verifySession(request: Request): boolean`.
- Consumes: `process.env.ADMIN_PASSWORD`, `process.env.ADMIN_SESSION_SECRET`.

- [ ] **Step 1: Write `api/_lib/auth.js`**

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'rmlur_admin';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function sign(value) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function checkPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD || '';
  const a = Buffer.from(candidate || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // timingSafeEqual requires equal-length buffers
  return timingSafeEqual(a, b);
}

export function createSessionCookie() {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = String(expires);
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function verifySession(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const [payload, sig] = decodeURIComponent(match[1]).split('.');
  if (!payload || !sig) return false;
  const expectedSig = sign(payload);
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return false;
  const expires = parseInt(payload, 10);
  return Number.isFinite(expires) && Date.now() < expires;
}

function demo() {
  process.env.ADMIN_SESSION_SECRET = 'test-secret';
  process.env.ADMIN_PASSWORD = 'hunter2';

  console.assert(checkPassword('hunter2') === true, 'FAIL: correct password should pass');
  console.assert(checkPassword('wrong') === false, 'FAIL: wrong password should fail');

  const cookie = createSessionCookie();
  const tokenPart = cookie.split(';')[0].split('=')[1];
  const goodRequest = { headers: { get: (name) => (name.toLowerCase() === 'cookie' ? `rmlur_admin=${tokenPart}` : null) } };
  console.assert(verifySession(goodRequest) === true, 'FAIL: freshly created session should verify');

  const tamperedRequest = { headers: { get: () => `rmlur_admin=${tokenPart}00` } };
  console.assert(verifySession(tamperedRequest) === false, 'FAIL: tampered token should not verify');

  const noCookieRequest = { headers: { get: () => null } };
  console.assert(verifySession(noCookieRequest) === false, 'FAIL: missing cookie should not verify');

  console.log('api/_lib/auth.js self-check passed');
}

if (import.meta.url === `file://${process.argv[1]}`) demo();
```

- [ ] **Step 2: Run the self-check**

```bash
node api/_lib/auth.js
```
Expected output: `api/_lib/auth.js self-check passed` with no assertion failures printed above it.

- [ ] **Step 3: Commit**

```bash
git add api/_lib/auth.js
git commit -m "Add HMAC-based admin session auth helper"
```

---

## Task 3: Database setup script and query helper

**Files:**
- Create: `api/_lib/db.js`
- Create: `scripts/setup-db.mjs`

**Interfaces:**
- Produces: `sql` (a tagged-template query function from `@neondatabase/serverless`'s `neon()`), exported from `api/_lib/db.js`, used by every later `/api` file that touches Postgres.
- Consumes: `process.env.DATABASE_URL` (from Task 1).

- [ ] **Step 1: Write `api/_lib/db.js`**

```js
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);
```

- [ ] **Step 2: Write `scripts/setup-db.mjs`**

This creates the table and seeds the 3 products that exist in today's `products.js`, preserving their exact current asset paths so the shop renders identically after the switch.

```js
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const SEED_PRODUCTS = [
  {
    id: 'midnight-pager', type: 'beat', title: 'MIDNIGHT PAGER', subtitle: 'griselda type beat',
    bpm: 87, key: 'F#m', bars: 32, genre: 'Trap / Boom Bap',
    cover_url: 'assets/midnight-pager.jpg', preview_url: 'previews/midnight-pager.mp3', deliverable_url: null,
    tags: ['dark', 'boom bap', 'vinyl'],
    info: 'Dusty boom-bap loop built around a chopped vinyl sample, hard-panned hats, and a sub that sits low in the mix. Untagged WAV and trackout stems available for mixing/mastering.',
    tiers: [
      { id: 'mp3', label: 'MP3', price: 24.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
      { id: 'wav', label: 'WAV', price: 34.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
      { id: 'stems', label: 'STEMS', price: 59.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
    ],
    exclusive: { price: 249.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
  },
  {
    id: 'deux-sexes-drums-v1', type: 'kit', title: 'DEUX SEXES DRUMS V1', subtitle: 'mpc2000xl one-shots • 90 sounds',
    bpm: null, key: null, bars: null, genre: 'Drum Kit',
    cover_url: 'assets/deux-sexes-drums-v1.jpg', preview_url: 'previews/deux-sexes-drums-v1.mp3', deliverable_url: null,
    tags: ['drum kit', 'one shots', '12-bit'],
    info: '90 one-shots sampled straight off a customized MPC2000XL at 12-bit — kicks, snares, hats, percs, and a few foley oddballs. Royalty-free, use in unlimited projects.',
    tiers: [
      { id: 'mp3', label: 'MP3', price: 14.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
      { id: 'wav', label: 'WAV', price: 24.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
      { id: 'stems', label: 'FULL KIT', price: 39.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
    ],
    exclusive: null,
  },
  {
    id: 'getty-tape', type: 'beat', title: 'GETTY TAPE', subtitle: 'smooth soul flip',
    bpm: 74, key: 'Bbmaj', bars: 16, genre: 'Soul / R&B',
    cover_url: 'assets/getty-tape.jpg', preview_url: 'previews/getty-tape.mp3', deliverable_url: null,
    tags: ['soul', 'sample', 'chops'],
    info: 'Warm soul flip chopped into a 16-bar loop — mellow keys, tape-saturated drums, room for a vocalist to ride pocket. WAV and stems include the raw chop for re-arranging.',
    tiers: [
      { id: 'mp3', label: 'MP3', price: 24.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
      { id: 'wav', label: 'WAV', price: 34.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
      { id: 'stems', label: 'STEMS', price: 59.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
    ],
    exclusive: { price: 199.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
  },
];

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      bpm INTEGER,
      key TEXT,
      bars INTEGER,
      genre TEXT NOT NULL,
      cover_url TEXT,
      preview_url TEXT,
      deliverable_url TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      info TEXT,
      tiers JSONB NOT NULL DEFAULT '[]',
      exclusive JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  for (const p of SEED_PRODUCTS) {
    await sql`
      INSERT INTO products (id, type, title, subtitle, bpm, key, bars, genre, cover_url, preview_url, deliverable_url, tags, info, tiers, exclusive)
      VALUES (${p.id}, ${p.type}, ${p.title}, ${p.subtitle}, ${p.bpm}, ${p.key}, ${p.bars}, ${p.genre}, ${p.cover_url}, ${p.preview_url}, ${p.deliverable_url}, ${p.tags}, ${p.info}, ${JSON.stringify(p.tiers)}, ${p.exclusive ? JSON.stringify(p.exclusive) : null})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  const { rows } = await sql`SELECT count(*)::int AS count FROM products`;
  console.log(`DB setup complete. products table has ${rows[0].count} row(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Run it against the real database**

```bash
node --env-file=.env.local scripts/setup-db.mjs
```
Expected: `DB setup complete. products table has 3 row(s).`

Run it a second time to confirm it's safe to re-run:
```bash
node --env-file=.env.local scripts/setup-db.mjs
```
Expected: same output, still 3 rows (the `ON CONFLICT DO NOTHING` prevents duplicates).

- [ ] **Step 4: Commit**

```bash
git add api/_lib/db.js scripts/setup-db.mjs
git commit -m "Add products table schema and seed migration from products.js"
```

---

## Task 4: `/api/products` read endpoint

**Files:**
- Create: `api/products.js`

**Interfaces:**
- Consumes: `sql` from `api/_lib/db.js` (Task 3).
- Produces: `GET /api/products` → `200 application/json`, an array of product objects shaped exactly like today's `window.PRODUCTS` (camelCase keys: `id, type, title, subtitle, bpm, key, bars, genre, cover, preview, deliverable, tags, info, tiers, exclusive`). This exact shape is what Task 5 (`shop.js`) and `floppy-bay.js` depend on.

- [ ] **Step 1: Write `api/products.js`**

```js
import { sql } from './_lib/db.js';

function toProduct(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    bpm: row.bpm,
    key: row.key,
    bars: row.bars,
    genre: row.genre,
    cover: row.cover_url,
    preview: row.preview_url,
    deliverable: row.deliverable_url,
    tags: row.tags,
    info: row.info,
    tiers: row.tiers,
    exclusive: row.exclusive,
  };
}

export default {
  async fetch(request) {
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    try {
      const rows = await sql`SELECT * FROM products ORDER BY created_at ASC`;
      return Response.json(rows.map(toProduct));
    } catch (err) {
      console.error('[api/products] DB error:', err);
      return Response.json([], { status: 200 }); // shop.js's empty-state handles this gracefully
    }
  },
};
```

- [ ] **Step 2: Deploy and verify against the real database**

```bash
vercel deploy
```
Note the preview URL it prints, then:
```bash
curl -s https://<preview-url>/api/products | node -e "process.stdin.resume(); process.stdin.on('data', d => { const products = JSON.parse(d); console.assert(products.length === 3, 'expected 3 products, got ' + products.length); console.assert(products[0].id === 'midnight-pager', 'expected first product to be midnight-pager'); console.log('OK:', products.map(p => p.id)); })"
```
Expected: `OK: [ 'midnight-pager', 'deux-sexes-drums-v1', 'getty-tape' ]` with no assertion failures.

- [ ] **Step 3: Commit**

```bash
git add api/products.js
git commit -m "Add public GET /api/products endpoint reading from Postgres"
```

---

## Task 5: Switch `shop.js` to fetch the catalog instead of the static script

**Files:**
- Modify: `shop.html` (remove the `products.js` script tag)
- Modify: `shop.js`

**Interfaces:**
- Consumes: `GET /api/products` (Task 4).
- Produces: no change to what downstream code receives — `window.floppyBay.init(products, opts)` still gets the same shape it always has, so `floppy-bay.js` needs zero changes.

- [ ] **Step 1: Read the current `shop.js` init sequence**

Find where `shop.js` currently reads `window.PRODUCTS` and calls `window.floppyBay.init(...)`. Wrap that in an async bootstrap that fetches the catalog first:

```js
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('bad response');
    return await res.json();
  } catch (err) {
    console.error('[shop] failed to load /api/products:', err);
    return [];
  }
}
```

Wrap the existing DOMContentLoaded body (or the top-level init code, whichever this file uses) so the part that references `window.PRODUCTS` and calls `floppyBay.init` runs *after* `await loadProducts()` resolves, using the fetched array in place of `window.PRODUCTS`. Do not change anything else in the file — filter/sort/genre-pill logic already added by other work in this repo keeps operating on the same array shape.

- [ ] **Step 2: Remove the static script tag from `shop.html`**

Find `<script src="products.js"></script>` in `shop.html` and delete that line. Leave every other script tag (`floppy-bay.js`, `shop.js`, `vendor/three.min.js`, etc.) exactly where they are.

- [ ] **Step 3: Verify live in the browser**

Start a local static server for the site (or use a Vercel preview deploy from Task 4):
```bash
cd ~/Desktop/rmlur-site && python3 -m http.server 8200
```
Note: `/api/products` won't resolve on a plain `python3 -m http.server` (no serverless functions locally) — for this verification step use the Vercel preview URL from Task 4's Step 2 instead, not the local static server.

Open the preview URL's `/shop.html` in a browser. Expected: the same 3 products render in the floppy bay, in the same 3 genre compartments, exactly as before this task. Open the browser console: no errors.

- [ ] **Step 4: Commit**

```bash
git add shop.html shop.js
git commit -m "Fetch the catalog from /api/products instead of the static products.js script"
```

---

## Task 6: `/api/blob-upload-token` — cookie-gated Blob client upload token

**Files:**
- Create: `api/blob-upload-token.js`

**Interfaces:**
- Consumes: `verifySession(request)` from `api/_lib/auth.js` (Task 2).
- Produces: `POST /api/blob-upload-token` → the JSON body `@vercel/blob/client`'s `upload()` helper expects when given a custom `handleUploadUrl`. Task 9's admin page calls this indirectly (the `upload()` helper calls it for you — you never call it directly from your own code, but it must exist at this exact path for `handleUploadUrl: '/api/blob-upload-token'` to work).

- [ ] **Step 1: Write `api/blob-upload-token.js`**

```js
import { handleUpload } from '@vercel/blob/client';
import { verifySession } from './_lib/auth.js';

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    if (!verifySession(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();

    try {
      const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async () => ({
          allowedContentTypes: [
            'image/jpeg', 'image/png', 'image/webp',
            'audio/mpeg', 'audio/wav', 'audio/x-wav',
            'application/zip', 'application/x-zip-compressed',
          ],
          addRandomSuffix: true,
        }),
        onUploadCompleted: async ({ blob }) => {
          console.log('[blob-upload-token] upload completed:', blob.url);
        },
      });
      return Response.json(jsonResponse);
    } catch (err) {
      console.error('[api/blob-upload-token] error:', err);
      return Response.json({ error: err.message }, { status: 400 });
    }
  },
};
```

- [ ] **Step 2: Deploy and verify the auth gate**

```bash
vercel deploy
```

Without a session cookie:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<preview-url>/api/blob-upload-token -H "Content-Type: application/json" -d '{}'
```
Expected: `401`

(Full success-path verification — with a valid cookie — happens in Task 9, once the login endpoint from Task 7 exists to actually produce one.)

- [ ] **Step 3: Commit**

```bash
git add api/blob-upload-token.js
git commit -m "Add cookie-gated Vercel Blob client-upload token endpoint"
```

---

## Task 7: `/api/admin-login` endpoint

**Files:**
- Create: `api/admin-login.js`

**Interfaces:**
- Consumes: `checkPassword`, `createSessionCookie` from `api/_lib/auth.js` (Task 2).
- Produces: `POST /api/admin-login` with JSON body `{ password: string }` → `200` with `Set-Cookie` header on success, `401` on wrong password.

- [ ] **Step 1: Write `api/admin-login.js`**

```js
import { checkPassword, createSessionCookie } from './_lib/auth.js';

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'invalid JSON body' }, { status: 400 });
    }

    if (!checkPassword(body.password)) {
      return Response.json({ error: 'incorrect password' }, { status: 401 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': createSessionCookie(),
      },
    });
  },
};
```

- [ ] **Step 2: Deploy and verify both paths**

```bash
vercel deploy
```

Wrong password:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<preview-url>/api/admin-login -H "Content-Type: application/json" -d '{"password":"wrong"}'
```
Expected: `401`

Correct password (use the real value you set in Task 1 Step 6):
```bash
curl -s -i -X POST https://<preview-url>/api/admin-login -H "Content-Type: application/json" -d '{"password":"<the real ADMIN_PASSWORD value>"}'
```
Expected: `HTTP/2 200` with a `set-cookie: rmlur_admin=...` header in the response.

- [ ] **Step 3: Verify `/api/blob-upload-token` now accepts that cookie**

Save the cookie from the previous step and reuse it:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<preview-url>/api/blob-upload-token \
  -H "Content-Type: application/json" \
  -H "Cookie: rmlur_admin=<the token value from the set-cookie header>" \
  -d '{}'
```
Expected: not `401` anymore (it may still be `400` because `{}` isn't a real `handleUpload` payload — the point of this check is confirming the auth gate passes, not exercising the full upload flow).

- [ ] **Step 4: Commit**

```bash
git add api/admin-login.js
git commit -m "Add admin login endpoint"
```

---

## Task 8: `/api/admin-upload` endpoint

**Files:**
- Create: `api/admin-upload.js`

**Interfaces:**
- Consumes: `verifySession` from `api/_lib/auth.js` (Task 2), `sql` from `api/_lib/db.js` (Task 3).
- Produces: `POST /api/admin-upload` with a JSON body matching the `products` columns (camelCase, matching Task 4's `toProduct` shape in reverse) → inserts a row, returns `201` with the created product, or `400`/`401`/`500` on failure.

- [ ] **Step 1: Write `api/admin-upload.js`**

```js
import { verifySession } from './_lib/auth.js';
import { sql } from './_lib/db.js';

const REQUIRED_FIELDS = ['id', 'type', 'title', 'genre'];
const VALID_TYPES = ['beat', 'kit', 'loopkit', 'sample', 'project'];

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    if (!verifySession(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'invalid JSON body' }, { status: 400 });
    }

    for (const field of REQUIRED_FIELDS) {
      if (!body[field]) {
        return Response.json({ error: `missing required field: ${field}` }, { status: 400 });
      }
    }
    if (!VALID_TYPES.includes(body.type)) {
      return Response.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }

    try {
      const rows = await sql`
        INSERT INTO products (id, type, title, subtitle, bpm, key, bars, genre, cover_url, preview_url, deliverable_url, tags, info, tiers, exclusive)
        VALUES (
          ${body.id}, ${body.type}, ${body.title}, ${body.subtitle ?? null},
          ${body.bpm ?? null}, ${body.key ?? null}, ${body.bars ?? null}, ${body.genre},
          ${body.cover ?? null}, ${body.preview ?? null}, ${body.deliverable ?? null},
          ${body.tags ?? []}, ${body.info ?? null},
          ${JSON.stringify(body.tiers ?? [])}, ${body.exclusive ? JSON.stringify(body.exclusive) : null}
        )
        ON CONFLICT (id) DO UPDATE SET
          type = EXCLUDED.type, title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
          bpm = EXCLUDED.bpm, key = EXCLUDED.key, bars = EXCLUDED.bars, genre = EXCLUDED.genre,
          cover_url = EXCLUDED.cover_url, preview_url = EXCLUDED.preview_url, deliverable_url = EXCLUDED.deliverable_url,
          tags = EXCLUDED.tags, info = EXCLUDED.info, tiers = EXCLUDED.tiers, exclusive = EXCLUDED.exclusive
        RETURNING *
      `;
      return Response.json(rows[0], { status: 201 });
    } catch (err) {
      console.error('[api/admin-upload] DB error:', err);
      return Response.json({ error: 'database write failed' }, { status: 500 });
    }
  },
};
```

- [ ] **Step 2: Deploy and verify**

```bash
vercel deploy
```

Without a cookie:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<preview-url>/api/admin-upload -H "Content-Type: application/json" -d '{}'
```
Expected: `401`

With a valid cookie (from Task 7 Step 2), missing a required field:
```bash
curl -s -X POST https://<preview-url>/api/admin-upload \
  -H "Content-Type: application/json" \
  -H "Cookie: rmlur_admin=<token>" \
  -d '{"title":"Test"}'
```
Expected: `400` with `{"error":"missing required field: id"}`

With a valid cookie and a complete payload:
```bash
curl -s -X POST https://<preview-url>/api/admin-upload \
  -H "Content-Type: application/json" \
  -H "Cookie: rmlur_admin=<token>" \
  -d '{"id":"test-loop-kit-1","type":"loopkit","title":"Test Loop Kit","genre":"EDM","tiers":[{"id":"mp3","label":"MP3","price":9.99,"stripeLink":"https://example.com"}]}'
```
Expected: `201` with the full inserted row echoed back.

Confirm it shows up in the public endpoint:
```bash
curl -s https://<preview-url>/api/products | grep test-loop-kit-1
```
Expected: the new product appears in the array.

Clean up the test row so it doesn't linger in the real catalog:
```bash
node --env-file=.env.local -e "import('./api/_lib/db.js').then(({sql}) => sql\`DELETE FROM products WHERE id = 'test-loop-kit-1'\`).then(() => console.log('cleaned up'))"
```

- [ ] **Step 3: Commit**

```bash
git add api/admin-upload.js
git commit -m "Add cookie-gated admin upload endpoint"
```

---

## Task 9: Admin upload page

**Files:**
- Create: `admin/index.html`
- Create: `admin/admin.js`
- Create: `admin/admin.css`

**Interfaces:**
- Consumes: `POST /api/admin-login` (Task 7), `POST /api/blob-upload-token` via `@vercel/blob/client`'s `upload()` (Task 6), `POST /api/admin-upload` (Task 8).

- [ ] **Step 1: Write `admin/admin.css`**

Match the site's existing mono/paper visual language (reuse the same CSS custom properties `style.css` already defines at the repo root — link to it rather than redefining colors):

```css
body{max-width:560px;margin:0 auto;padding:60px 24px;font-family:var(--font-mono);color:var(--ink);background:var(--paper)}
h1{font-size:14px;letter-spacing:.24em;text-transform:uppercase;margin-bottom:32px}
label{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);margin:18px 0 6px}
input[type="text"],input[type="number"],input[type="password"],select,textarea{
  width:100%;padding:8px 10px;font-family:var(--font-mono);font-size:13px;
  border:1px solid var(--line);border-radius:4px;background:var(--paper-warm);color:var(--ink);
}
button{margin-top:24px;padding:10px 16px;border:1px solid var(--ink);border-radius:4px;font-family:var(--font-mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase}
button:hover{background:var(--ink);color:var(--paper)}
.status{margin-top:14px;font-size:12px;color:var(--rec-red)}
.status.ok{color:var(--teal)}
#upload-form{display:none}
```

- [ ] **Step 2: Write `admin/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RMLUR — Admin</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../style.css">
<link rel="stylesheet" href="admin.css">
</head>
<body>

<div id="login-form">
  <h1>Admin Login</h1>
  <label for="password">Password</label>
  <input type="password" id="password" autocomplete="current-password">
  <button id="login-btn">Log In</button>
  <div class="status" id="login-status"></div>
</div>

<form id="upload-form">
  <h1>Add Product</h1>

  <label for="id">ID (slug, e.g. midnight-pager-2)</label>
  <input type="text" id="id" required>

  <label for="type">Type</label>
  <select id="type">
    <option value="beat">Beat</option>
    <option value="kit">Kit</option>
    <option value="loopkit">Loop Kit</option>
    <option value="sample">Sample Pack</option>
    <option value="project">Project File</option>
  </select>

  <label for="title">Title</label>
  <input type="text" id="title" required>

  <label for="genre">Genre</label>
  <input type="text" id="genre" required>

  <label for="info">Description</label>
  <textarea id="info" rows="4"></textarea>

  <label for="price">Price (USD)</label>
  <input type="number" id="price" step="0.01" min="0">

  <label for="stripeLink">Stripe Payment Link</label>
  <input type="text" id="stripeLink">

  <label for="cover">Cover Art</label>
  <input type="file" id="cover" accept="image/png,image/jpeg,image/webp">

  <label for="preview">Audio Preview (optional)</label>
  <input type="file" id="preview" accept="audio/mpeg,audio/wav">

  <label for="deliverable">Deliverable File (the paid download — zip multi-file products before uploading)</label>
  <input type="file" id="deliverable">

  <button type="submit">Upload</button>
  <div class="status" id="upload-status"></div>
</form>

<script type="module" src="admin.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `admin/admin.js`**

```js
import { upload } from 'https://esm.sh/@vercel/blob@0.27.0/client';

const loginForm = document.getElementById('login-form');
const uploadForm = document.getElementById('upload-form');
const loginStatus = document.getElementById('login-status');
const uploadStatus = document.getElementById('upload-status');

document.getElementById('login-btn').addEventListener('click', async () => {
  const password = document.getElementById('password').value;
  loginStatus.textContent = '';
  loginStatus.classList.remove('ok');

  const res = await fetch('/api/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'include',
  });

  if (res.ok) {
    loginForm.style.display = 'none';
    uploadForm.style.display = 'block';
  } else {
    const data = await res.json().catch(() => ({}));
    loginStatus.textContent = data.error || 'login failed';
  }
});

async function uploadFileIfPresent(inputId) {
  const input = document.getElementById(inputId);
  const file = input.files[0];
  if (!file) return null;
  const blob = await upload(file.name, file, {
    access: 'public',
    handleUploadUrl: '/api/blob-upload-token',
  });
  return blob.url;
}

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  uploadStatus.textContent = 'uploading files…';
  uploadStatus.classList.remove('ok');

  try {
    const [cover, preview, deliverable] = await Promise.all([
      uploadFileIfPresent('cover'),
      uploadFileIfPresent('preview'),
      uploadFileIfPresent('deliverable'),
    ]);

    const price = parseFloat(document.getElementById('price').value);
    const stripeLink = document.getElementById('stripeLink').value;

    const payload = {
      id: document.getElementById('id').value.trim(),
      type: document.getElementById('type').value,
      title: document.getElementById('title').value.trim(),
      genre: document.getElementById('genre').value.trim(),
      info: document.getElementById('info').value.trim(),
      cover, preview, deliverable,
      tiers: Number.isFinite(price) ? [{ id: 'default', label: 'DEFAULT', price, stripeLink }] : [],
    };

    uploadStatus.textContent = 'saving…';

    const res = await fetch('/api/admin-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (res.ok) {
      uploadStatus.textContent = 'Uploaded — live in the shop now.';
      uploadStatus.classList.add('ok');
      uploadForm.reset();
    } else {
      const data = await res.json().catch(() => ({}));
      uploadStatus.textContent = data.error || 'upload failed';
    }
  } catch (err) {
    uploadStatus.textContent = 'Error: ' + err.message;
  }
});
```

- [ ] **Step 4: Deploy and verify end to end in a real browser**

```bash
vercel deploy
```
Open `https://<preview-url>/admin/` in a browser:
1. Enter the wrong password → expect "incorrect password" shown, form stays on login.
2. Enter the correct password → expect the upload form to appear.
3. Fill in `id: test-admin-flow`, `title: Test Admin Flow`, `genre: Test`, pick a small image as cover, leave preview/deliverable empty, submit.
4. Expect "Uploaded — live in the shop now."
5. Visit `https://<preview-url>/shop.html` → expect a new disk labeled "Test Admin Flow" in a "Test" genre compartment.
6. Clean up: `node --env-file=.env.local -e "import('./api/_lib/db.js').then(({sql}) => sql\`DELETE FROM products WHERE id = 'test-admin-flow'\`).then(() => console.log('cleaned up'))"`

- [ ] **Step 5: Commit**

```bash
git add admin/
git commit -m "Add password-gated admin upload page"
```

---

## Task 10: Large-file upload verification and production cutover

**Files:** none (verification + deploy only)

- [ ] **Step 1: Verify a large file upload works end to end**

Using a real file 100MB+ (e.g. a sample project export), repeat Task 9 Step 4's flow but pick that large file as the "Deliverable File." Confirm the browser network tab shows it uploading directly to a `blob.vercel-storage.com` URL (not through `/api/admin-upload`), and that the final `/api/admin-upload` POST body is small (just metadata + URLs). Confirm it appears in `/api/products` afterward, then delete the test row the same way as before.

- [ ] **Step 2: Confirm the shop still renders correctly with zero JS errors**

Open `/shop.html`, open the browser console, click through all 3 genre tabs and a few disks. Expected: no console errors, hover/click/purchase-tier flow all behave exactly as they did before this plan (unchanged, since `floppy-bay.js` and the PDP overlay were never touched).

- [ ] **Step 3: Promote to production**

```bash
vercel deploy --prod
```

- [ ] **Step 4: Final production smoke test**

```bash
curl -s https://rmlur.com/api/products | node -e "process.stdin.resume(); process.stdin.on('data', d => console.log(JSON.parse(d).map(p => p.id)))"
```
Expected: `[ 'midnight-pager', 'deux-sexes-drums-v1', 'getty-tape' ]`

Open `https://rmlur.com/shop.html` in a browser: same 3 products, no console errors. Open `https://rmlur.com/admin/`: login screen appears (don't log in with the production password over an untrusted network — just confirm the page loads and is not indexed/linked anywhere public).

- [ ] **Step 5: Commit** (only if any file changed in this task — typically none will have)

If nothing changed, skip this step; this task is verification-only.

---

## Self-Review Notes

- **Spec coverage:** every component in the spec's "Components" section maps to a task (Task 2 = auth helper + admin-login, Task 3+4 = products table + read endpoint, Task 6 = blob-upload-token, Task 8 = admin-upload, Task 9 = admin UI, Task 5 = shop.js switch, Task 3 = migration). Error handling cases from the spec are covered by Task 4/7/8's explicit status-code branches. Testing steps 1-5 from the spec map onto Tasks 4, 7, 9, and 10.
- **Type consistency:** `verifySession(request)` and `checkPassword(candidate)` (Task 2) are called with the same names and argument shapes in Tasks 6, 7, and 8. `sql` (Task 3) is imported the same way in Tasks 4 and 8. The camelCase product shape produced by Task 4's `toProduct()` matches exactly what Task 9's `admin.js` payload sends (minus DB-only fields like `created_at`).
- **Open item resolved:** the spec left the exact Postgres env var name open — Task 1 Step 4 has the executor confirm it via `vercel env ls` and substitute if it's not literally `DATABASE_URL`.
