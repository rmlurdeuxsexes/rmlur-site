/* ============================================================
   RMLUR STORE — PRODUCT CATALOG (shop.html only)
   ============================================================
   To add a new beat or kit:
   1. Drop cover art into  assets/   (jpg or png)
   2. Drop mp3 preview into  previews/      (tagged preview!)
   3. Copy one of the blocks below, edit it, done.
   4. Push to GitHub → site updates automatically.

   This catalog no longer maps products onto the home-page MPC photo —
   that's hotspots.js now (pads/drives are independent of what's for sale).

   Each product now sells in TIERS (like size options):
     tiers: [ {id, label, price, stripeLink}, ... ]  — pick 3, shown as 1/2/3
     exclusive: {price, stripeLink}                  — optional 4th, full buyout

   "stripeLink" = your Stripe Payment Link for that tier.
   Create at: dashboard.stripe.com → Payment Links → New
   (one-time payment, attach Dropbox delivery link in the
   confirmation email / receipt — see README-SETUP.md)
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
      { id: "mp3", label: "MP3", price: 24.99, stripeLink: "https://buy.stripe.com/REPLACE_ME" },
      { id: "wav", label: "WAV", price: 34.99, stripeLink: "https://buy.stripe.com/REPLACE_ME" },
      { id: "stems", label: "STEMS", price: 59.99, stripeLink: "https://buy.stripe.com/REPLACE_ME" }
    ],
    exclusive: { price: 249.99, stripeLink: "https://buy.stripe.com/REPLACE_ME" }
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
      { id: "mp3", label: "MP3", price: 14.99, stripeLink: "https://buy.stripe.com/REPLACE_ME" },
      { id: "wav", label: "WAV", price: 24.99, stripeLink: "https://buy.stripe.com/REPLACE_ME" },
      { id: "stems", label: "FULL KIT", price: 39.99, stripeLink: "https://buy.stripe.com/REPLACE_ME" }
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
      { id: "mp3", label: "MP3", price: 24.99, stripeLink: "https://buy.stripe.com/REPLACE_ME" },
      { id: "wav", label: "WAV", price: 34.99, stripeLink: "https://buy.stripe.com/REPLACE_ME" },
      { id: "stems", label: "STEMS", price: 59.99, stripeLink: "https://buy.stripe.com/REPLACE_ME" }
    ],
    exclusive: { price: 199.99, stripeLink: "https://buy.stripe.com/REPLACE_ME" }
  }
];
