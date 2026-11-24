// Point products that have NO cover at a static image in /assets/covers/<id>.jpg.
// These were cut from each beat's YouTube video thumbnail (rmlur.com JayRewind uploads).
// Never overwrites an existing cover. Dry run by default; add --apply to write.
//   node --env-file=.env.production.local scripts/set-covers.mjs [--apply]
import fs from 'node:fs';
import { neon } from '@neondatabase/serverless';

const APPLY = process.argv.includes('--apply');
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL missing (vercel env pull .env.production.local --environment=production)'); process.exit(1); }
const sql = neon(process.env.DATABASE_URL);
const ORIGIN = 'https://rmlur.com';
const have = new Set(fs.readdirSync(new URL('../assets/covers/', import.meta.url)).filter(f => f.endsWith('.jpg')).map(f => f.slice(0, -4)));
const rows = await sql`SELECT id, cover_url FROM products ORDER BY id`;
let n = 0;
for (const r of rows) {
  if (!have.has(r.id)) continue;
  if (r.cover_url) { console.log(`  = ${r.id}: already has a cover, left alone`); continue; }
  const url = `${ORIGIN}/assets/covers/${r.id}.jpg`;
  console.log(`  + ${r.id} -> ${url}`); n++;
  if (APPLY) await sql`UPDATE products SET cover_url = ${url} WHERE id = ${r.id} AND cover_url IS NULL`;
}
console.log(`\n${n} cover(s) ${APPLY ? 'set' : 'to set — run again with --apply'}.`);
