import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'rmlur_admin';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function sign(value) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function checkPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false; // Fail closed: reject all passwords if env var is missing/empty
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
  try {
    const [payload, sig] = decodeURIComponent(match[1]).split('.');
    if (!payload || !sig) return false;
    const expectedSig = sign(payload);
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return false;
    const expires = parseInt(payload, 10);
    return Number.isFinite(expires) && Date.now() < expires;
  } catch {
    return false; // Malformed cookie encoding
  }
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

  // Edge case 1: checkPassword fails closed when ADMIN_PASSWORD is unset/empty
  delete process.env.ADMIN_PASSWORD;
  console.assert(checkPassword('') === false, 'FAIL: empty password should fail when env var is missing');
  console.assert(checkPassword('anything') === false, 'FAIL: any password should fail when env var is missing');
  process.env.ADMIN_PASSWORD = '';
  console.assert(checkPassword('') === false, 'FAIL: empty password should fail when env var is empty string');
  process.env.ADMIN_PASSWORD = 'hunter2'; // Restore for remaining tests

  // Edge case 2: verifySession handles malformed cookie encoding gracefully (no throw)
  const malformedRequest = { headers: { get: () => 'rmlur_admin=%zz' } };
  console.assert(verifySession(malformedRequest) === false, 'FAIL: malformed cookie should return false, not throw');

  console.log('api/_lib/auth.js self-check passed');
}

if (import.meta.url === `file://${process.argv[1]}`) demo();
