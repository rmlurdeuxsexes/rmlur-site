import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// No seed products: the original placeholders (MIDNIGHT PAGER, DEUX SEXES DRUMS V1,
// GETTY TAPE) had no audio or files and were removed. Real beats come in via
// /admin, beat-drop-watch or publish-beats.
const SEED_PRODUCTS = [];

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      bpm INTEGER,
      key TEXT,
      bars INTEGER,
      genre TEXT NOT NULL,
      cover_url TEXT,
      preview_url TEXT,
      deliverable_url TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      info TEXT,
      tiers JSONB NOT NULL DEFAULT '[]',
      exclusive JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  for (const p of SEED_PRODUCTS) {
    await sql`
      INSERT INTO products (id, type, title, subtitle, bpm, key, bars, genre, cover_url, preview_url, deliverable_url, tags, info, tiers, exclusive)
      VALUES (${p.id}, ${p.type}, ${p.title}, ${p.subtitle}, ${p.bpm}, ${p.key}, ${p.bars}, ${p.genre}, ${p.cover_url}, ${p.preview_url}, ${p.deliverable_url}, ${p.tags}, ${p.info}, ${JSON.stringify(p.tiers)}, ${p.exclusive ? JSON.stringify(p.exclusive) : null})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  const rows = await sql`SELECT count(*)::int AS count FROM products`;
  console.log(`DB setup complete. products table has ${rows[0].count} row(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
