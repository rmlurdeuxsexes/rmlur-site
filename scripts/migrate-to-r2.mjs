#!/usr/bin/env node
// Move every store file off Vercel Blob onto the private Cloudflare R2 bucket.
//
// Why: the Hobby Vercel Blob store went over its 1 GB cap and Vercel blocked it
// (every blob URL answers 403 "Your store is blocked"), which killed all beat
// previews and covers and any paid download still stored there. R2 is free up to
// 10 GB with no download fees, and the site already signs R2 links.
//
//   vercel env pull .env.production.local --environment=production
//   node --env-file=.env.production.local scripts/migrate-to-r2.mjs --from "<folder with your beat files>"
//   ...check the plan it prints, then run it again with --apply
//
// Also moves blog/gallery post images. For every product row it looks at the cover, the preview and each license's
// download file. Anything not already on R2 (r2:...) or Dropbox (dropbox:...) is
// re-uploaded to R2 from:
//   1. the current URL, if it still downloads (e.g. once Vercel unblocks the store), else
//   2. a matching file in --from (searched recursively), matched by the beat's id/title
//      using the same filename rules as the publisher (BPM, @handles, "type beat" ignored):
//        WAV/AIFF/FLAC -> wav license + exclusive (when it shared the WAV) + master
//        MP3           -> mp3 license, and the preview
//        *STEMS*.zip   -> stems license (+ exclusive when it shared the stems)
//        JPG/PNG/WEBP  -> cover
//      With no MP3 but ffmpeg installed, a 192 kbps preview is made from the WAV.
// Rows are only written with --apply, and only for files that actually uploaded.
// Every new file is test-downloaded (first byte) before the row is updated.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { neon } from '@neondatabase/serverless';
import { r2Config, r2Put, r2DownloadUrl } from '../api/_lib/r2.js';
import { parseBeatFilename } from './lib/beat-meta.mjs';

const run = promisify(execFile);
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const fromIdx = args.indexOf('--from');
const FROM = fromIdx >= 0 ? args[fromIdx + 1] : null;

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL missing. Run: vercel env pull .env.production.local --environment=production'); process.exit(1); }
if (!r2Config()) { console.error('R2_* env vars missing (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).'); process.exit(1); }
const sql = neon(process.env.DATABASE_URL);

const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const onR2 = v => typeof v === 'string' && (v.startsWith('r2:') || v.startsWith('dropbox:'));
const KIND_OF_EXT = { '.wav': 'wav', '.aif': 'wav', '.aiff': 'wav', '.flac': 'wav', '.mp3': 'mp3', '.zip': 'stems', '.jpg': 'cover', '.jpeg': 'cover', '.png': 'cover', '.webp': 'cover' };
const TYPE = { wav: 'audio/wav', mp3: 'audio/mpeg', stems: 'application/zip', cover: 'image/jpeg', preview: 'audio/mpeg' };

// ---------- local files ----------
async function walk(dir, out = []) {
  for (const e of await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (KIND_OF_EXT[path.extname(e.name).toLowerCase()]) out.push(p);
  }
  return out;
}
function localFor(row, files) {
  const keys = new Set([row.id, slug(row.title)]);
  const found = {};
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    let kind = KIND_OF_EXT[ext];
    const base = path.basename(f);
    const s = parseBeatFilename(base.replace(/\.(zip|jpe?g|png|webp)$/i, '.wav')).slug.replace(/-?stems$/, '');
    if (!keys.has(s)) continue;
    if (kind === 'stems' && !/stem/i.test(base)) continue;
    if (!found[kind] || fs.statSync(f).size > fs.statSync(found[kind]).size) found[kind] = f;   // prefer the biggest (full quality)
  }
  return found;
}

// ---------- remote ----------
async function tryDownload(url) {
  if (!/^https:\/\//.test(url || '')) return null;
  try { const r = await fetch(url); if (!r.ok) return null; return Buffer.from(await r.arrayBuffer()); } catch { return null; }
}
async function reachable(ref) {
  const url = r2DownloadUrl(ref.slice(3), { expires: 300 });
  try { const r = await fetch(url, { headers: { Range: 'bytes=0-0' } }); return r.status === 200 || r.status === 206; } catch { return false; }
}
async function makePreview(wavPath) {
  try { await run('ffmpeg', ['-version']); } catch { return null; }
  const out = path.join(os.tmpdir(), `preview-${Date.now()}.mp3`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-vn', '-codec:a', 'libmp3lame', '-b:a', '192k', out]);
  return out;
}

// ---------- plan + apply ----------
const files = FROM ? await walk(path.resolve(FROM)) : [];
if (FROM) console.log(`Scanned ${files.length} audio/image/zip files under ${FROM}\n`);
const rows = await sql`SELECT * FROM products ORDER BY id`;
const report = [];

for (const row of rows) {
  const tiers = Array.isArray(row.tiers) ? row.tiers.map(t => ({ ...t })) : [];
  const exclusive = row.exclusive ? { ...row.exclusive } : null;
  const local = localFor(row, files);
  const plan = [];   // {what, from, kind, apply(ref)}
  const need = (what, current, kind, set) => { if (current && !onR2(current)) plan.push({ what, current, kind, set }); else if (!current && kind === 'preview') plan.push({ what, current: null, kind, set }); };

  need('cover', row.cover_url, 'cover', ref => { row.cover_url = ref; });
  need('preview', row.preview_url, 'preview', ref => { row.preview_url = ref; });
  need('master', row.deliverable_url, 'wav', ref => { row.deliverable_url = ref; });
  for (const t of tiers) need(`${t.id} license`, t.deliverableUrl, t.id === 'stems' ? 'stems' : t.id === 'mp3' ? 'mp3' : 'wav', ref => { t.deliverableUrl = ref; });
  if (exclusive) need('exclusive', exclusive.deliverableUrl, /stem/i.test(exclusive.deliverableUrl || '') ? 'stems' : 'wav', ref => { exclusive.deliverableUrl = ref; });

  const line = { id: row.id, moved: [], missing: [] };
  const done = new Map();   // same old URL -> same new ref (exclusive often shares the WAV)
  for (const p of plan) {
    if (p.current && done.has(p.current)) { p.set(done.get(p.current)); line.moved.push(`${p.what} (reused)`); continue; }
    let buf = p.current ? await tryDownload(p.current) : null, src = buf ? 'old URL' : null, name = p.current ? decodeURIComponent(new URL(p.current, 'https://x').pathname.split('/').pop()) : null;
    let file = p.kind === 'preview' ? (local.mp3 || null) : local[p.kind];
    if (!buf && file) { src = path.relative(FROM, file); name = path.basename(file); }
    let tmp = null;
    if (!buf && !file && p.kind === 'preview' && local.wav) { src = `made from ${path.basename(local.wav)}`; name = `${row.id}-preview.mp3`; if (APPLY) { tmp = await makePreview(local.wav); file = tmp; } else file = 'pending'; }
    if (!buf && !file) { line.missing.push(p.what); continue; }
    const folder = p.kind === 'cover' || p.kind === 'preview' ? 'media' : 'deliverables';
    const key = `${folder}/${row.id}/${p.kind}/${(name || p.kind).replace(/[^A-Za-z0-9._ +@()-]/g, '_')}`;
    if (!APPLY) { line.moved.push(`${p.what} <- ${src}`); continue; }
    const body = buf || await fsp.readFile(file);
    const ext = path.extname(name || '').toLowerCase();
    const contentType = p.kind === 'cover' ? ({ '.png': 'image/png', '.webp': 'image/webp' }[ext] || 'image/jpeg') : TYPE[p.kind];
    const ref = await r2Put(key, body, { contentType });
    if (tmp) await fsp.rm(tmp, { force: true });
    if (!(await reachable(ref))) { line.missing.push(`${p.what} (uploaded but not downloadable!)`); continue; }
    if (p.current) done.set(p.current, ref);
    p.set(ref); line.moved.push(`${p.what} <- ${src}`);
  }
  if (APPLY && line.moved.length) {
    await sql`UPDATE products SET cover_url = ${row.cover_url}, preview_url = ${row.preview_url}, deliverable_url = ${row.deliverable_url},
      tiers = ${JSON.stringify(tiers)}, exclusive = ${exclusive ? JSON.stringify(exclusive) : null} WHERE id = ${row.id}`;
  }
  report.push(line);
}

// blog / gallery post images (posts table, if it exists)
let posts = [];
try { posts = await sql`SELECT id, image_url FROM posts WHERE image_url IS NOT NULL AND image_url NOT LIKE 'r2:%'`; } catch {}
for (const p of posts) {
  const line = { id: `post #${p.id}`, moved: [], missing: [] };
  const name = decodeURIComponent(new URL(p.image_url, 'https://x').pathname.split('/').pop()).replace(/[^A-Za-z0-9._ +@()-]/g, '_');
  const local = files.find(f => path.basename(f).replace(/[^A-Za-z0-9._ +@()-]/g, '_') === name.replace(/-[A-Za-z0-9]{20,}(\.\w+)$/, '$1'));
  const buf = await tryDownload(p.image_url);
  if (!buf && !local) { line.missing.push('image'); report.push(line); continue; }
  if (!APPLY) { line.moved.push(`image <- ${buf ? 'old URL' : path.relative(FROM, local)}`); report.push(line); continue; }
  const ext = path.extname(name).toLowerCase();
  const ref = await r2Put(`media/posts/${Date.now().toString(36)}-${name}`, buf || await fsp.readFile(local),
    { contentType: { '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }[ext] || 'image/jpeg' });
  if (!(await reachable(ref))) { line.missing.push('image (uploaded but not downloadable!)'); report.push(line); continue; }
  await sql`UPDATE posts SET image_url = ${ref} WHERE id = ${p.id}`;
  line.moved.push(`image <- ${buf ? 'old URL' : path.relative(FROM, local)}`); report.push(line);
}

console.log(APPLY ? 'MOVED TO R2:' : 'PLAN (nothing changed yet, re-run with --apply):');
for (const l of report) {
  if (!l.moved.length && !l.missing.length) { console.log(`  ✓ ${l.id}: already on R2`); continue; }
  console.log(`  ${l.missing.length ? '!' : '✓'} ${l.id}`);
  for (const m of l.moved) console.log(`      + ${m}`);
  for (const m of l.missing) console.log(`      - MISSING ${m}: no working URL and no matching local file`);
}
const missing = report.filter(l => l.missing.length).length;
console.log(`\n${report.length} products, ${missing} still missing something.${missing ? ' Point --from at the folder that has those beats and run again.' : ''}`);
