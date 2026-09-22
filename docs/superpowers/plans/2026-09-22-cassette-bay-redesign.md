# Cassette Bay Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the shop's 3D case browser's visual construction in line with the `cassette-bay-reference.webp` render — compact proportions, cassette-shaped sleeves, richer materials — without touching checkout/audio/PDP, which already work.

**Architecture:** Single-file rewrite of the existing procedural Three.js module (renamed `floppy-bay.js` → `cassette-bay.js`). No new modules, no build step, no new dependencies — every change is inside the existing IIFE using patterns (shape helpers, canvas-texture labels, exponential-ease tick loop) the file already has.

**Tech Stack:** Vanilla JS, Three.js (already vendored/loaded via `<script>`, no bundler). Static site served via `python3 -m http.server` locally (`.claude/launch.json`, config name `rmlur-site`), deployed to Vercel with no build step.

**Spec:** [docs/superpowers/specs/2026-09-22-cassette-bay-redesign-design.md](../specs/2026-09-22-cassette-bay-redesign-design.md)

## Global Constraints

- No changes to `window.PRODUCTS` / genre taxonomy — stays dynamic, first-seen-order bin assignment.
- No changes to Stripe links, audio preview, or the PDP overlay in `shop.js`. `onSelect(product) → openPDP(product)` is the only integration point and must keep working after every task.
- No Blender, no React/React Three Fiber, no build step, no new npm dependencies.
- Leave `arrivedFromFloppy`, `Btn_Floppy`, and the `?from=floppy` URL param untouched — those name the MPC2000XL's real hardware floppy-drive button (`app.js`), a different concept from this case's visual theme.
- Leave the `fb-` DOM id/class prefix (`shop.html`, `style.css`, all the `getElementById` calls) untouched — renaming it touches markup/CSS for no functional benefit and isn't worth the diff.
- Leave internal variable/function names (`disks`, `DISK`, `diskMeshes`, `diskIndex`, `buildDisks`, `diskShape`) as-is even though they now render cassette sleeves — same reasoning, keep the diff scoped to what actually needs to change.
- Reference image lives at `docs/superpowers/specs/reference/cassette-bay-reference.webp` — every visual-verification step in this plan compares against it.

---

### Task 1: Rename the module

**Files:**
- Rename: `floppy-bay.js` → `cassette-bay.js`
- Modify: `cassette-bay.js` (header comment + IIFE assignment)
- Modify: `shop.html:141`
- Modify: `shop.js:191, 196, 200, 203, 206, 210`

**Interfaces:**
- Produces: `window.cassetteBay` with the same public API as before — `init(products, {onSelect, arrived})`, `.setFilter(patch)`, `.genreInfo(genre)`. Every later task in this plan edits `cassette-bay.js` and assumes this name.

- [ ] **Step 1: Rename the file with git**

```bash
cd ~/Desktop/rmlur-site && git mv floppy-bay.js cassette-bay.js
```

- [ ] **Step 2: Update the header comment and IIFE assignment**

In `cassette-bay.js`, replace lines 1–16:

```js
/* ============================================================
   RMLUR CASSETTE BAY — 3D shop cassette browser (Three.js)

   A 1:1 recreation of a real vintage cassette organizer: a staircase
   stack of 5 fixed-color bins (maroon/green/blue/red/yellow) inside a
   glossy black shell on a black pedestal, topped with a smoked acrylic
   flip lid held open. window.PRODUCTS renders as cassette sleeves fanned
   inside their genre's own bin — one bin per genre, assigned in
   first-seen catalog order to the case's 5 real slots. shop.js drives it
   (setFilter on tab/pill/search/sort change) and receives selections
   (init's onSelect) to open its own PDP overlay — this module owns
   rendering/layout only, not purchasing.

   Public API: window.cassetteBay.init(products, {onSelect, arrived}) ,
               .setFilter(patch) , .genreInfo(genre)
   ============================================================ */
window.cassetteBay = (function () {
```

- [ ] **Step 3: Update `shop.html`**

`shop.html:141`, change:

```html
<script src="floppy-bay.js"></script>
```

to:

```html
<script src="cassette-bay.js"></script>
```

- [ ] **Step 4: Update `shop.js` references**

Four `window.floppyBay` → `window.cassetteBay` (keep everything else on each line identical):
- `shop.js:196`: `window.floppyBay.genreInfo(p.genre)` → `window.cassetteBay.genreInfo(p.genre)`
- `shop.js:200`: `window.floppyBay.setFilter(filterState);` → `window.cassetteBay.setFilter(filterState);`
- `shop.js:203`: `window.floppyBay.init(products, { onSelect: (p) => openPDP(p), arrived: arrivedFromFloppy });` → `window.cassetteBay.init(products, { onSelect: (p) => openPDP(p), arrived: arrivedFromFloppy });`
- `shop.js:210`: `const gi = window.floppyBay.genreInfo(p.genre);` → `const gi = window.cassetteBay.genreInfo(p.genre);`

Two comment-only updates (no behavior change):
- `shop.js:191`: `/* ---------- 3D floppy bay — renders disks, hands selections back here ---------- */` → `/* ---------- 3D cassette bay — renders sleeves, hands selections back here ---------- */`
- `shop.js:206`: `colored to match floppy-bay.js's own genre divider walls ---------- */` → `colored to match cassette-bay.js's own genre divider walls ---------- */`

Leave `arrivedFromFloppy` (the variable name itself, `shop.js:34-35`) and the `?from=floppy` check untouched — that's the MPC's real floppy-drive button, unrelated to this rename.

- [ ] **Step 5: Verify nothing broke**

```bash
cd ~/Desktop/rmlur-site && grep -rn "floppy-bay\|window\.floppyBay" shop.html shop.js cassette-bay.js
```

Expected: no output (all references moved to `cassette-bay.js` / `window.cassetteBay`), except none should remain at all — if this prints anything, a reference was missed.

Then start the preview server and load the shop page:
- `preview_start({name: "rmlur-site"})`, then `navigate` to `http://localhost:8000/shop.html`
- `read_console_messages({onlyErrors: true})` — expect zero errors (specifically no 404 for `floppy-bay.js` and no `window.floppyBay is not a function`)
- Screenshot: the case should render exactly as before this task (grey/steep, unchanged) — this task is a pure rename, no visual change yet.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/rmlur-site && git add -A -- floppy-bay.js cassette-bay.js shop.html shop.js
git commit -m "$(cat <<'EOF'
Rename floppy-bay.js to cassette-bay.js

The shop's 3D case module is being redesigned to model a cassette
organizer instead of a floppy-disk one — renaming first so later
diffs in this file are about the actual geometry/material change,
not mixed in with a file move.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Note: `git add -A -- <paths>` stages only these four paths, leaving the repo's other pre-existing staged-but-uncommitted changes untouched.

---

### Task 2: Compact staircase bin layout, pedestal base, camera/lid framing

**Files:**
- Modify: `cassette-bay.js` (constants block, `buildHolder()`)

**Interfaces:**
- Consumes: `BIN`, `BIN_BACK_H`, `BIN_LIP_H`, `SLOTS`, `panelGeo`, `roundedRectShape`, `glossBlackMat` (all already defined earlier in the file, unchanged).
- Produces: updated `STEP_Z`, new `STEP_Y`, updated `binOrigin(slot)` — still returns `{y, z}` (same shape as before, new values), updated `caseTop`/`caseBottom`, a new pedestal mesh in `buildHolder()`, updated `orbit` defaults and `LID_OPEN`. Task 3 renders sleeves into `bins[slot].group` exactly as before — this task doesn't change that interface.

**Why:** the current layout lays all 5 bins at the same height in a single-file depth row (`STEP_Z = BIN.depth * 1.15`), which makes the case ~2.4x deeper than it is wide — a silhouette that reads as elongated/tall from any camera angle, which is the main reason the current render doesn't match the reference's compact, nested-staircase look. This task fixes the geometry itself before touching materials, per the spec's checkpoint order.

- [ ] **Step 1: Replace the bin-spacing constants and `binOrigin`**

Find this block (around line 173-192):

```js
  const SLOTS = BIN_PALETTE.length; // 5 physical bins, always present — matches the real case even when fewer genres exist
  // Every bin sits at the same height — depth (not height) is what
  // separates them. Must be close to a full bin depth or adjacent bins'
  // trough volumes physically overlap in Z and read as a jumbled mess.
  const STEP_Z = BIN.depth * 1.15; // >1x bin depth: adjacent bins' trough volumes never overlap
  // rank 0 = frontmost/closest to camera (yellow) .. rank SLOTS-1 = backmost/furthest (maroon)
  // Centered on Z=0 (not starting at 0 and running negative) so the
  // existing camera math — which always looks at world (0, sceneCenterY, 0)
  // — is actually aimed at the row's middle, the same symmetric-around-
  // origin assumption the old X-based layout relied on.
  const ROW_CENTER_OFFSET = ((SLOTS - 1) / 2) * STEP_Z;
  function binOrigin(slot) {
    const rank = SLOTS - 1 - slot;
    return { y: 0, z: ROW_CENTER_OFFSET - rank * STEP_Z };
  }
  const CASE_WALL_T = 0.05;
  const caseTop = BIN_BACK_H + 0.1;
  const caseBottom = -0.05;
```

Replace with:

```js
  const SLOTS = BIN_PALETTE.length; // 5 physical bins, always present — matches the real case even when fewer genres exist
  // The reference organizer nests the bins in a rising staircase — each
  // bin both higher AND further back than the one in front of it — not a
  // flat single-file row. STEP_Z now deliberately overlaps (<1x bin depth)
  // so the case stays compact front-to-back instead of the ~2.4:1
  // depth:width ratio the old flat-row layout produced.
  const STEP_Z = BIN.depth * 0.6;
  const STEP_Y = BIN_LIP_H * 1.6; // each bin rises above the one in front, staircase toward the lid
  // rank 0 = frontmost/closest to camera (yellow) .. rank SLOTS-1 = backmost/furthest (maroon)
  // Centered on Z=0 so the camera math (always looks at world (0, sceneCenterY, 0))
  // is aimed at the row's middle.
  const ROW_CENTER_OFFSET = ((SLOTS - 1) / 2) * STEP_Z;
  function binOrigin(slot) {
    const rank = SLOTS - 1 - slot;
    return { y: rank * STEP_Y, z: ROW_CENTER_OFFSET - rank * STEP_Z };
  }
  const CASE_WALL_T = 0.05;
  const PEDESTAL_H = 0.05;
  const caseTop = binOrigin(0).y + BIN_BACK_H + 0.1; // slot 0 (back/top bin) now sets the case height
  const caseFloorY = -0.05; // where the case's own floor panel sits (unchanged from before)
  const caseBottom = caseFloorY - PEDESTAL_H; // extends the framed bounding box down to include the new pedestal
```

- [ ] **Step 2: Add the pedestal base and fix the floor's Y reference in `buildHolder()`**

Find the floor block (around line 224-230):

```js
    {
      const floorGeo = panelGeo(roundedRectShape(caseW, caseDepth, 0.04), 0.06);
      floorGeo.rotateX(-Math.PI / 2);
      const floor = new THREE.Mesh(floorGeo, glossBlackMat());
      floor.position.set(0, caseBottom, caseCz);
      holder.add(floor);
    }
```

Replace with (floor now sits at `caseFloorY`, not `caseBottom`, and a wider/lower pedestal fills the gap down to `caseBottom`):

```js
    {
      const floorGeo = panelGeo(roundedRectShape(caseW, caseDepth, 0.04), 0.06);
      floorGeo.rotateX(-Math.PI / 2);
      const floor = new THREE.Mesh(floorGeo, glossBlackMat());
      floor.position.set(0, caseFloorY, caseCz);
      holder.add(floor);
    }
    {
      // Black plinth the whole case sits on — visible in the reference,
      // absent from the case's own flat floor alone. Slightly wider
      // footprint than the case shell, like a real product base.
      const pedGeo = panelGeo(roundedRectShape(caseW * 1.12, caseDepth * 1.08, 0.05), PEDESTAL_H);
      pedGeo.rotateX(-Math.PI / 2);
      const pedestal = new THREE.Mesh(pedGeo, glossBlackMat());
      pedestal.position.set(0, caseBottom, caseCz);
      holder.add(pedestal);
    }
```

- [ ] **Step 3: Widen the camera angle and re-tune the lid's open angle**

Find (around line 55):

```js
  const orbit = { theta: 0.24, phi: 0.95, radius: 6.5 };
```

Replace with:

```js
  // phi raised toward eye-level (closer to pi/2) than the old 0.95 rad —
  // the reference is shot standing in front of the case glancing slightly
  // down into it, not looking down from nearly overhead.
  const orbit = { theta: 0.24, phi: 1.18, radius: 6.5 };
```

Find (around line 200):

```js
  const LID_OPEN = -1.05;
```

Replace with:

```js
  // Recede further back than before so the open lid clears the shallower
  // camera's sightline instead of filling the frame — start here and
  // adjust in Step 4's screenshot check if the lid still crosses the bins.
  const LID_OPEN = -1.25;
```

- [ ] **Step 4: Visual check against the reference**

Start the preview and screenshot:
- `preview_start({name: "rmlur-site"})`, `navigate` to `http://localhost:8000/shop.html`
- `computer({action: "wait", duration: 2})` (let the lid-open animation finish)
- `computer({action: "screenshot"})`

Compare against `docs/superpowers/specs/reference/cassette-bay-reference.webp` (open it with the Read tool to view it). Check specifically:
1. The case's footprint no longer reads as tall/narrow — width and depth should look closer to comparable.
2. The lid recedes up and back, not standing in front of the bins.
3. A black pedestal is visible under the case.

If the silhouette is still off, this is the expected iteration point: adjust `STEP_Z`/`STEP_Y` (Step 1) or `orbit.phi`/`LID_OPEN` (Step 3) and re-screenshot. Do not move on until the case reads as compact rather than elongated — that's this task's actual deliverable, the exact numbers above are a starting point, not the requirement.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/rmlur-site && git add -A -- cassette-bay.js
git commit -m "$(cat <<'EOF'
Compact bin layout, pedestal base, and camera/lid framing

Bins now nest in a rising staircase (overlapping in depth, rising
toward the lid) instead of a flat single-file row that made the case
read ~2.4x deeper than wide. Added the black pedestal base visible in
the reference. Widened the camera toward eye-level and pushed the
open lid further back so it stops filling the frame.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Cassette sleeve geometry and label redesign

**Files:**
- Modify: `cassette-bay.js` (`DISK` constant, `diskShape()`/`bodyGeo`, `makeLabelTexture()`)

**Interfaces:**
- Consumes: `panelGeo`, `roundedRectShape` (unchanged), `entry.color`/`entry.genreKey`/`entry.product` shape from `items[]` (unchanged — `genreInfo()` untouched by this task).
- Produces: `bodyGeo` now a boxy cassette-case profile instead of a thin floppy-disk profile; `makeLabelTexture(entry)` returns a texture without the floppy shutter graphic. `buildDisks()` (unchanged code, just consumes the new `bodyGeo`/`DISK` values) still populates `disks[]`/`diskMeshes` exactly as before — Task 5's interaction changes rely on that array shape staying the same.

**Why:** per the spec, this is the single biggest visual gap — the current items are flat, thin floppy-disk shapes; the reference shows boxy, upright cassette cases with real thickness. Color and camera fixes alone (Task 2) won't fix this — the item shape itself has to change.

- [ ] **Step 1: Resize `DISK` for cassette-case proportions**

Find (around line 169):

```js
  const DISK = { w: 0.86, h: 0.95, depth: 0.05 };
```

Replace with:

```js
  // Renders as an upright cassette case now (see bodyGeo in setupThree(),
  // makeLabelTexture below) — constant/variable names kept as DISK/disks/
  // diskMeshes throughout the file to keep this diff scoped to the
  // geometry itself, not a naming pass.
  const DISK = { w: 0.86, h: 0.56, depth: 0.16 };
```

- [ ] **Step 2: Delete `diskShape()` and build `bodyGeo` from the existing generic helpers**

Delete the whole `diskShape()` function (around lines 258-278):

```js
  function diskShape() {
    const w = DISK.w, h = DISK.h, c = 0.16;
    const hw = w / 2, hh = h / 2;
    const s = new THREE.Shape();
    s.moveTo(-hw, hh - c);
    s.lineTo(-hw + c, hh);
    s.lineTo(hw, hh);
    s.lineTo(hw, -hh);
    s.lineTo(-hw, -hh);
    s.lineTo(-hw, hh - c);
    const notchW = 0.09, notchH = 0.05;
    const nx = hw - 0.15, ny = -hh;
    const hole = new THREE.Path();
    hole.moveTo(nx - notchW / 2, ny);
    hole.lineTo(nx + notchW / 2, ny);
    hole.lineTo(nx + notchW / 2, ny + notchH);
    hole.lineTo(nx - notchW / 2, ny + notchH);
    hole.closePath();
    s.holes.push(hole);
    return s;
  }
```

(It modeled a floppy disk's rounded corner + write-protect notch — not needed for a cassette case, and its only caller is the `bodyGeo` assignment in `setupThree()`, changed next.)

In `setupThree()`, find (around line 844-848):

```js
    bodyGeo = (function () {
      const geo = new THREE.ExtrudeGeometry(diskShape(), { depth: DISK.depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 6 });
      geo.translate(0, 0, -DISK.depth / 2);
      return geo;
    })();
```

Replace with:

```js
    // A cassette case is a beveled box, not a flat floppy-disk silhouette —
    // reuse the same rounded-rect + extrude helpers the case shell/bins
    // already use, instead of a bespoke shape function.
    bodyGeo = panelGeo(roundedRectShape(DISK.w, DISK.h, 0.05), DISK.depth);
```

- [ ] **Step 3: Replace the floppy-shutter label graphic with a cassette J-card style band**

Find `makeLabelTexture()` (around lines 281-333) and replace its body (keep the function signature and the final `CanvasTexture` return, replace the drawing calls):

```js
  function makeLabelTexture(entry) {
    const p = entry.product;
    const W = 480, H = 512;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#f4eee0';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, W - 8, H - 8);

    // Colored top band matching the sleeve's own bin/genre color — a
    // cassette J-card convention, replaces the old floppy-disk metal
    // shutter graphic (which doesn't make sense on a boxy cassette case).
    const bandH = H * 0.14;
    ctx.fillStyle = '#' + entry.color.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, W, bandH);

    ctx.fillStyle = '#fff';
    ctx.font = '700 24px -apple-system, "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(entry.genreKey, 20, bandH * 0.68);

    ctx.fillStyle = '#1c1a16';
    ctx.font = '46px "Kalam", cursive';
    ctx.save();
    ctx.translate(26, bandH + 76);
    ctx.rotate(-0.03);
    wrapText(ctx, p.title, 0, 0, W - 70, 50);
    ctx.restore();

    ctx.fillStyle = '#4a453a';
    ctx.font = '600 24px -apple-system, "Helvetica Neue", Arial, sans-serif';
    const metaStr = p.bpm ? (p.bpm + ' BPM' + (p.key ? ' · ' + p.key : '')) : (p.type === 'kit' ? 'SAMPLE KIT' : '');
    ctx.fillText(metaStr, 26, H - 60);

    ctx.fillStyle = '#1c1a16';
    ctx.font = '700 28px -apple-system, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('$' + minPrice(p).toFixed(0), W - 92, H - 22);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }
```

- [ ] **Step 4: Visual check**

`preview_start({name: "rmlur-site"})` → `navigate` to `http://localhost:8000/shop.html` → wait 2s → screenshot. Confirm: items in the bins now read as boxy standing cases (visible thickness, not flat cards), with a colored top band + handwritten title instead of the grey shutter bar. Compare against the reference for general proportions (the reference's cassette cases are noticeably landscape-ish, wider than tall).

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/rmlur-site && git add -A -- cassette-bay.js
git commit -m "$(cat <<'EOF'
Cassette-shaped sleeves replace floppy-disk sleeves

Items now render as boxy standing cassette cases (real thickness,
J-card-style colored band) instead of thin floppy-disk shapes with a
write-protect notch and metal-shutter graphic that no longer made
sense once the reference object changed from a floppy organizer to a
cassette one. bodyGeo is now built from the file's existing generic
rounded-rect/extrude helpers instead of a bespoke shape function.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Materials and lighting pass

**Files:**
- Modify: `cassette-bay.js` (`solidMat`, `glossBlackMat`, `acrylicMat`, light setup in `setupThree()`)

**Interfaces:**
- Consumes/produces: no signature changes, only numeric tuning of existing material factory functions and light intensities. Every call site (`buildBins()`, `buildHolder()`, `buildDisks()`) is untouched.

**Why:** per the spec, the live render reads flat/grey even where colors are technically correct — ambient light is high relative to the key light, washing out saturation, and the bin plastic's roughness is a bit too matte for the reference's glossier "injection-molded plastic" look.

- [ ] **Step 1: Glossier, more saturated bin plastic**

Find `buildBins()`'s material line (around line 456):

```js
      const mat = solidMat(color, 0.32);
```

Replace with:

```js
      const mat = solidMat(color, 0.22); // glossier than before — reference bins show a clear specular highlight
```

- [ ] **Step 2: Richer case shell black**

Find `glossBlackMat()` (around line 146-148):

```js
  function glossBlackMat() {
    return new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.2, metalness: 0.1 });
  }
```

Replace with:

```js
  function glossBlackMat() {
    return new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.15, metalness: 0.12 });
  }
```

- [ ] **Step 3: Slightly richer smoked-lid tint**

Find `acrylicMat()` (around line 150-161), change only the `opacity` value:

```js
    return new THREE.MeshPhysicalMaterial({
      color: 0x2c2c27, roughness: 0.14, metalness: 0,
      transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false,
    });
```

(only `opacity: 0.34` → `opacity: 0.4` changes; everything else in this function, including its comment, stays as-is)

- [ ] **Step 4: Rebalance ambient vs. key light for more contrast**

Find the light setup in `setupThree()` (around line 837-840):

```js
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff3e0, 0.95); key.position.set(2.4, 4, 3.2); scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35); fill.position.set(-3, 2, -1.5); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xe4ecf2, 0.22); rim.position.set(-1, 2.5, -3); scene.add(rim);
```

Replace with:

```js
    scene.add(new THREE.AmbientLight(0xffffff, 0.42));
    const key = new THREE.DirectionalLight(0xfff3e0, 1.15); key.position.set(2.4, 4, 3.2); scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35); fill.position.set(-3, 2, -1.5); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xe4ecf2, 0.22); rim.position.set(-1, 2.5, -3); scene.add(rim);
```

- [ ] **Step 5: Visual check**

`preview_start({name: "rmlur-site"})` → `navigate` to `http://localhost:8000/shop.html` → wait 2s → screenshot. Compare against the reference: bins should show visible specular highlights and richer color saturation, the case shell should read as glossy black rather than flat charcoal, and the lid should have a slightly more visible smoked tint without going opaque/black. If any bin color now looks blown-out (over-bright) or too dark, adjust the `key` light intensity from Step 4 rather than touching per-bin colors — that keeps `BIN_PALETTE` the single source of truth for hue.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/rmlur-site && git add -A -- cassette-bay.js
git commit -m "$(cat <<'EOF'
Glossier materials and higher-contrast lighting

Lower roughness on bin plastic and the case shell, a touch more
smoked-lid opacity, and rebalanced ambient/key light intensity so
colors read saturated instead of flat/washed-out — closing the
materials gap from the reference render.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Interaction refinement — selected sleeve pops forward and faces the camera

**Files:**
- Modify: `cassette-bay.js` (`computeTargets()`)

**Interfaces:**
- Consumes: `hoverIndex`, `state.index`, `visibleItems()`, `groupByGenre()` (all unchanged).
- Produces: same `d.target` shape (`{x, y, z, rx, ry, rz, scale, emissive}`) consumed by `tick()` — no changes needed in `tick()` itself, since it already exponentially eases every field in `d.target` (this is the file's existing spring-like easing; nothing new needed there).

**Why:** hover/click/`onSelect`→`openPDP` already work end-to-end today (confirmed in the spec) — this task only makes the *selected* sleeve read as pulled-toward-you rather than just resting in the same lean as every other sleeve in its bin.

- [ ] **Step 1: Differentiate the active sleeve's rotation and forward pop from a merely-hovered one**

Find the per-entry block inside `computeTargets()` (around lines 573-588):

```js
        const isActive = entry.index === activeEntry.index;
        const hovered = hoverIndex === entry.index;
        const j = hash(entry.index);
        const leanRy = -0.12 + (j - 0.5) * 0.1; // slight shared lean + per-disk jitter — still face-on, never edge-on

        // Pop-forward distances scaled to the bin's own shallow depth
        // (BIN.depth 0.55) — the old values were tuned for a much deeper
        // single tray and pushed the active disk out past its bin's lip.
        Object.assign(d.target, {
          x: FAN_STEP.dx * localOffset,
          y: (isActive ? (hovered ? 0.025 : 0.015) : 0) + FAN_STEP.dy * localOffset,
          z: (isActive ? (hovered ? 0.11 : 0.08) : -0.015) + FAN_STEP.dz * localOffset,
          rx: -0.08, ry: leanRy, rz: (j - 0.5) * 0.04,
          scale: (isActive ? (hovered ? 1.08 : 1.04) : (hovered ? 1.03 : 1)) * Math.max(0.85, 1 - localOffset * 0.018),
          emissive: isActive ? (hovered ? 1 : 0.4) : (hovered ? 0.6 : 0),
        });
```

Replace with:

```js
        const isActive = entry.index === activeEntry.index;
        const hovered = hoverIndex === entry.index;
        const j = hash(entry.index);
        const leanRy = -0.12 + (j - 0.5) * 0.1; // slight shared lean + per-disk jitter — still face-on, never edge-on
        // Selecting a sleeve rotates it to face the camera more directly
        // (rather than resting at the shared bin lean) and pops it further
        // forward than a mere hover — reads as pulling the case out toward
        // you, not just a UI hover highlight.
        const activeRy = isActive ? leanRy * 0.35 : leanRy;
        const activeRx = isActive ? -0.03 : -0.08;

        // Pop-forward distances scaled to the bin's own shallow depth
        // (BIN.depth 0.55) — the old values were tuned for a much deeper
        // single tray and pushed the active disk out past its bin's lip.
        Object.assign(d.target, {
          x: FAN_STEP.dx * localOffset,
          y: (isActive ? (hovered ? 0.025 : 0.015) : 0) + FAN_STEP.dy * localOffset,
          z: (isActive ? (hovered ? 0.15 : 0.11) : -0.015) + FAN_STEP.dz * localOffset,
          rx: activeRx, ry: activeRy, rz: (j - 0.5) * 0.04,
          scale: (isActive ? (hovered ? 1.08 : 1.04) : (hovered ? 1.03 : 1)) * Math.max(0.85, 1 - localOffset * 0.018),
          emissive: isActive ? (hovered ? 1 : 0.4) : (hovered ? 0.6 : 0),
        });
```

- [ ] **Step 2: Manual interaction check**

`preview_start({name: "rmlur-site"})` → `navigate` to `http://localhost:8000/shop.html` → wait 2s.
- `find({query: "View & Buy"})` to confirm the active tag's buy button is present, screenshot to see the active (first) sleeve — it should sit noticeably further forward and face more toward the camera than its neighbors.
- Use `computer` to click a different visible sleeve in the case (pick coordinates from the screenshot) and screenshot again — the newly-clicked sleeve should ease into the same pulled-forward, camera-facing pose (this is `computeTargets()`'s existing `f`-based exponential ease in `tick()`, unchanged by this task, so it should animate smoothly).
- Click the "View & Buy" button in the active tag and confirm the PDP overlay still opens with the right product's title/price/tiers (this exercises `onSelect → openPDP`, unchanged — confirms the interaction refinement didn't break the existing purchase-flow handoff).

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/rmlur-site && git add -A -- cassette-bay.js
git commit -m "$(cat <<'EOF'
Selected sleeve rotates toward camera and pops further forward

The active sleeve now visually distinguishes itself from a merely-
hovered one — facing the camera more directly and popping further
out of its bin — reading as pulling a physical cassette toward you.
onSelect -> openPDP handoff is unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Live verification across the real catalog and responsive check

**Files:** none (verification-only task, no code changes expected — any fixes found here should be small, applied inline to `cassette-bay.js`, and committed as their own follow-up commit rather than silently folded into a prior task's commit).

**Interfaces:** none — this task exercises the full public surface (`init`, `setFilter`, `genreInfo`) against real data and the real DOM the earlier tasks assumed existed.

- [ ] **Step 1: Full desktop walkthrough against real products**

`preview_start({name: "rmlur-site"})` → `navigate` to `http://localhost:8000/shop.html`.
- Screenshot the initial load (all 3 real products from `window.PRODUCTS`: `midnight-pager`, `deux-sexes-drums-v1`, `getty-tape`).
- Click each of the shop's genre tabs/pills (`TRAP`, `DRUM KIT`, `SOUL` per the current catalog) and confirm `setFilter` still narrows correctly — screenshot each.
- Click through all 3 products' sleeves, confirm each opens the correct PDP (matching title, price tiers, and that the "BUY" button's `href` points at that product's `stripeLink`) via `read_page` on the PDP overlay.
- Confirm the audio preview player still plays: click a product's preview toggle, check `read_console_messages` for audio errors, confirm the waveform/progress bar updates.

- [ ] **Step 2: Responsive/mobile check**

`resize_window({preset: "mobile"})`, reload the page (`navigate` to the same URL again so the mobile media query in `style.css`'s `.fb-stage-wrap` rule takes effect), screenshot. Confirm the case still renders inside its stage, the floating active/hover tags are legible, and tapping a sleeve on the emulated touch device still selects it (use `computer` tap-equivalent click). Reset with `resize_window({preset: "desktop"})` when done.

- [ ] **Step 3: Final side-by-side against the reference**

Screenshot the desktop view one more time and view it next to `docs/superpowers/specs/reference/cassette-bay-reference.webp`. This is the final acceptance check for the whole plan — confirm: compact proportions, visible cassette-shaped sleeves in multiple bins, glossy saturated colors, black pedestal, smoked lid receded out of the main sightline.

- [ ] **Step 4: If all checks pass, this plan is complete.**

If Step 1–3 turned up any bugs, fix them directly in `cassette-bay.js`, re-run the relevant check, and commit the fix separately:

```bash
cd ~/Desktop/rmlur-site && git add -A -- cassette-bay.js
git commit -m "Fix: <describe what Step N of Task 6 caught>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
