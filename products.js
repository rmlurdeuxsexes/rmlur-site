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
  // (empty) the three seed placeholders were removed; real beats come from /api/products and data/beats.catalog.json
];
