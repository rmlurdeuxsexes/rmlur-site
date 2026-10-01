// Cloudflare R2 storage (S3-compatible), no SDK — plain SigV4 over fetch.
//   r2:deliverables/<id>/wav/Name.wav  -> private object; buyers get a 4-hour presigned link
// Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
// The bucket stays private. Objects are only reachable through links minted after payment.
import { createHash, createHmac } from 'node:crypto';

const sha256 = d => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
// RFC 3986 encoding, as SigV4 requires
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const encPath = p => p.split('/').map(enc).join('/');

export function r2Config(env = process.env) {
  const { R2_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: accessKey, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket } = env;
  if (!accountId || !accessKey || !secret || !bucket) return null;
  return { accountId, accessKey, secret, bucket, host: `${accountId}.r2.cloudflarestorage.com` };
}

export const isR2Key = v => typeof v === 'string' && /^r2:[^\0]+$/.test(v) && !v.includes('..');

function signingKey(secret, date, region, service) {
  return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), service), 'aws4_request');
}

// Low-level presign (query-string auth). `path` is the raw, unencoded URL path starting with "/".
export function presign({ method = 'GET', host, path, region = 'auto', service = 's3', accessKey, secret, expires = 14400, now = new Date(), extraQuery = {} }) {
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amz.slice(0, 8);
  const scope = `${date}/${region}/${service}/aws4_request`;
  const q = {
    ...extraQuery,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKey}/${scope}`,
    'X-Amz-Date': amz,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const query = Object.keys(q).sort().map(k => `${enc(k)}=${enc(q[k])}`).join('&');
  const canonical = [method, encPath(path), query, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', amz, scope, sha256(canonical)].join('\n');
  const sig = createHmac('sha256', signingKey(secret, date, region, service)).update(toSign).digest('hex');
  return `https://${host}${encPath(path)}?${query}&X-Amz-Signature=${sig}`;
}

// Presigned download link for a stored key; the filename is forced on download.
export function r2DownloadUrl(key, { env = process.env, expires = 14400, now = new Date() } = {}) {
  const c = r2Config(env);
  if (!c) return null;
  const name = key.split('/').pop();
  return presign({
    host: c.host, path: `/${c.bucket}/${key}`, accessKey: c.accessKey, secret: c.secret, expires, now,
    extraQuery: { 'response-content-disposition': `attachment; filename="${name.replace(/["\\]/g, '')}"` },
  });
}

// Upload a Buffer. Returns the "r2:<key>" reference to store in the products row.
export async function r2Put(key, body, { env = process.env, contentType = 'application/octet-stream', fetchImpl = fetch } = {}) {
  const c = r2Config(env);
  if (!c) throw new Error('R2 not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)');
  const url = presign({ method: 'PUT', host: c.host, path: `/${c.bucket}/${key}`, accessKey: c.accessKey, secret: c.secret, expires: 900 });
  const res = await fetchImpl(url, { method: 'PUT', body, headers: { 'Content-Type': contentType } });
  if (!res.ok) throw new Error(`R2 upload failed (${res.status}) for ${key}: ${(await res.text()).slice(0, 200)}`);
  return `r2:${key}`;
}
