import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const SEED_PRODUCTS = [
  {
    id: 'midnight-pager', type: 'beat', title: 'MIDNIGHT PAGER', subtitle: 'griselda type beat',
    bpm: 87, key: 'F#m', bars: 32, genre: 'Trap / Boom Bap',
    cover_url: 'assets/midnight-pager.jpg', preview_url: 'previews/midnight-pager.mp3', deliverable_url: null,
    tags: ['dark', 'boom bap', 'vinyl'],
    info: 'Dusty boom-bap loop built around a chopped vinyl sample, hard-panned hats, and a sub that sits low in the mix. Untagged WAV and trackout stems available for mixing/mastering.',
    tiers: [
      { id: 'mp3', label: 'MP3', price: 24.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
      { id: 'wav', label: 'WAV', price: 34.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
      { id: 'stems', label: 'STEMS', price: 59.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
    ],
    exclusive: { price: 249.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
  },
  {
    id: 'deux-sexes-drums-v1', type: 'kit', title: 'DEUX SEXES DRUMS V1', subtitle: 'mpc2000xl one-shots • 90 sounds',
    bpm: null, key: null, bars: null, genre: 'Drum Kit',
    cover_url: 'assets/deux-sexes-drums-v1.jpg', preview_url: 'previews/deux-sexes-drums-v1.mp3', deliverable_url: null,
    tags: ['drum kit', 'one shots', '12-bit'],
    info: '90 one-shots sampled straight off a customized MPC2000XL at 12-bit — kicks, snares, hats, percs, and a few foley oddballs. Royalty-free, use in unlimited projects.',
    tiers: [
      { id: 'mp3', label: 'MP3', price: 14.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
      { id: 'wav', label: 'WAV', price: 24.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
      { id: 'stems', label: 'FULL KIT', price: 39.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
    ],
    exclusive: null,
  },
  {
    id: 'getty-tape', type: 'beat', title: 'GETTY TAPE', subtitle: 'smooth soul flip',
    bpm: 74, key: 'Bbmaj', bars: 16, genre: 'Soul / R&B',
    cover_url: 'assets/getty-tape.jpg', preview_url: 'previews/getty-tape.mp3', deliverable_url: null,
    tags: ['soul', 'sample', 'chops'],
    info: 'Warm soul flip chopped into a 16-bar loop — mellow keys, tape-saturated drums, room for a vocalist to ride pocket. WAV and stems include the raw chop for re-arranging.',
    tiers: [
      { id: 'mp3', label: 'MP3', price: 24.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
      { id: 'wav', label: 'WAV', price: 34.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
      { id: 'stems', label: 'STEMS', price: 59.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
    ],
    exclusive: { price: 199.99, stripeLink: 'https://buy.stripe.com/REPLACE_ME' },
  },
];

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
