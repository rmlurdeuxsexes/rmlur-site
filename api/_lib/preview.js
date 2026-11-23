import { sql } from './db.js';
import { isR2Key, r2DownloadUrl, r2Config } from './r2.js';

// GET /api/products?preview=<product id> -> the beat's preview MP3, streamed from rmlur.com.
// GET /api/products?cover=<product id>   -> its cover image, same way.
// (Lives behind products.js rather than its own api/ file: the Vercel plan caps a deploy at 12 functions.)
// Players used to load the Blob URL directly; serving it same-origin means the
// browser never has to reach (or be allowed to reach) the storage host, and a
// broken upstream shows up here as a real status instead of a silent "Unavailable".
// Range is forwarded so seeking and Safari's byte-range probing work.

const ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
const PASS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];

export function upstreamUrl(value, env = process.env) {
  if (!value) return null;
  if (isR2Key(value)) return r2Config(env) ? r2DownloadUrl(value.slice('r2:'.length), { env, expires: 900 }) : null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch { return null; }
}

// kind 'preview' -> preview_url (audio), 'cover' -> cover_url (image). Both may be an
// r2:<key> (private bucket, signed here) or a plain https URL.
const COLUMN = { preview: 'preview_url', cover: 'cover_url' };

export async function servePreview(request, id, kind = 'preview') {
  if (!ID_RE.test(id)) return new Response('bad id', { status: 400 });
  if (!COLUMN[kind]) return new Response('bad kind', { status: 400 });
  let row;
  try {
    [row] = kind === 'cover'
      ? await sql`SELECT cover_url FROM products WHERE id = ${id}`
      : await sql`SELECT preview_url FROM products WHERE id = ${id}`;
  } catch (err) {
    console.error(`[api/products ${kind}] DB error:`, err);
    return new Response('internal error', { status: 500 });
  }
  const src = upstreamUrl(row && row[COLUMN[kind]]);
  if (!src) return new Response(`no ${kind}`, { status: 404 });

  const headers = {};
  const range = request.headers.get('range');
  if (range) headers.Range = range;
  let up;
  try {
    up = await fetch(src, { method: request.method, headers });
  } catch (err) {
    console.error(`[api/products ${kind}] upstream fetch failed:`, id, err);
    return new Response('preview storage unreachable', { status: 502, headers: { 'X-Preview-Upstream': 'unreachable' } });
  }
  if (!up.ok) {
    console.error(`[api/products ${kind}] upstream`, up.status, 'for', id);
    return new Response(`${kind} missing upstream`, { status: 502, headers: { 'X-Preview-Upstream': String(up.status) } });
  }
  const out = new Headers({ 'Cache-Control': 'public, max-age=300, s-maxage=86400', 'X-Preview-Upstream': String(up.status) });
  for (const h of PASS) { const v = up.headers.get(h); if (v) out.set(h, v); }
  if (!out.has('content-type')) out.set('content-type', kind === 'cover' ? 'image/jpeg' : 'audio/mpeg');
  if (!out.has('accept-ranges')) out.set('accept-ranges', 'bytes');
  return new Response(request.method === 'HEAD' ? null : up.body, { status: up.status, headers: out });
}

// GET /api/products?media=media/posts/<file> -> a blog/gallery image stored in R2.
// Only keys under media/posts/ are served; anything else is a 404.
const MEDIA_RE = /^media\/posts\/[A-Za-z0-9._ +@()-]{1,160}$/;
export async function serveMedia(request, key) {
  if (!MEDIA_RE.test(key || '')) return new Response('not found', { status: 404 });
  const src = upstreamUrl('r2:' + key);
  if (!src) return new Response('storage not configured', { status: 503 });
  let up;
  try { up = await fetch(src, { method: request.method }); }
  catch { return new Response('storage unreachable', { status: 502 }); }
  if (!up.ok) return new Response('missing', { status: up.status === 404 ? 404 : 502 });
  const out = new Headers({ 'Cache-Control': 'public, max-age=86400, s-maxage=604800' });
  for (const h of PASS) { const v = up.headers.get(h); if (v) out.set(h, v); }
  return new Response(request.method === 'HEAD' ? null : up.body, { status: 200, headers: out });
}
