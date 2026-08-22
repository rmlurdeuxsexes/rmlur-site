# RMLUR STORE — Setup Guide
Your own site. Your own checkout. No third party taking a cut of the storefront.

**Stack:** static site (free hosting) + Stripe Payment Links (one-time purchases) + Dropbox delivery.
This matches the Master Doc spec: Stripe one-time purchases + Dropbox, Manual Review or Fully Automatic delivery.

---

## 1. Put the site online (10 min, free)

1. Make a GitHub repo (e.g. `rmlur-store`) and push this folder to it.
2. Go to **vercel.com** (or netlify.com) → "Add New Project" → import the repo.
3. No build settings needed — it's plain HTML. Deploy.
4. You now have a live URL like `rmlur-store.vercel.app`.

From now on: **push to GitHub = site updates**. That's your "just upload" workflow.

## 2. Point rmlur.com at the new site (moving off Readymag)

1. In Vercel → Project → Settings → **Domains** → add `rmlur.com` and `www.rmlur.com`.
2. Vercel shows you DNS records (an A record + CNAME).
3. Log into wherever you **registered** rmlur.com (the registrar — GoDaddy, Namecheap, Google Domains, etc. — not Readymag itself unless you bought it through them).
4. Replace the current records pointing to Readymag with the ones Vercel gives you.
5. Wait 5 min – 24 hrs for DNS to flip. Done — Readymag is out of the loop.
   (Keep your Readymag subscription until you confirm the new site is live, then cancel.)

## 3. Selling: Stripe Payment Links (per product)

1. Sign up / log in at **dashboard.stripe.com**.
2. **Product catalog → Add product** — name, price (one-time), upload the cover image.
3. **Payment Links → New** → select the product → create.
4. Copy the `https://buy.stripe.com/...` URL into that product's `stripeLink` in `products.js`.

### Delivery (Dropbox)
Simplest reliable v1 — set it per Payment Link under **After payment**:
- Option A (instant, automatic): "Show custom confirmation page message" → paste the
  Dropbox shared link to the WAV/stems/kit ZIP. Buyer sees it immediately after paying,
  and it's also in their Stripe receipt email.
- Option B (Manual Review mode): confirmation message says "Files emailed within 12 hrs" —
  you get Stripe's payment notification email and reply with the Dropbox link yourself.

Later upgrade: a tiny serverless function (Stripe webhook → email with expiring Dropbox
link) makes delivery fully automatic and un-shareable. Ask Claude when you're ready.

## 4. Adding a new beat or kit (the everyday workflow)

1. Drop cover art → `assets/yourbeat.jpg`
2. Drop **tagged** mp3 preview → `previews/yourbeat.mp3` (never the clean WAV — that lives in Dropbox behind the paywall)
3. Open `products.js`, copy a block, edit title/bpm/key/price/stripeLink.
4. Push to GitHub. Live in ~30 seconds.

## 5. What's in the box

```
index.html      — home: the MPC photo IS the nav (pads/drives/LCD, no shop grid here)
shop.html       — the full catalog: tabs, product grid, product detail overlay, player bar
about.html / blog.html / design.html / jasons-portfolio.html  — simple standalone pages
style.css       — shared design system (LCD green, cream keys, REC-red buy buttons)
hotspots.js     — home page only: WHERE pads/drives/LCD sit on the photo, WHAT each one does
app.js          — home page only: renders pads/drives/LCD, beat playback, LCD waveform
products.js     — shop.html only: YOUR CATALOG. This is the file you edit day-to-day.
shop.js         — shop.html only: filters, PDP overlay, preview player, player bar
waveform.js     — shared Web-Audio analyser+canvas, used by both the LCD and the player bar
assets/         — cover art, hero photo, stickers
assets/beats/   — TODO: drop your recent-beats audio here, then fill in hotspots.js PADS
previews/       — tagged mp3 previews for the shop (add yours)
```

## Notes

- Buy buttons currently say `REPLACE_ME` — they'll work as soon as you paste real Stripe links.
- The site is static, so it also plugs straight into the long-term plan: the V8 app /
  beat-automation pipeline can eventually write `products.js` + drop the preview file
  automatically after a render, so "finish beat → it's on rmlur.com" becomes one step.
- Sales tax: Stripe can auto-collect it (Stripe Tax) if/when you want.
