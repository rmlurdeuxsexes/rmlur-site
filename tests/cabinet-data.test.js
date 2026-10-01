import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assignDrawers, checkPassword } from '../lab/floppy/cabinet-data.js';

const config = JSON.parse(fs.readFileSync(new URL('../data/cabinet.config.json', import.meta.url), 'utf8'));

test('beats land in their genre drawer; unknown genres go to UNSORTED; vault only via flag', () => {
  const d = assignDrawers([
    { id: 'a', genre: 'Soul / R&B' }, { id: 'b', genre: 'Trap / Boom Bap' },
    { id: 'c', genre: 'Rock' }, { id: 'd', genre: 'Drum Kit' },
    { id: 'e', genre: 'Soul / R&B', vault: true },
  ], config);
  const ids = id => d.find(x => x.id === id).items.map(p => p.id);
  assert.deepEqual(ids('soul'), ['a']);
  assert.deepEqual(ids('hiphop'), ['b']);
  assert.deepEqual(ids('unsorted'), ['c', 'd']);
  assert.deepEqual(ids('vault'), ['e']);
  assert.equal(d.length, 6);
});

test('vault password: right opens, wrong does not, unlocked drawers always open', async () => {
  const vault = config.drawers.find(d => d.locked);
  assert.equal(await checkPassword(vault, 'rmlur'), true);
  assert.equal(await checkPassword(vault, 'nope'), false);
  assert.equal(await checkPassword(config.drawers[0], ''), true);
});
