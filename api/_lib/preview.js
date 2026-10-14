import { sql } from './db.js';
import { isR2Key, r2DownloadUrl, r2Config } from './r2.js';

// GET /api/products?preview=<product id> -> the beat's preview MP3, streamed from rmlur.com.
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

export async function servePreview(request, id) {
  if (!ID_RE.test(id)) return new Response('bad id', { status: 400 });
  let row;
  try {
    [row] = await sql`SELECT preview_url FROM products WHERE id = ${id}`;
  } catch (err) {
    console.error('[api/products preview] DB error:', err);
    return new Response('internal error', { status: 500 });
  }
  const src = upstreamUrl(row && row.preview_url);
  if (!src) return new Response('no preview', { status: 404 });

  const headers = {};
  const range = request.headers.get('range');
  if (range) headers.Range = range;
  let up;
  try {
    up = await fetch(src, { method: request.method, headers });
  } catch (err) {
    console.error('[api/products preview] upstream fetch failed:', id, err);
    return new Response('preview storage unreachable', { status: 502, headers: { 'X-Preview-Upstream': 'unreachable' } });
  }
  if (!up.ok) {
    console.error('[api/products preview] upstream', up.status, 'for', id);
    return new Response('preview missing upstream', { status: 502, headers: { 'X-Preview-Upstream': String(up.status) } });
  }
  const out = new Headers({ 'Cache-Control': 'public, max-age=300, s-maxage=86400', 'X-Preview-Upstream': String(up.status) });
  for (const h of PASS) { const v = up.headers.get(h); if (v) out.set(h, v); }
  if (!out.has('content-type')) out.set('content-type', 'audio/mpeg');
  if (!out.has('accept-ranges')) out.set('accept-ranges', 'bytes');
  return new Response(request.method === 'HEAD' ? null : up.body, { status: up.status, headers: out });
}
