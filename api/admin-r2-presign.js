import { verifySession } from './_lib/auth.js';
import { r2Config, presign } from './_lib/r2.js';

// Admin-only: returns a short-lived presigned PUT so the browser can send a big WAV/zip
// straight to the private R2 bucket (Vercel functions can't carry files that large).
const KINDS = ['wav', 'mp3', 'stems'];
const safeName = n => String(n || 'file').replace(/[^A-Za-z0-9._ +@()-]/g, '_').replace(/\.{2,}/g, '.').replace(/^\.+/, '').slice(0, 120) || 'file';

export default {
  async fetch(request) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    if (!verifySession(request)) return new Response('Unauthorized', { status: 401 });
    const c = r2Config();
    if (!c) return Response.json({ error: 'R2 is not configured (R2_* env vars)' }, { status: 503 });

    let body;
    try { body = await request.json(); } catch { return Response.json({ error: 'invalid JSON body' }, { status: 400 }); }
    const { id, kind, filename } = body || {};
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id || '')) return Response.json({ error: 'invalid id' }, { status: 400 });
    if (!KINDS.includes(kind)) return Response.json({ error: 'invalid kind' }, { status: 400 });

    const key = `deliverables/${id}/${kind}/${safeName(filename)}`;
    const url = presign({ method: 'PUT', host: c.host, path: `/${c.bucket}/${key}`, accessKey: c.accessKey, secret: c.secret, expires: 3600 });
    return Response.json({ url, ref: `r2:${key}` });
  },
};
