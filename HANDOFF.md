# RMLUR SITE — SESSION HANDOFF
Written 2026-09-28. **Supersedes any earlier HANDOFF.md content — this
replaces it, not appends to it.**

============================================================
WHAT THIS COVERS
============================================================
**rmlur.com** — the live marketing/shop site. Repo: `~/Desktop/rmlur-site`
(Vercel project `rmlur-site`, team `rmlur`, no git remote configured —
deploys straight from the local working directory via the `vercel` CLI).

Not covered: `~/Downloads/GlamPushAPP` (JayRewind Studio, the separate
Electron app) — untouched this session, different repo, different rules.
This session started from a GlamPushAPP working directory but the actual
work — a giant "recover the MPC hero regression + make it interactive"
brief with screenshots and a demo video — was clearly about this repo
(the video showed the original Readymag pad-construction technique, the
brief referenced `mpc-3d.js`/`cassette-bay.js` by name). Confirmed by
inspection before doing any work, same as the last handoff's guidance.

============================================================
IMPORTANT — ONE OF THIS SESSION'S FIXES IS ALREADY LIVE IN PRODUCTION
============================================================
Everything in the **working tree** (the files `git status` shows modified)
is uncommitted and undeployed, same as always — inspect and confirm before
assuming any of it is live.

**The one exception: a direct database write.** Late in this session I
connected straight to the production Neon Postgres DB (using
`DATABASE_URL` from `.env.production.local` and the already-installed
`@neondatabase/serverless` package) and ran an `UPDATE` fixing 3 products'
broken Stripe placeholder links. That change is **live on rmlur.com right
now**, independent of git/Vercel deploy state entirely — there is no
working-tree diff for it because it never touched a file. See "Broken
Stripe links" below for exactly what changed and why it was safe.

============================================================
HONEST STATUS
============================================================
**Hero MPC (mpc-3d.js / led-marquee.js)** — real, verified fixes this
session (whitespace/composition, satellite drive, jog wheel, LCD meters —
see below). Verified live in the browser pane at every step, including
pixel-level checks where screenshots weren't reliable enough. **The user
has not given explicit visual sign-off on the end result** — they said
"keep going" twice (wheel/LCD, then store flow) rather than confirming
the prior round looked right. Treat as strong-but-unconfirmed until they
say so.

**Store flow (shop.js / products.js / production DB)** — also verified
live, including against the actual production site and production
database, not just localhost. This is the more load-bearing of the two:
it touches real money-adjacent flows (buy buttons) and one change is
already live (see above).

**cassette-bay.js / style.css** — carried over from a *prior* session
(round 1/2 of a different work item, cassette-bay material/lighting
pass). **I did not touch these this session and did not re-verify their
status.** The prior handoff said the user had not signed off on them
either. Don't assume anything about their state from this doc — read the
diff yourself if it matters to what you're doing.

============================================================
CURRENT GIT STATE
============================================================
```
 M cassette-bay.js   (NOT this session — carried over, unverified by me)
 M led-marquee.js    (99 lines — this session, see below)
 M mpc-3d.js         (79 lines — this session, see below)
 M products.js       (46 lines — this session, see below)
 M shop.js           (29 lines — this session, see below)
 M style.css         (NOT this session — carried over, unverified by me)
?? CLAUDE.md
?? HANDOFF.md (this file)
?? assets/lcd-loop.backup.mp4   (pre-existing, unrelated, leave alone)
?? assets/wheel-texture.png     (NEW — this session, see below)
```
`HEAD` is still `f238167`. Nothing has been committed. Do not commit
without asking — same rule as always, and this session added real,
verified-but-unconfirmed changes across 4 files plus one new asset.

**Local test server is not running** — it died with the computer
restart mid-session. Restart with `python3 -m http.server 8000` from
`~/Desktop/rmlur-site` before testing anything locally (`.claude/
launch.json` also has this configured as `rmlur-site`, port 8000).

============================================================
THIS SESSION'S WORK
============================================================

### 1. Hero MPC whitespace/composition (mpc-3d.js)
User's brief (with screenshots + a screen-recording of the original
Readymag pad-construction technique) described the homepage MPC as
regressed: massive empty white space, a "detached floating iPod-like
object," a generic-looking jog wheel, and asked for the LCD to react to
pad hits with real meters.

**Root cause, confirmed with real numbers pulled from the live
Three.js scene (not guessed):** `Drive_Body` (the satellite tape/floppy
unit — actually "MidKnight Jason"'s dedicated portfolio-drive feature,
*not* a stray iPod placeholder, which had already been removed in a
still-earlier session) was authored ~0.49 units away from its own
cable's chassis-anchor point. Including it in the camera's fit-box (so
it stayed visible) forced the whole composition to normalize around
that gap, which is what produced both the whitespace *and* the
"detached floating object" look.

**Fix:** added `repositionDrive()` — pulls `Drive_Body` 45% of the way
back toward its own cable's real anchor point (not an arbitrary
direction), then rewrote `applyCableSag()` to anchor the cable's far end
to the drive's *current* (possibly-moved) position instead of the
cable's own stale baked-in geometry, so they stay visually connected
after the move. Verified live: MPC now fills the frame, drive reads as
an attached accessory, raycast hit-target correctly followed the visual
move (hover → "TAPE" tooltip, click → navigates to
`jasons-portfolio.html`), pad clicks still fire real audio requests.

**Known remaining gap:** mobile viewport (375×812) still shows vertical
whitespace above/below the hero — that's the `.hero-frame`'s fixed
1.35:1 aspect ratio (`sizeHeroFrame()` in app.js) leaving gaps on a tall
narrow screen, a *separate*, pre-existing issue this fix didn't touch.

### 2. Jog wheel real-photo texture (mpc-3d.js + new assets/wheel-texture.png)
`MPC_DataWheel` and its 16 `WheelGrip_*` ridge meshes shared one flat,
untextured `MeshStandardMaterial` ("WheelMat", `#4b4b50`, no map) — the
same zero-texture state the pads were in before `pad-texture.png` was
made. The *real* photographed wheel (with actual embossed ring detail
and gloss) already exists in `mpc-hero.jpg`, just sitting unused behind
the flat 3D disc.

Cropped it out (`assets/wheel-texture.png`, 512×512, from the source jpg
region `(390,398)-(604,612)`), flat-fielded to strip the photo's own
vignette/shadow (so the *scene's* lighting does the shading instead of
double-stacking on top of baked-in shadow — same rationale the pad
texture used), brightened, applied via a new `applyWheelTexture()`
mirroring `applyPadTextures()`'s pattern exactly. Wheel face gets the
photo texture (smoother/semi-gloss: roughness 0.42, metalness 0.08);
the 16 grip ridges get a separate darker matte clone (`#232326`,
roughness 0.8) since their UV is a narrow reused strip, not
one-crop-per-grip — reads as a distinct rubberized rim against the
smoother disc face, matching real MPC2000XL hardware.

### 3. LCD pad-reactive meter bank (led-marquee.js)
User wanted MiniMeters-style meters in an 8-bit Gearmulator-MD-ish LCD
aesthetic when pads are hit — the existing LCD already had a single
oscilloscope line (real `AnalyserNode` data, not canned) plus a working
LED dot-matrix scrolling marquee (both already good/kept).

Replaced the single scope line with a 16-bar dot-matrix meter bank
(`drawMeters()`, same amber-LED dot-cell rendering technique the
marquee text already used, so it's visually continuous, not a new UI
language). Buckets real `getByteFrequencyData` bins into 16 bars, each
with a hardware-style peak-hold cap (snaps up instantly, decays over
~550ms, rendered in a brighter warm-white to read as a distinct peak
marker). Idle state falls back to a slow shared breathing pulse with a
per-bar phase offset. Removed `timeData`, now-dead code from the old
scope renderer.

**Verified two ways** (WebGL canvas screenshots don't work for this —
see Gotchas below): no runtime errors across live render frames, and
direct pixel-sampling of the hidden 2D LCD source canvas showing real
non-uniform per-bar levels (`[0,0,0,0,0,0,0,7,0,0,7,5,6,6,0,0]`)
matching a kick drum's actual spectral profile.

### 4. Silent preview-playback failures (shop.js)
Found while testing the store flow: `safePlay()`'s `catch(_) {}` swallowed
every audio playback error completely silently, on *both* paths that can
trigger a preview (the PDP's own play button, and the cassette bay's
hover-preview which bypasses the PDP entirely). A broken/missing preview
file looked identical to "the play button does nothing." This isn't just
about the (currently empty) local `previews/` folder — it would hide any
*future* real failure (typo, bad upload, CDN hiccup) for actual customers
too.

Added one shared `audio.addEventListener('error', ...)` covering both
paths: surfaces `"TITLE — PREVIEW UNAVAILABLE"` in the persistent player
bar, and — when the PDP happens to be open for that same product — flashes
`pdp-status` the same way "ADDING" already does (reverts after 2.2s).
Verified live on both trigger paths with real 404s.

### 5. Three broken Stripe links — found live, fixed live (products.js + production DB)
While testing the buy flow, discovered the *default first product shown
when the store opens*, "MIDNIGHT PAGER" — plus "DEUX SEXES DRUMS V1" and
"GETTY TAPE" — still had literal `https://buy.stripe.com/REPLACE_ME`
placeholder links **in the live production database**, confirmed by
clicking the actual buy flow on rmlur.com. Every other product in the
real ~24-track catalog (added later, via the admin upload flow) correctly
uses a `mailto:jayrewindbeatz@gmail.com?subject=Buy%20%22TITLE%22%20
%E2%80%94%20TIER` pattern instead.

User confirmed: fix these 3 to match the mailto pattern. Did a dry-run
preview first, then connected directly to the production Neon DB and ran
the `UPDATE`, preserving every tier's `id`/`label`/`price` and only
swapping `stripeLink`. **Verified live on rmlur.com afterward** — the
buy button on MIDNIGHT PAGER now correctly opens a mail draft. Also
updated the *local* fallback catalog (`products.js`) to match (same
mailto values), plus its header comment, which was still describing a
Stripe-Payment-Link-only workflow that isn't what the real catalog
actually uses. No temp scripts left behind (written/run/deleted from
inside the repo root, not committed).

**Separate, bigger, still-open finding — not fixed, needs a decision:**
none of the 24 real products actually auto-deliver anything. There's a
`deliverableUrl` field already populated in the DB (via the admin upload
flow) for every real product, but it is **referenced nowhere in the
frontend code** (`grep -rn deliverableUrl` across the repo returns
nothing). So the mailto flow — even when "working" — just opens an email
draft; the actual file handoff is 100% manual on the user's end. The
shop's own footer says "files delivered instantly after checkout," which
isn't true of the current system for any product. This is a business
decision (wire up real auto-delivery vs. fix the copy vs. leave it), not
something I should silently pick a direction on — flagged to the user,
not yet decided.

============================================================
GOTCHAS FROM THIS SESSION (new — add to the running list)
============================================================
- **Browser-pane script caching is still aggressive** — same issue the
  prior handoff described, hit repeatedly this session. If you edit
  `mpc-3d.js`/`led-marquee.js`/`app.js`/`shop.js` and a reload doesn't
  seem to reflect the change, don't trust it — bump a `?cb=N` query on
  that specific `<script src>` tag in the HTML, reload, and **always
  revert the query string before finishing** (`git diff <html file>`
  should be empty when done).
- **`canvas.toDataURL()` on the WebGL canvas (`#mpc3dCanvas`) returns
  blank/white** — Three.js's `WebGLRenderer` doesn't set
  `preserveDrawingBuffer`, so the drawing buffer is cleared by the time
  a separate script call reads it back. For pixel-level verification of
  anything WebGL-rendered, this doesn't work. The LCD specifically is
  easier: its *source* is a plain 2D canvas (`#lcdSourceCanvas`, hidden,
  used only as a texture), and 2D canvases don't have this problem —
  `document.getElementById('lcdSourceCanvas').toDataURL(...)` or direct
  `getImageData()` pixel sampling both work fine.
- **`mpc-3d.js`'s click handler uses stale hover state.** `onClick()`
  fires based on `hoveredPart`, which is only updated by a real
  `pointermove` event. The `computer` tool's `left_click` action does
  *not* reliably fire `pointermove` at the new coordinates first — a
  click right after a `hover()` elsewhere, or right after another click,
  can fire on the *previous* hover target, not what's visually at that
  screen position now. Always `hover()` at the exact target coordinates
  immediately before `left_click`-ing it when testing MPC interactions,
  and re-verify with a screenshot showing the correct tooltip (e.g.
  "PAD 1") before trusting the click.
- **Large base64 image payloads through `javascript_tool` are not worth
  it.** Round-tripping a full canvas screenshot as a data URL (tens of
  KB of base64) is failure-prone to hand-relay and burns a lot of
  tokens. Cheaper, more reliable verification: check for new console
  errors across live render frames, sample specific pixels with
  `getImageData` and report compact numbers, or check `audio.error` /
  network requests directly instead of screenshotting.
- **`assignRandomBeats()` reassigns pad audio every page load** — the 8
  "beat" pads get a random shuffle of `window.BEAT_POOL` on each load,
  so pad→sound mapping isn't stable across reloads. Not a bug, just
  don't be surprised if "PAD 1" plays a different sample than last time
  you tested.

============================================================
GROUND RULES ALREADY ESTABLISHED (don't re-litigate)
============================================================
- `design.html` — hands off, per explicit user instruction.
- `pad-3-3` on the homepage MPC — stays empty/unlabeled, per explicit
  user instruction.
- The MPC's hardware chassis (pads, knobs, transport buttons, outer
  casing) is nominally frozen — this session's changes (drive position,
  wheel material, LCD meters) were explicitly requested, not
  freelanced; don't extend further without asking.
- `assets/lcd-loop.backup.mp4` — pre-existing untracked file, unrelated
  to any session's work, leave it alone, don't commit it.
- No automated test framework, deliberately — every change is verified
  live (browser + direct production checks where relevant). Don't
  introduce one unless asked.
- Real catalog data (real beats, real Stripe links, real preview audio)
  is explicitly the user's to provide — don't fabricate placeholder
  data that looks real. The 3 legacy local `products.js` entries still
  have no real preview `.mp3` files (`previews/` is empty except
  `.gitkeep`) — that's still true and still not mine to fake.
- Direct production DB writes are high-stakes — only do it for a
  specific, explicitly-confirmed fix (as this session's 3-link fix was),
  dry-run first, verify live afterward, never as a first resort.

============================================================
LIKELY NEXT STEPS (not started, just visible from here)
============================================================
1. Get the user's actual visual sign-off on the hero MPC changes
   (composition, drive position, wheel texture, LCD meters) — they
   haven't explicitly confirmed it looks right yet, just kept saying
   "keep going" to the next thing.
2. Decide the `deliverableUrl` auto-delivery question (see section 5
   above) — real feature build vs. copy fix vs. leave as manual.
3. Mobile hero-box whitespace (`.hero-frame`'s fixed aspect ratio) —
   flagged, not touched.
4. The 3 legacy local products still need real preview `.mp3` files if
   they're meant to stay in the fallback catalog long-term (or could be
   retired now that the real DB catalog has ~24 tracks covering similar
   ground).
5. `cassette-bay.js`/`style.css` — still the prior session's open item,
   still not re-verified this session. Read the diff before assuming
   anything about it.
6. Whether to commit any of this working-tree diff — ask first, per
   ground rules, and only once the user has actually looked at the
   result themselves.

============================================================
HOW TO USE THIS DOC
============================================================
Paste or attach this file at the start of a new chat along with your next
request. Read HONEST STATUS and the "already live in production" callout
first — most of this session's work is real, verified, uncommitted
working-tree changes, but one specific fix (the 3 Stripe links) already
went live in the database independent of any of that.
