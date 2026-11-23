import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../data/placements.json', import.meta.url)));

test('placements.json: every entry is hangable', () => {
  const ids = new Set();
  for (const p of data.placements) {
    assert.ok(p.id && !ids.has(p.id), `unique id: ${p.id}`); ids.add(p.id);
    assert.ok(['plaque', 'billboard', 'sign', 'art', 'credits'].includes(p.type), `${p.id} type`);
    assert.ok(['back', 'left', 'right', 'front'].includes(p.wall), `${p.id} wall`);
    if (p.type === 'plaque') {
      assert.ok(p.artist, `${p.id} artist`);
      assert.match(p.cert, /^(gold|platinum|diamond|none|multi-platinum:\d+)$/, `${p.id} cert`);
      if (p.format != null) assert.ok(['album', 'single'].includes(p.format), `${p.id} format`);
      for (const ch of p.charts || []) assert.ok(ch.chart && Number.isInteger(ch.peak), `${p.id} chart`);
    }
    if (p.type === 'sign' || p.type === 'art') assert.ok(p.src, `${p.id} src`);
    if (p.type === 'art') assert.ok(p.title && p.price, `${p.id} title/price`);
  }
});

test('credits.json: every Muso credit has title, artists, date and roles', () => {
  const c = JSON.parse(readFileSync(new URL('../data/credits.json', import.meta.url)));
  assert.equal(c.credits.length, c.count);
  for (const x of c.credits) if (x.url) assert.match(x.url, /^https:\/\//);
  for (const x of c.credits) {
    assert.ok(x.title && x.artists.length && x.roles.length, x.title);
    assert.match(x.date, /^\d{4}-\d{2}-\d{2}$/);
  }
});
