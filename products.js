/* ============================================================
   RMLUR STORE — PRODUCT CATALOG (shop.html only)
   ============================================================
   This is the FALLBACK catalog only — shop.js tries /api/products
   (the real, admin-managed Neon-backed catalog) first and only falls
   back to this file if that fetch fails. Editing this file does not
   touch the live catalog; use /admin for that.

   Each product sells in TIERS (like size options):
     tiers: [ {id, label, price, stripeLink}, ... ]  — pick 3, shown as 1/2/3
     exclusive: {price, stripeLink}                  — optional 4th, full buyout

   "stripeLink" is just whatever URL the BUY button opens — despite the
   name, it doesn't have to be a Stripe Payment Link. The real catalog's
   current products all use a mailto: link (opens a pre-filled email to
   jayrewindbeatz@gmail.com; you send the file back by hand) instead of
   real Stripe checkout — match that pattern for consistency unless/until
   real Stripe Payment Links are wired up for everything.
   ============================================================ */

window.PRODUCTS = [
  {
    id: "midnight-pager",
    type: "beat",
    title: "MIDNIGHT PAGER",
    subtitle: "griselda type beat",
    bpm: 87,
    key: "F#m",
    bars: 32,
    genre: "Trap / Boom Bap",
    cover: "assets/midnight-pager.jpg",
    preview: "previews/midnight-pager.mp3",
    tags: ["dark", "boom bap", "vinyl"],
    info: "Dusty boom-bap loop built around a chopped vinyl sample, hard-panned hats, and a sub that sits low in the mix. Untagged WAV and trackout stems available for mixing/mastering.",
    tiers: [
      { id: "mp3", label: "MP3", price: 24.99, stripeLink: "mailto:jayrewindbeatz@gmail.com?subject=Buy%20%22MIDNIGHT%20PAGER%22%20%E2%80%94%20MP3" },
      { id: "wav", label: "WAV", price: 34.99, stripeLink: "mailto:jayrewindbeatz@gmail.com?subject=Buy%20%22MIDNIGHT%20PAGER%22%20%E2%80%94%20WAV" },
      { id: "stems", label: "STEMS", price: 59.99, stripeLink: "mailto:jayrewindbeatz@gmail.com?subject=Buy%20%22MIDNIGHT%20PAGER%22%20%E2%80%94%20STEMS" }
    ],
    exclusive: { price: 249.99, stripeLink: "mailto:jayrewindbeatz@gmail.com?subject=Buy%20%22MIDNIGHT%20PAGER%22%20%E2%80%94%20EXCLUSIVE" }
  },
  {
    id: "deux-sexes-drums-v1",
    type: "kit",
    title: "DEUX SEXES DRUMS V1",
    subtitle: "mpc2000xl one-shots • 90 sounds",
    bpm: null,
    key: null,
    bars: null,
    genre: "Drum Kit",
    cover: "assets/deux-sexes-drums-v1.jpg",
    preview: "previews/deux-sexes-drums-v1.mp3",
    tags: ["drum kit", "one shots", "12-bit"],
    info: "90 one-shots sampled straight off a customized MPC2000XL at 12-bit — kicks, snares, hats, percs, and a few foley oddballs. Royalty-free, use in unlimited projects.",
    tiers: [
      { id: "mp3", label: "MP3", price: 14.99, stripeLink: "mailto:jayrewindbeatz@gmail.com?subject=Buy%20%22DEUX%20SEXES%20DRUMS%20V1%22%20%E2%80%94%20MP3" },
      { id: "wav", label: "WAV", price: 24.99, stripeLink: "mailto:jayrewindbeatz@gmail.com?subject=Buy%20%22DEUX%20SEXES%20DRUMS%20V1%22%20%E2%80%94%20WAV" },
      { id: "stems", label: "FULL KIT", price: 39.99, stripeLink: "mailto:jayrewindbeatz@gmail.com?subject=Buy%20%22DEUX%20SEXES%20DRUMS%20V1%22%20%E2%80%94%20FULL%20KIT" }
    ],
    exclusive: null
  },
  {
    id: "getty-tape",
    type: "beat",
    title: "GETTY TAPE",
    subtitle: "smooth soul flip",
    bpm: 74,
    key: "Bbmaj",
    bars: 16,
    genre: "Soul / R&B",
    cover: "assets/getty-tape.jpg",
    preview: "previews/getty-tape.mp3",
    tags: ["soul", "sample", "chops"],
    info: "Warm soul flip chopped into a 16-bar loop — mellow keys, tape-saturated drums, room for a vocalist to ride pocket. WAV and stems include the raw chop for re-arranging.",
    tiers: [
      { id: "mp3", label: "MP3", price: 24.99, stripeLink: "mailto:jayrewindbeatz@gmail.com?subject=Buy%20%22GETTY%20TAPE%22%20%E2%80%94%20MP3" },
      { id: "wav", label: "WAV", price: 34.99, stripeLink: "mailto:jayrewindbeatz@gmail.com?subject=Buy%20%22GETTY%20TAPE%22%20%E2%80%94%20WAV" },
      { id: "stems", label: "STEMS", price: 59.99, stripeLink: "mailto:jayrewindbeatz@gmail.com?subject=Buy%20%22GETTY%20TAPE%22%20%E2%80%94%20STEMS" }
    ],
    exclusive: { price: 199.99, stripeLink: "mailto:jayrewindbeatz@gmail.com?subject=Buy%20%22GETTY%20TAPE%22%20%E2%80%94%20EXCLUSIVE" }
  }
];
