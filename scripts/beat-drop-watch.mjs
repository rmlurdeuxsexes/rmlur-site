#!/usr/bin/env node
// Watches ~/Desktop/Rrmlurcombeats4sale — dropping a beat WAV in there is the
// greenlight: it gets parsed, credited, priced, uploaded, and published live
// to rmlur.com's shop (Neon `products` table) with zero manual steps.
//
// Run with the site's production secrets loaded:
//   cd ~/Desktop/rmlur-site && node --env-file=.env.production.local scripts/beat-drop-watch.mjs
//
// Add "--once" to process the current backlog and exit instead of watching.

import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

const HOME = os.homedir();
const WATCH_DIR = process.env.BEAT_WATCH_DIR || path.join(HOME, 'Desktop', 'Rrmlurcombeats4sale');
const LIVE_DIR = path.join(WATCH_DIR, '_LIVE');
const STATE_FILE = path.join(WATCH_DIR, '.beat-watch-state.json');
const LOG_FILE = path.join(WATCH_DIR, '.beat-watch-log.txt');
const CONTACT_EMAIL = 'jayrewindbeatz@gmail.com';
const LICENSE_URL = 'https://rmlur.com/licenses.html';

const AUDIO_EXT = /\.(wav|aiff?|flac)$/i;
const RUN_ONCE = process.argv.includes('--once');
const DRY_RUN = process.argv.includes('--dry-run');

if (!DRY_RUN && (!process.env.DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN)) {
  console.error('Missing DATABASE_URL / BLOB_READ_WRITE_TOKEN — run with --env-file=.env.production.local');
  process.exit(1);
}

const sql = DRY_RUN ? null : neon(process.env.DATABASE_URL);

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { processed: {}, ids: {} }; }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---------- filename parsing (extends src/beatNameParser.js's convention
// in the GlamPushAPP repo to handle multiple @collaborators + stray tokens) ----------
function parseBeatFilename(filename) {
  let name = filename.replace(AUDIO_EXT, '').replace(/\.flp$/i, '');
  name = name.replace(/^untitled\.?\s*/i, '');
  name = name.replace(/_/g, ' ');

  const bpmMatches = [...name.matchAll(/(\d+)\s*bpm/gi)];
  const bpm = bpmMatches.length ? parseInt(bpmMatches[bpmMatches.length - 1][1], 10) : null;

  const handles = [...new Set((name.match(/@[\w.]+/g) || []).map(h => h.toLowerCase()))];
  const collaborators = handles.filter(h => h !== '@jayrewind');

  let title = name
    .replace(/\d+\s*bpm/gi, '')
    .replace(/@[\w.]+/g, '')
    .replace(/type\s*beat/gi, '')
    .replace(/\+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[-.\s]+|[-.\s]+$/g, '');

  if (!title) title = `untitled beat ${Date.now()}`;

  const displayTitle = title.toUpperCase();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `beat-${Date.now()}`;

  return { title: displayTitle, slug, bpm, collaborators };
}

const GENRE_RULES = [
  [/jersey/i, 'Jersey Club / Trap'],
  [/soul|rnb|r&b/i, 'Soul / R&B'],
  [/jazz/i, 'Jazz / Neo-Soul'],
  [/edm|dance|club/i, 'EDM / Dance'],
  [/dancehall|afro/i, 'Dancehall / Afrobeat'],
  [/rock|guitar|indie/i, 'Rock'],
  [/drill/i, 'Drill'],
];
function inferGenre(title) {
  for (const [re, genre] of GENRE_RULES) if (re.test(title)) return genre;
  return 'Trap / Hip-Hop';
}

function creditLine(collaborators) {
  let line = 'Prod. by JayRewind';
  if (collaborators.length) {
    line += ` (co-produced with ${collaborators.map(h => h.replace('@', '')).join(', ')})`;
  }
  return line;
}

async function uniqueId(baseSlug, state) {
  if (DRY_RUN) return baseSlug;
  let id = baseSlug;
  let n = 2;
  const rows = await sql`SELECT id FROM products WHERE id = ${id}`;
  if (rows.length === 0 || state.ids[id] === baseSlug) return id;
  while (true) {
    const candidate = `${baseSlug}-${n}`;
    const exists = await sql`SELECT id FROM products WHERE id = ${candidate}`;
    if (exists.length === 0) return candidate;
    n++;
  }
}

async function waitStable(filePath) {
  let last = -1;
  for (let i = 0; i < 30; i++) {
    const { size } = await fsp.stat(filePath);
    if (size === last && size > 0) return;
    last = size;
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function run(cmd, args) {
  await execFileAsync(cmd, args);
}

let drawtextSupported = null;
async function hasDrawtext() {
  if (drawtextSupported !== null) return drawtextSupported;
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-hide_banner', '-filters']);
    drawtextSupported = /drawtext/.test(stdout);
  } catch {
    drawtextSupported = false;
  }
  return drawtextSupported;
}

function findFont() {
  const candidates = [
    '/System/Library/Fonts/Supplemental/Andale Mono.ttf',
    '/System/Library/Fonts/Supplemental/Courier New.ttf',
  ];
  return candidates.find(f => fs.existsSync(f)) || null;
}

// ponytail: this ffmpeg build has no drawtext (no libfreetype) — falls back to a
// plain branded-color placeholder cover instead of crashing. Add real cover art
// via the admin panel whenever drawtext (or hand-made art) becomes available.
async function makeCoverArt(title, bpm, outPath) {
  const font = findFont();
  let filter = 'null';
  if (font && (await hasDrawtext())) {
    const line1 = title.length > 22 ? title.slice(0, 22) + '…' : title;
    const line2 = bpm ? `${bpm} BPM  ·  PROD. JAYREWIND` : 'PROD. JAYREWIND';
    const esc = s => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\u2019");
    filter =
      `drawtext=fontfile='${font}':text='${esc(line1)}':fontcolor=0x1b1b1b:fontsize=54:x=(w-text_w)/2:y=(h-text_h)/2-30,` +
      `drawtext=fontfile='${font}':text='${esc(line2)}':fontcolor=0x5fa39c:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2+50`;
  }
  await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=0xe7e1cd:s=1000x1000', '-vf', filter, '-frames:v', '1', outPath]);
}

async function makePreviewMp3(srcWav, outPath) {
  await run('ffmpeg', ['-y', '-i', srcWav, '-t', '60', '-codec:a', 'libmp3lame', '-b:a', '192k', outPath]);
}
async function makeLeaseMp3(srcWav, outPath) {
  await run('ffmpeg', ['-y', '-i', srcWav, '-codec:a', 'libmp3lame', '-b:a', '320k', outPath]);
}

async function uploadFile(localPath, blobPath) {
  if (DRY_RUN) return `[DRY-RUN would upload ${(await fsp.stat(localPath)).size} bytes -> ${blobPath}]`;
  const buf = await fsp.readFile(localPath);
  const blob = await put(blobPath, buf, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: true,
  });
  return blob.url;
}

// ---------- Stripe: only runs if the user has connected a Stripe account ----------
async function stripeCreatePaymentLink({ productTitle, coverUrl, priceUsd, tierLabel, deliverableUrl }) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const auth = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' };

  const productBody = new URLSearchParams({ name: `${productTitle} — ${tierLabel}` });
  if (coverUrl) productBody.append('images[]', coverUrl);
  const productRes = await fetch('https://api.stripe.com/v1/products', { method: 'POST', headers: auth, body: productBody });
  const product = await productRes.json();
  if (!productRes.ok) { log(`Stripe product create failed: ${product.error?.message}`); return null; }

  const priceBody = new URLSearchParams({
    product: product.id,
    unit_amount: String(Math.round(priceUsd * 100)),
    currency: 'usd',
  });
  const priceRes = await fetch('https://api.stripe.com/v1/prices', { method: 'POST', headers: auth, body: priceBody });
  const price = await priceRes.json();
  if (!priceRes.ok) { log(`Stripe price create failed: ${price.error?.message}`); return null; }

  const message = `Thanks for buying "${productTitle}" (${tierLabel})! Download: ${deliverableUrl} — License: ${LICENSE_URL} — Credit required: Prod. by JayRewind. Questions: ${CONTACT_EMAIL}`.slice(0, 590);
  const linkBody = new URLSearchParams({
    'line_items[0][price]': price.id,
    'line_items[0][quantity]': '1',
    'after_completion[type]': 'hosted_confirmation',
    'after_completion[hosted_confirmation][custom_message]': message,
  });
  const linkRes = await fetch('https://api.stripe.com/v1/payment_links', { method: 'POST', headers: auth, body: linkBody });
  const link = await linkRes.json();
  if (!linkRes.ok) { log(`Stripe payment link create failed: ${link.error?.message}`); return null; }
  return link.url;
}

function fallbackBuyLink(title, tierLabel) {
  const subject = encodeURIComponent(`Buy "${title}" — ${tierLabel}`);
  return `mailto:${CONTACT_EMAIL}?subject=${subject}`;
}

async function buildTier({ id, label, price, productTitle, coverUrl, deliverableUrl }) {
  const stripeLink = deliverableUrl
    ? await stripeCreatePaymentLink({ productTitle, coverUrl, priceUsd: price, tierLabel: label, deliverableUrl })
    : null;
  return {
    id, label, price,
    stripeLink: stripeLink || fallbackBuyLink(productTitle, label),
    deliverableUrl: deliverableUrl || null,
    needsStripe: !stripeLink,
  };
}

async function upsertProduct(p) {
  if (DRY_RUN) {
    log(`DRY-RUN would upsert product: ${JSON.stringify(p, null, 2)}`);
    return;
  }
  await sql`
    INSERT INTO products (id, type, title, subtitle, bpm, key, bars, genre, cover_url, preview_url, deliverable_url, tags, info, tiers, exclusive)
    VALUES (${p.id}, ${p.type}, ${p.title}, ${p.subtitle}, ${p.bpm}, ${p.key}, ${p.bars}, ${p.genre}, ${p.cover}, ${p.preview}, ${p.deliverable}, ${p.tags}, ${p.info}, ${JSON.stringify(p.tiers)}, ${p.exclusive ? JSON.stringify(p.exclusive) : null})
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, bpm = EXCLUDED.bpm,
      genre = EXCLUDED.genre, cover_url = EXCLUDED.cover_url, preview_url = EXCLUDED.preview_url,
      deliverable_url = EXCLUDED.deliverable_url, tags = EXCLUDED.tags, info = EXCLUDED.info,
      tiers = EXCLUDED.tiers, exclusive = EXCLUDED.exclusive
  `;
}

async function findStemsZip(wavPath) {
  const dir = path.dirname(wavPath);
  const base = path.basename(wavPath).replace(AUDIO_EXT, '');
  const candidates = [
    path.join(dir, `${base} STEMS.zip`),
    path.join(dir, `${base}.stems.zip`),
    path.join(dir, `${base}_STEMS.zip`),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

async function processBeat(filePath, state) {
  const filename = path.basename(filePath);
  if (state.processed[filename]) return;
  if (!fs.existsSync(filePath)) return;

  await waitStable(filePath);
  const meta = parseBeatFilename(filename);
  const id = await uniqueId(meta.slug, state);
  log(`Processing "${filename}" -> id="${id}" title="${meta.title}" bpm=${meta.bpm} collaborators=${meta.collaborators.join(',') || 'none'}`);

  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'beatdrop-'));
  try {
    const coverPath = path.join(workDir, 'cover.jpg');
    const previewPath = path.join(workDir, 'preview.mp3');
    const leasePath = path.join(workDir, 'lease.mp3');

    await makeCoverArt(meta.title, meta.bpm, coverPath);
    await makePreviewMp3(filePath, previewPath);
    await makeLeaseMp3(filePath, leasePath);

    const stemsPath = await findStemsZip(filePath);

    const coverUrl = await uploadFile(coverPath, `covers/${id}.jpg`);
    const previewUrl = await uploadFile(previewPath, `previews/${id}.mp3`);
    const wavUrl = await uploadFile(filePath, `deliverables/${id}/wav/${filename}`);
    const mp3Url = await uploadFile(leasePath, `deliverables/${id}/mp3/${id}.mp3`);
    const stemsUrl = stemsPath ? await uploadFile(stemsPath, `deliverables/${id}/stems/${path.basename(stemsPath)}`) : null;

    const credit = creditLine(meta.collaborators);
    const genre = inferGenre(meta.title);
    const info = `${credit}. Untagged, mix-ready audio — full trackout stems available where noted. Every purchase includes a license; see rmlur.com/licenses.html for terms.`;

    const tiers = [];
    tiers.push(await buildTier({ id: 'mp3', label: 'MP3', price: 24.99, productTitle: meta.title, coverUrl, deliverableUrl: mp3Url }));
    tiers.push(await buildTier({ id: 'wav', label: 'WAV', price: 34.99, productTitle: meta.title, coverUrl, deliverableUrl: wavUrl }));
    if (stemsUrl) {
      tiers.push(await buildTier({ id: 'stems', label: 'STEMS', price: 59.99, productTitle: meta.title, coverUrl, deliverableUrl: stemsUrl }));
    }
    const exclusiveTier = await buildTier({
      id: 'exclusive', label: 'EXCLUSIVE', price: 249.99, productTitle: meta.title, coverUrl,
      deliverableUrl: stemsUrl || wavUrl,
    });

    await upsertProduct({
      id, type: 'beat', title: meta.title, subtitle: `${genre.toLowerCase()} type beat`,
      bpm: meta.bpm, key: null, bars: null, genre,
      cover: coverUrl, preview: previewUrl, deliverable: wavUrl,
      tags: [genre.split(' / ')[0].toLowerCase(), ...(meta.collaborators.length ? ['collab'] : [])],
      info,
      // deliverableUrl is an extra field beyond {id,label,price,stripeLink} — the
      // shop UI ignores it today, but it's how you (or a future webhook) find the
      // actual file to send a buyer until Stripe delivery is wired up.
      tiers: tiers.map(({ id, label, price, stripeLink, deliverableUrl }) => ({ id, label, price, stripeLink, deliverableUrl })),
      exclusive: { price: exclusiveTier.price, stripeLink: exclusiveTier.stripeLink, deliverableUrl: exclusiveTier.deliverableUrl },
    });

    // full tier detail (deliverable URLs, whether Stripe still needs connecting) for the run report
    log(`LIVE: ${id} — tiers: ${tiers.map(t => `${t.label}$${t.price}${t.needsStripe ? '(needs Stripe)' : ''}`).join(', ')}, exclusive $${exclusiveTier.price}${exclusiveTier.needsStripe ? '(needs Stripe)' : ''}${stemsUrl ? '' : ' — stems pending, drop "<name> STEMS.zip" next to the source file or into _LIVE/' + id + '/'}`);

    if (DRY_RUN) {
      log(`DRY-RUN: would move "${filename}" -> _LIVE/${id}/ (source left untouched)`);
      return;
    }

    // move source + any stems into _LIVE as the visual greenlight marker
    const destDir = path.join(LIVE_DIR, id);
    await fsp.mkdir(destDir, { recursive: true });
    await fsp.rename(filePath, path.join(destDir, filename));
    if (stemsPath) await fsp.rename(stemsPath, path.join(destDir, path.basename(stemsPath)));

    state.processed[filename] = { id, at: new Date().toISOString() };
    state.ids[id] = meta.slug;
    saveState(state);
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}

async function findStemsForLiveBeat(id) {
  const dir = path.join(LIVE_DIR, id);
  if (!fs.existsSync(dir)) return null;
  const files = await fsp.readdir(dir);
  const zip = files.find(f => /\.zip$/i.test(f) && !f.startsWith('.uploaded-'));
  return zip ? path.join(dir, zip) : null;
}

// picks up a stems zip dropped into _LIVE/<id>/ after the beat already went live
async function backfillStems(state) {
  if (!fs.existsSync(LIVE_DIR)) return;
  const ids = await fsp.readdir(LIVE_DIR);
  for (const id of ids) {
    const zipPath = await findStemsForLiveBeat(id);
    if (!zipPath) continue;
    log(`Found stems drop for already-live beat "${id}" — uploading and adding STEMS tier`);
    const rows = await sql`SELECT * FROM products WHERE id = ${id}`;
    if (rows.length === 0) continue;
    const row = rows[0];
    const stemsUrl = await uploadFile(zipPath, `deliverables/${id}/stems/${path.basename(zipPath)}`);
    const tiers = Array.isArray(row.tiers) ? row.tiers.filter(t => t.id !== 'stems') : [];
    const stemsTier = await buildTier({ id: 'stems', label: 'STEMS', price: 59.99, productTitle: row.title, coverUrl: row.cover_url, deliverableUrl: stemsUrl });
    tiers.push({ id: stemsTier.id, label: stemsTier.label, price: stemsTier.price, stripeLink: stemsTier.stripeLink, deliverableUrl: stemsTier.deliverableUrl });
    const exclusiveTier = await buildTier({ id: 'exclusive', label: 'EXCLUSIVE', price: row.exclusive?.price || 249.99, productTitle: row.title, coverUrl: row.cover_url, deliverableUrl: stemsUrl });
    await sql`UPDATE products SET tiers = ${JSON.stringify(tiers)}, exclusive = ${JSON.stringify({ price: exclusiveTier.price, stripeLink: exclusiveTier.stripeLink, deliverableUrl: exclusiveTier.deliverableUrl })} WHERE id = ${id}`;
    await fsp.rename(zipPath, path.join(path.dirname(zipPath), `.uploaded-${path.basename(zipPath)}`));
    log(`Updated "${id}" with STEMS tier — now live.`);
  }
}

async function scanBacklog(state) {
  await fsp.mkdir(WATCH_DIR, { recursive: true });
  const entries = await fsp.readdir(WATCH_DIR);
  for (const entry of entries) {
    if (AUDIO_EXT.test(entry)) {
      await processBeat(path.join(WATCH_DIR, entry), state);
    }
  }
  if (!DRY_RUN) await backfillStems(state);
}

async function main() {
  await fsp.mkdir(LIVE_DIR, { recursive: true });
  const state = loadState();

  log(`beat-drop-watch starting — watching ${WATCH_DIR}`);
  await scanBacklog(state);

  if (RUN_ONCE) {
    log('Backlog processed (--once) — exiting.');
    return;
  }

  log('Watching for new drops. Ctrl+C to stop.');
  fs.watch(WATCH_DIR, { persistent: true }, (event, filename) => {
    if (!filename || !AUDIO_EXT.test(filename)) return;
    const fp = path.join(WATCH_DIR, filename);
    setTimeout(() => {
      processBeat(fp, state).catch(err => log(`ERROR processing ${filename}: ${err.stack || err}`));
    }, 2000);
  });

  // periodic sweep so stems dropped into _LIVE/<id>/ get picked up even without a new watch event
  setInterval(() => {
    backfillStems(state).catch(err => log(`ERROR backfilling stems: ${err.stack || err}`));
  }, 5 * 60 * 1000);
}

main().catch(err => {
  log(`FATAL: ${err.stack || err}`);
  process.exit(1);
});
