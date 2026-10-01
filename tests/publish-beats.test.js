import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildEntry, upsertCatalog, uniqueId } from '../scripts/lib/catalog.mjs';

test('buildEntry: parses filename, detects genre, default prices, collab credit', () => {
  const e = buildEntry({ filename: 'Smooth Soul Flip 74bpm @jayrewind @rambler.wav', previewPath: 'previews/x.mp3', hasStems: true });
  assert.equal(e.id, 'smooth-soul-flip');
  assert.equal(e.title, 'SMOOTH SOUL FLIP');
  assert.equal(e.bpm, 74);
  assert.equal(e.genre, 'Soul / R&B');
  assert.deepEqual(e.tiers.map(t => [t.id, t.price]), [['mp3', 24.99], ['wav', 34.99], ['stems', 59.99]]);
  assert.equal(e.exclusive.price, 249.99);
  assert.match(e.info, /co-produced with rambler/);
});

test('buildEntry: sidecar overrides and playlist mapping', () => {
  const e = buildEntry({ filename: 'Night Drive.wav', previewPath: 'p.mp3', playlists: { 'Jazz / Neo-Soul': 'https://yt/pl' },
    sidecar: { title: 'After Hours', genre: 'Jazz / Neo-Soul', price: 19.99, exclusive: false, youtubeUrl: 'https://youtu.be/x' } });
  assert.equal(e.title, 'AFTER HOURS');
  assert.equal(e.tiers[0].price, 19.99);
  assert.equal(e.exclusive, null);
  assert.equal(e.playlist, 'https://yt/pl');
  assert.equal(e.youtubeUrl, 'https://youtu.be/x');
});

test('upsert replaces by source; uniqueId avoids collisions', () => {
  const a = { id: 'a', source: 'A' };
  assert.equal(upsertCatalog([a], { id: 'a', source: 'A', title: 'new' }).length, 1);
  assert.equal(upsertCatalog([a], { id: 'b', source: 'B' }).length, 2);
  assert.equal(uniqueId('a', 'Other', [a]), 'a-2');
  assert.equal(uniqueId('a', 'A', [a]), 'a');
});

test('CLI end to end: inbox -> previews + catalog, idempotent re-drop', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-'));
  const inbox = path.join(root, 'in');
  fs.mkdirSync(inbox);
  fs.writeFileSync(path.join(inbox, 'Dusty Jazz 90bpm.mp3'), 'fake-mp3');
  fs.writeFileSync(path.join(inbox, 'Dusty Jazz 90bpm.json'), JSON.stringify({ key: 'Dm' }));
  fs.writeFileSync(path.join(inbox, 'Dusty Jazz 90bpm.jpg'), 'fake-jpg');
  const env = { ...process.env, BEATS_INBOX_PATH: inbox, DATABASE_URL: '', BLOB_READ_WRITE_TOKEN: '', R2_ACCOUNT_ID: '', R2_BUCKET: '' };
  // run a scratch copy of the repo layout so the real catalog is untouched
  const scratch = path.join(root, 'repo');
  fs.cpSync(path.resolve('scripts'), path.join(scratch, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(scratch, 'api', '_lib'), { recursive: true });
  fs.copyFileSync(path.resolve('api/_lib/r2.js'), path.join(scratch, 'api', '_lib', 'r2.js'));
  fs.mkdirSync(path.join(scratch, 'data'));
  fs.writeFileSync(path.join(scratch, 'data', 'beats.catalog.json'), '[]');
  execFileSync('node', [path.join(scratch, 'scripts/publish-beats.mjs')], { env });
  const cat = JSON.parse(fs.readFileSync(path.join(scratch, 'data/beats.catalog.json'), 'utf8'));
  assert.equal(cat.length, 1);
  assert.equal(cat[0].id, 'dusty-jazz');
  assert.equal(cat[0].genre, 'Jazz / Neo-Soul');
  assert.equal(cat[0].key, 'Dm');
  assert.ok(fs.existsSync(path.join(scratch, 'previews/dusty-jazz.mp3')));
  assert.ok(fs.existsSync(path.join(scratch, 'assets/covers/dusty-jazz.jpg')));
  assert.ok(fs.existsSync(path.join(scratch, 'beats-published/dusty-jazz/Dusty Jazz 90bpm.mp3')));
  assert.equal(fs.readdirSync(inbox).length, 0);
  // re-drop same file: updates, does not duplicate
  fs.writeFileSync(path.join(inbox, 'Dusty Jazz 90bpm.mp3'), 'fake-mp3-v2');
  execFileSync('node', [path.join(scratch, 'scripts/publish-beats.mjs')], { env });
  assert.equal(JSON.parse(fs.readFileSync(path.join(scratch, 'data/beats.catalog.json'), 'utf8')).length, 1);
});
