// Pure catalog helpers for publish-beats (no fs / network, unit-tested).
import { parseBeatFilename, inferGenre } from './beat-meta.mjs';

export const CONTACT_EMAIL = 'jayrewindbeatz@gmail.com';
// Same prices the existing store/pipeline already uses — no new pricing scheme.
export const DEFAULT_PRICES = { mp3: 24.99, wav: 34.99, stems: 59.99, exclusive: 249.99 };

const mailto = (title, label) =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Buy "${title}" — ${label}`)}`;

// playlists: { "Soul / R&B": "https://youtube.com/playlist?list=..." } from data/genre-playlists.json
export function buildEntry({ filename, sidecar = {}, hasStems = false, hasMasterWav = true, existing = null, playlists = {}, previewPath, coverPath = null }) {
  const meta = parseBeatFilename(filename);
  const id = existing?.id || meta.slug;
  const title = (sidecar.title || meta.title).toUpperCase();
  const genre = sidecar.genre || inferGenre(title);
  const prices = { ...DEFAULT_PRICES, ...(sidecar.prices || {}) };
  if (typeof sidecar.price === 'number') prices.mp3 = sidecar.price;

  const tiers = [{ id: 'mp3', label: 'MP3', price: prices.mp3, stripeLink: mailto(title, 'MP3') }];
  if (hasMasterWav) tiers.push({ id: 'wav', label: 'WAV', price: prices.wav, stripeLink: mailto(title, 'WAV') });
  if (hasStems) tiers.push({ id: 'stems', label: 'STEMS', price: prices.stems, stripeLink: mailto(title, 'STEMS') });

  const collab = meta.collaborators.length ? ` (co-produced with ${meta.collaborators.map(h => h.slice(1)).join(', ')})` : '';
  const entry = {
    id, type: 'beat', source: filename.replace(/\.[^.]+$/, ''),
    title,
    subtitle: sidecar.subtitle || `${genre.toLowerCase()} type beat`,
    bpm: sidecar.bpm ?? meta.bpm, key: sidecar.key ?? null, bars: sidecar.bars ?? null,
    genre,
    cover: coverPath, preview: previewPath,
    tags: sidecar.tags || [genre.split(' / ')[0].toLowerCase(), ...(meta.collaborators.length ? ['collab'] : [])],
    info: sidecar.info || `Prod. by JayRewind${collab}. Untagged, mix-ready audio. Every purchase includes a license; see rmlur.com/licenses.html.`,
    tiers,
    exclusive: sidecar.exclusive === false ? null : { price: prices.exclusive, stripeLink: mailto(title, 'EXCLUSIVE') },
  };
  const youtubeUrl = sidecar.youtubeUrl || existing?.youtubeUrl;
  if (youtubeUrl) entry.youtubeUrl = youtubeUrl;
  if (playlists[genre]) entry.playlist = playlists[genre];
  if (sidecar.vault) entry.vault = true; // shows only in the locked VAULT drawer of /lab/floppy
  return entry;
}

// Re-dropping the same source file updates its entry instead of duplicating it.
export function upsertCatalog(catalog, entry) {
  const i = catalog.findIndex(e => e.source === entry.source || e.id === entry.id);
  if (i >= 0) { const next = catalog.slice(); next[i] = entry; return next; }
  return [...catalog, entry];
}

export function uniqueId(baseId, source, catalog) {
  const taken = id => catalog.some(e => e.id === id && e.source !== source);
  if (!taken(baseId)) return baseId;
  let n = 2;
  while (taken(`${baseId}-${n}`)) n++;
  return `${baseId}-${n}`;
}
