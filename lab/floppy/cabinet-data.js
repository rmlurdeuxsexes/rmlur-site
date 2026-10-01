// Data layer for the /lab/floppy cabinet (no THREE here — unit-tested in node).

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Same source chain as /store: Neon API -> drop-folder catalog -> products.js
export async function loadProducts(win = globalThis) {
  try {
    const r = await fetch('/api/products');
    if (r.ok) { const list = await r.json(); if (list.length) return list; }
  } catch {}
  let published = [];
  try { const r = await fetch('/data/beats.catalog.json', { cache: 'no-cache' }); if (r.ok) published = await r.json(); } catch {}
  const seen = new Set(published.map(p => p.id));
  return published.concat((win.PRODUCTS || []).filter(p => !seen.has(p.id)));
}

// Returns the drawer config with an `items` array each. Vault-flagged products
// only ever go in the locked drawer; everything else goes to its genre drawer,
// else UNSORTED.
export function assignDrawers(products, config) {
  const drawers = config.drawers.map(d => ({ ...d, items: [] }));
  const vault = drawers.find(d => d.locked);
  const unsorted = drawers.find(d => d.unsorted) || drawers[drawers.length - 1];
  for (const p of products) {
    if (p.vault && vault) { vault.items.push(p); continue; }
    const g = String(p.genre || '').toLowerCase();
    const home = drawers.find(d => !d.locked && d.genres.some(x => x.toLowerCase() === g));
    (home || unsorted).items.push(p);
  }
  return drawers;
}

export async function checkPassword(drawer, attempt) {
  if (!drawer.locked) return true;
  if (!drawer.passwordHash) return false;
  return (await sha256Hex(attempt)) === drawer.passwordHash;
}
