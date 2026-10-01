// Resolve a stored deliverable into a URL the buyer can download.
//   dropbox:/Apps/RMLUR/Beats/Name.wav   -> 4-hour temporary link via the Dropbox API
//   https://www.dropbox.com/s/...?dl=0   -> existing shared link, forced to dl=1
//   r2:deliverables/<id>/wav/Name.wav   -> 4-hour presigned Cloudflare R2 link (see r2.js)
//   anything else (e.g. Vercel Blob URL) -> returned as is
// Auth: DROPBOX_REFRESH_TOKEN + DROPBOX_APP_KEY + DROPBOX_APP_SECRET (recommended,
// tokens never expire) or a plain DROPBOX_ACCESS_TOKEN.

import { isR2Key, r2DownloadUrl, r2Config } from './r2.js';

let cached = { token: null, exp: 0 };

export async function dropboxToken({ env = process.env, fetchImpl = fetch, now = Date.now() } = {}) {
  if (env.DROPBOX_REFRESH_TOKEN && env.DROPBOX_APP_KEY && env.DROPBOX_APP_SECRET) {
    if (cached.token && now < cached.exp) return cached.token;
    const res = await fetchImpl('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token', refresh_token: env.DROPBOX_REFRESH_TOKEN,
        client_id: env.DROPBOX_APP_KEY, client_secret: env.DROPBOX_APP_SECRET,
      }).toString(),
    });
    const j = await res.json();
    if (!res.ok || !j.access_token) throw new Error('dropbox token refresh failed');
    cached = { token: j.access_token, exp: now + Math.max(60, (j.expires_in || 14400) - 120) * 1000 };
    return cached.token;
  }
  if (env.DROPBOX_ACCESS_TOKEN) return env.DROPBOX_ACCESS_TOKEN;
  return null;
}

export function normalizeShareLink(url) {
  const u = new URL(url);
  u.searchParams.delete('dl'); u.searchParams.set('dl', '1');
  return u.toString();
}

export function isDropboxPath(v) { return typeof v === 'string' && /^dropbox:\/[^\0]+$/.test(v) && !v.includes('..'); }
export function isDropboxShareLink(v) {
  try { const u = new URL(v); return u.protocol === 'https:' && /(^|\.)dropbox\.com$/.test(u.hostname); } catch { return false; }
}

// returns { url, expiresInSec? } or null when it cannot be resolved (caller falls back to manual fulfilment)
export async function resolveDeliverable(value, opts = {}) {
  if (!value) return null;
  if (isR2Key(value)) {
    const env = opts.env || process.env;
    if (!r2Config(env)) return null;
    return { url: r2DownloadUrl(value.slice('r2:'.length), { env }), expiresInSec: 4 * 3600 };
  }
  if (isDropboxPath(value)) {
    const token = await dropboxToken(opts);
    if (!token) return null;
    const res = await (opts.fetchImpl || fetch)('https://api.dropboxapi.com/2/files/get_temporary_link', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: value.slice('dropbox:'.length) }),
    });
    const j = await res.json();
    if (!res.ok || !j.link) throw new Error(`dropbox: ${j.error_summary || res.status}`);
    return { url: j.link, expiresInSec: 4 * 3600 };
  }
  if (isDropboxShareLink(value)) return { url: normalizeShareLink(value) };
  return { url: value };
}
