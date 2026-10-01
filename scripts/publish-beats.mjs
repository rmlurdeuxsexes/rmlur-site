#!/usr/bin/env node
// Drop-folder publisher:  npm run publish-beats [-- --dry-run] [-- --sync]
//
//   beats-inbox/              you drop files here (or set BEATS_INBOX_PATH)
//     Name.wav|aiff|flac      master   (or just Name.mp3)
//     Name.mp3                optional preview (else generated with ffmpeg)
//     Name.jpg|png            optional cover (else the store shows the floppy)
//     Name.json               optional overrides: title, genre, bpm, key, price, prices,
//                             subtitle, info, tags, youtubeUrl, exclusive:false, vault:true,
//                             dropbox:{mp3,wav,stems,exclusive} -> "dropbox:/path" or a dropbox share link;
//                             those tiers are delivered from Dropbox instead of Vercel Blob
//     Name STEMS.zip          optional -> adds a STEMS tier
//   beats-published/<id>/     masters are moved here after publishing (gitignored)
//   previews/<id>.mp3         web-safe preview   assets/covers/<id>.jpg   cover
//   data/beats.catalog.json   the catalog the store reads (commit + push it)
//
// --sync (or DATABASE_URL + BLOB_READ_WRITE_TOKEN set): also uploads masters to
// Vercel Blob (or references your Dropbox paths) and upserts the Neon `products`
// row so checkout can deliver them.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildEntry, upsertCatalog, uniqueId } from './lib/catalog.mjs';
import { parseBeatFilename } from './lib/beat-meta.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const INBOX = path.resolve(process.env.BEATS_INBOX_PATH || path.join(ROOT, 'beats-inbox'));
const PUBLISHED = path.join(ROOT, 'beats-published');
const CATALOG = path.join(ROOT, 'data', 'beats.catalog.json');
const PLAYLISTS = path.join(ROOT, 'data', 'genre-playlists.json');
const DRY = process.argv.includes('--dry-run');
const SYNC = process.argv.includes('--sync') || !!(process.env.DATABASE_URL && (process.env.BLOB_READ_WRITE_TOKEN || process.env.DROPBOX_ACCESS_TOKEN || process.env.DROPBOX_REFRESH_TOKEN));

const LOSSLESS = /\.(wav|aiff?|flac)$/i;
const readJson = (p, dflt) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; } };
const log = m => console.log(m);

async function hasFfmpeg() { try { await run('ffmpeg', ['-version']); return true; } catch { return false; } }

function groupInbox(files) {
  const groups = new Map();
  for (const f of files) {
    const m = f.match(/^(.*?)(?: STEMS\.zip|\.(wav|aiff?|flac|mp3|jpe?g|png|json))$/i);
    if (!m) continue;
    const base = m[1];
    const g = groups.get(base) || {};
    if (/ STEMS\.zip$/i.test(f)) g.stems = f;
    else if (LOSSLESS.test(f)) g.master = f;
    else if (/\.mp3$/i.test(f)) g.mp3 = f;
    else if (/\.(jpe?g|png)$/i.test(f)) g.cover = f;
    else if (/\.json$/i.test(f)) g.sidecar = f;
    groups.set(base, g);
  }
  return [...groups].filter(([, g]) => g.master || g.mp3);
}

async function main() {
  await fsp.mkdir(INBOX, { recursive: true });
  const playlists = readJson(PLAYLISTS, {});
  let catalog = readJson(CATALOG, []);
  const groups = groupInbox(await fsp.readdir(INBOX));
  if (!groups.length) { log(`Nothing to publish in ${INBOX}`); return; }
  const ffmpeg = await hasFfmpeg();
  const synced = [];

  for (const [base, g] of groups) {
    const audioName = g.master || g.mp3;
    const tmpId = parseBeatFilename(audioName).slug;
    const existing = catalog.find(e => e.source === base) || null;
    const id = existing?.id || uniqueId(tmpId, base, catalog);
    const sidecar = g.sidecar ? readJson(path.join(INBOX, g.sidecar), {}) : {};

    // preview: supplied mp3, else generated from the master
    const previewRel = `previews/${id}.mp3`;
    if (!g.mp3 && !ffmpeg) { log(`SKIP ${base}: no .mp3 preview supplied and ffmpeg is not installed`); continue; }
    const coverRel = g.cover ? `assets/covers/${id}${path.extname(g.cover).toLowerCase()}` : null;

    const entry = buildEntry({
      filename: audioName, sidecar, hasStems: !!g.stems, hasMasterWav: !!g.master,
      existing: existing || { id }, playlists, previewPath: previewRel, coverPath: coverRel,
    });
    entry.source = base;

    log(`${DRY ? '[dry-run] ' : ''}${entry.id}  "${entry.title}"  ${entry.genre}  $${entry.tiers[0].price}+${g.stems ? '  +stems' : ''}`);
    if (DRY) continue;

    await fsp.mkdir(path.join(ROOT, 'previews'), { recursive: true });
    if (g.mp3) await fsp.copyFile(path.join(INBOX, g.mp3), path.join(ROOT, previewRel));
    else await run('ffmpeg', ['-y', '-i', path.join(INBOX, g.master), '-t', '60', '-codec:a', 'libmp3lame', '-b:a', '128k', path.join(ROOT, previewRel)]);
    if (coverRel) {
      await fsp.mkdir(path.join(ROOT, 'assets', 'covers'), { recursive: true });
      await fsp.copyFile(path.join(INBOX, g.cover), path.join(ROOT, coverRel));
    }

    const dest = path.join(PUBLISHED, id);
    await fsp.mkdir(dest, { recursive: true });
    const moved = {};
    for (const k of ['master', 'mp3', 'stems', 'sidecar', 'cover']) {
      if (g[k]) { moved[k] = path.join(dest, g[k]); await fsp.rename(path.join(INBOX, g[k]), moved[k]); }
    }
    catalog = upsertCatalog(catalog, entry);
    synced.push({ entry, files: moved, dropbox: sidecar.dropbox || {} });
  }

  if (!DRY) {
    await fsp.mkdir(path.dirname(CATALOG), { recursive: true });
    await fsp.writeFile(CATALOG + '.tmp', JSON.stringify(catalog, null, 2) + '\n');
    await fsp.rename(CATALOG + '.tmp', CATALOG);
    log(`Catalog: ${catalog.length} beat(s) -> data/beats.catalog.json`);
    if (SYNC && synced.length) await syncToStore(synced);
    else log('Next: git add data previews assets/covers && git commit && git push  (or run with --sync for DB + Blob)');
  }
}

async function syncToStore(items) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  const up = async (file, blobPath) => {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error(`BLOB_READ_WRITE_TOKEN not set — add a "dropbox" entry to the sidecar or set the token (${blobPath})`);
    const { put } = await import('@vercel/blob');
    return (await put(blobPath, await fsp.readFile(file), { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN, addRandomSuffix: true })).url;
  };

  for (const { entry, files, dropbox } of items) {
    const masterUrl = dropbox.wav || (files.master ? await up(files.master, `deliverables/${entry.id}/wav/${path.basename(files.master)}`) : null);
    const mp3Url = dropbox.mp3 || (files.mp3 ? await up(files.mp3, `deliverables/${entry.id}/mp3/${path.basename(files.mp3)}`) : masterUrl);
    const stemsUrl = dropbox.stems || (files.stems ? await up(files.stems, `deliverables/${entry.id}/stems/${path.basename(files.stems)}`) : null);
    const urlFor = { mp3: mp3Url, wav: masterUrl, stems: stemsUrl };
    const tiers = entry.tiers.map(t => ({ ...t, deliverableUrl: urlFor[t.id] || null }));
    const exclusive = entry.exclusive ? { ...entry.exclusive, deliverableUrl: dropbox.exclusive || stemsUrl || masterUrl } : null;
    await sql`
      INSERT INTO products (id, type, title, subtitle, bpm, key, bars, genre, cover_url, preview_url, deliverable_url, tags, info, tiers, exclusive)
      VALUES (${entry.id}, 'beat', ${entry.title}, ${entry.subtitle}, ${entry.bpm}, ${entry.key}, ${entry.bars}, ${entry.genre},
              ${entry.cover}, ${entry.preview}, ${masterUrl || mp3Url}, ${entry.tags}, ${entry.info},
              ${JSON.stringify(tiers)}, ${exclusive ? JSON.stringify(exclusive) : null})
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, bpm = EXCLUDED.bpm,
        genre = EXCLUDED.genre, cover_url = EXCLUDED.cover_url, preview_url = EXCLUDED.preview_url,
        deliverable_url = EXCLUDED.deliverable_url, tags = EXCLUDED.tags, info = EXCLUDED.info,
        tiers = EXCLUDED.tiers, exclusive = EXCLUDED.exclusive`;
    log(`synced ${entry.id} to store DB`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
