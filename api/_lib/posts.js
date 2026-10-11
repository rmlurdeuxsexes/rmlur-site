// Blog rants + gallery art share one table. Pure helpers here so they can be
// unit-tested without a database.
export const KINDS = ['rant', 'art'];
export const CATEGORIES = ['art', 'fashion', 'library', 'music'];
export const MAX_BODY = 5000;
export const MAX_TITLE = 140;

// Returns { ok:true, post } with cleaned fields, or { ok:false, error }.
// Text is stored exactly as typed (trimmed); pages render it with textContent.
export function validatePost(input) {
  const b = input || {};
  const kind = KINDS.includes(b.kind) ? b.kind : 'rant';
  const category = b.category && CATEGORIES.includes(b.category) ? b.category : null;
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, MAX_TITLE) || null : null;
  const body = typeof b.body === 'string' ? b.body.replace(/\r\n/g, '\n').trim() : '';
  let image = null;
  if (b.image != null && b.image !== '') {
    try {
      const u = new URL(b.image);
      if (u.protocol !== 'https:') throw new Error();
      image = u.toString();
    } catch { return { ok: false, error: 'image must be an https URL' }; }
  }
  if (body.length > MAX_BODY) return { ok: false, error: `post is too long (max ${MAX_BODY} characters)` };
  if (kind === 'rant' && !body) return { ok: false, error: 'write something first' };
  if (kind === 'art' && !image) return { ok: false, error: 'art posts need an image' };
  return { ok: true, post: { kind, category, title, body: body || null, image } };
}

export function publicPost(row) {
  return {
    id: row.id, kind: row.kind, category: row.category, title: row.title,
    body: row.body, image: row.image_url,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}
