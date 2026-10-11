import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../data/placements.json', import.meta.url)));

test('placements.json: every entry is hangable', () => {
  const ids = new Set();
  for (const p of data.placements) {
    assert.ok(p.id && !ids.has(p.id), `unique id: ${p.id}`); ids.add(p.id);
    assert.ok(['plaque', 'billboard'].includes(p.type), `${p.id} type`);
    assert.ok(['back', 'left', 'right', 'front'].includes(p.wall), `${p.id} wall`);
    if (p.type === 'plaque') {
      assert.ok(p.artist, `${p.id} artist`);
      assert.match(p.cert, /^(gold|platinum|diamond|none|multi-platinum:\d+)$/, `${p.id} cert`);
      if (p.format != null) assert.ok(['album', 'single'].includes(p.format), `${p.id} format`);
    }
  }
});
