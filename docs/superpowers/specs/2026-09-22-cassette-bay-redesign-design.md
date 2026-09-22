# Cassette Bay Redesign

2026-09-22

## Context

The shop's 3D case browser (`floppy-bay.js`) is a hand-coded Three.js scene:
a vertical stack of genre-colored bins under a smoked acrylic flip lid,
rendering `window.PRODUCTS` as items you hover/click to open the existing
PDP overlay (`shop.js`'s `openPDP`). It already went through one redesign
pass this repo hasn't committed yet (see "Baseline" below) aimed at making
it "a 1:1 recreation of a real vintage floppy-disk organizer" — that pass
is what's currently deployed to rmlur.com.

A Tripo3D-generated reference render (a colorful cassette organizer — 4+
visible genre bins holding upright cassette tapes, glossy shell, smoked
lid, black pedestal) was produced as a target look. Compared side by side
with the live site, the gap is bigger than color/lighting: the live scene
models floppy disks (flat, fanned) where the reference shows cassette
tapes (boxy, standing, spined). Camera framing also lets the lid dominate
the frame instead of showing the bins.

This spec covers bringing the live scene's *visual construction* in line
with the reference, without touching anything else in the shop (catalog,
checkout, audio preview, PDP).

## Baseline (current uncommitted state)

`floppy-bay.js`, `shop.js`, and `shop.html` all have staged-but-uncommitted
changes from a prior session already applied in the working tree. This
spec's diff builds on top of that baseline, not on the last commit
(`a643c79`). Those pre-existing changes are out of scope here and should
stay in their own commit when this work is committed.

## Goals

- Case geometry reads as a compact desktop cassette organizer, matching
  the reference's proportions and camera framing.
- Items inside the bins read as cassette tapes (boxy, standing, spined),
  not floppy disks.
- Materials/lighting produce visibly saturated, glossy bins and a
  convincing smoked-lid highlight, matching the reference's finish.
- Hover/click interaction feels like pulling a physical item toward you,
  not a flat UI hover state.

## Non-goals

- No changes to `window.PRODUCTS` / genre taxonomy (stays dynamic,
  first-seen-order bin assignment — confirmed, not the reference's fixed
  ROCK/R&B/TRAP/EDM/REGGAE mapping).
- No changes to checkout, Stripe links, audio preview, or the PDP overlay
  — `onSelect(product) → openPDP(product)` stays the only integration
  point with `shop.js`.
- No Blender/GLB pipeline, no React/React Three Fiber, no build step.
  Blender is not currently running in this environment, the site has no
  bundler today (confirmed via `package.json`), and the target visuals
  are achievable with the same procedural-geometry technique the module
  already uses.

## File changes

`floppy-bay.js` → renamed `cassette-bay.js` (the physical object it now
models is a cassette organizer, not a floppy case — keeping the old name
would mislead future readers). `window.floppyBay` global → `window.cassetteBay`.
`shop.html`'s script tag and `shop.js`'s two references
(`window.floppyBay.init(...)`) update to match. Everything else in the
public API is unchanged: `init(products, {onSelect, arrived})`,
`.setFilter(patch)`, `.genreInfo(genre)`.

## Design

### Case geometry & proportions

Reuse the existing bin shape helpers (`roundedRectShape`, `frontLipShape`)
— their notched-front-lip construction already matches the reference's
molded-tray look. What changes is the overall envelope: derive `caseW`,
`caseDepth`, and bin spacing from the reference's actual width : height :
depth ratios instead of the current values, which produce a tall/narrow
silhouette. Add a black pedestal base (a simple beveled box under the
case shell) — present in the reference, absent today.

### Camera

Current orbit (`theta: 0.24, phi: 0.95, radius: 6.5`) plus the lid's
reclined-open angle combine to fill most of the frame with the lid,
hiding the bins. Lower `phi` toward a true elevated three-quarter front
angle (closer to "standing in front of a record bin, glancing down" than
"looking down into a box") and re-run `refitRadius()`'s framing math
against the new case envelope. Re-tune `LID_OPEN` so the open lid
recedes up and back out of the main sightline instead of standing nearly
vertical in front of the bins.

### Cassette sleeves (replaces floppy disks)

Current items are flat plane "disks" fanned out of a slot. New sleeve
geometry: a thin box (case body, with real depth — not a plane) plus a
printed face plane (cover art / genre label texture, reusing the existing
canvas-texture approach) mounted on the box's front face. Sleeves stand
upright in their bin, positioned along the bin's depth axis so nearer
sleeves partially occlude the ones behind them (reference shows several
tapes per bin, not one).

### Materials & lighting

Keep `acrylicMat()`'s transmission-avoidance approach (verbatim comment:
transmission renders solid-black at this scale, transparent+opacity
reads correctly) but re-tune opacity/roughness for a more visible glossy
highlight. Increase bin plastic saturation and add a touch more
specularity (`solidMat`'s roughness param). Darken/richen the case shell
material. Re-balance the existing key/fill/rim directional lights only as
needed to make the new geometry and materials read clearly — no new
light rig.

### Interaction

Hover (`hoverIndex`) and click (`onSelect`) already exist and stay wired
exactly as-is into `shop.js`'s `openPDP`. Two refinements, both purely
presentational:
- Hover nudge gets spring-style easing instead of linear, and moves
  along the sleeve's actual forward axis (matches "pulled toward you").
- Click adds a slightly farther forward pop + slight rotate-toward-camera
  before `onSelect` fires, so picking a tape feels like pulling it out
  rather than an instant flat-UI select.

Lid-open reveal on load (`lidAnim`) is kept as-is, re-timed to match the
new lid geometry/angle.

## Rollout checkpoints

1. **Geometry + camera silhouette only.** No interaction changes yet.
   Screenshot the result and compare side-by-side against the Tripo
   reference until proportions/framing read right.
2. **Materials + lighting pass** on top of the locked geometry.
3. **Sleeve interaction** (hover/click/pull) wired back into the existing
   `onSelect` → `openPDP` handoff.
4. **Live verification** in the browser against the real 3-product
   catalog (`window.PRODUCTS`), plus a responsive/mobile pass.

## Testing

No test framework in this repo (static site). Verification is visual:
browser screenshots at each checkpoint compared against the reference
image, plus a manual click-through of hover → click → PDP-opens → buy
button still links to the right Stripe URL, confirming the existing
purchase flow survived untouched.
