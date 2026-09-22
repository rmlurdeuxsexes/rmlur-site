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
  'use strict';

  let inited = false;
  let onSelect = function () {};
  // type: 'all'|'beat'|'kit', genre: 'all'|<genreKey>, search: string, sort: 'catalog'|'price'
  const filterState = { type: 'all', genre: 'all', search: '', sort: 'catalog' };
  const state = { index: 0 };
  let hoverIndex = null;

  /* ---------- genre color: the 5 real bins on the physical organizer,
     assigned to genres in first-seen catalog order (not a hash) — a real
     object has fixed bin colors, so the mapping must be deterministic and
     match those exact 5 colors, not an arbitrary per-genre color. A 6th+
     genre (beyond the physical case's 5 slots) falls back to a neutral
     charcoal until a bigger case is ever built. ---------- */
  const BIN_PALETTE = [0x5c1030, 0x1f8a3f, 0x1e50a8, 0xe0221f, 0xf5c518]; // maroon, green, blue, red, yellow — back/top to front/bottom
  const OVERFLOW_COLOR = 0x2a2a2a;
  const genreSlot = new Map(); // genreKey -> bin slot index, assigned on first use
  function genreInfo(genre) {
    const key = (genre || 'Beat').split(' / ')[0].trim() || 'Beat';
    const genreKey = key.toUpperCase();
    if (!genreSlot.has(genreKey)) genreSlot.set(genreKey, genreSlot.size);
    const slot = genreSlot.get(genreKey);
    const color = slot < BIN_PALETTE.length ? BIN_PALETTE[slot] : OVERFLOW_COLOR;
    return { genreKey, genreLabel: key, color, slot };
  }
  function minPrice(p) {
    const prices = (p.tiers || []).map((t) => t.price);
    return prices.length ? Math.min(...prices) : 0;
  }
  function hash(i) { const x = Math.sin(i * 999.13) * 10000; return x - Math.floor(x); }

  /* ---------- three basics ---------- */
  let stageWrap, canvas, renderer, scene, camera;
  // Looking down over the crate, like browsing vinyl in a milk crate — the
  // bins recede in depth (Z) and now also rise in a staircase (Y), so the
  // camera needs a steep-ish overhead angle (phi well below pi/2) to read
  // both axes via perspective: too close to eye-level (phi near pi/2)
  // foreshortens the depth/stair rise into pure height and the case reads
  // as a tall narrow tower instead of the reference's squat, wider-than-
  // tall crate.
  const orbit = { theta: 0.24, phi: 1.1, radius: 6.5 };
  function updateCameraFromOrbit() {
    camera.position.set(
      orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      sceneCenterY + orbit.radius * Math.cos(orbit.phi),
      sceneCenterZ + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta)
    );
    camera.lookAt(0, sceneCenterY, sceneCenterZ);
  }
  // A fixed radius only frames the case correctly at the one aspect ratio it
  // was tuned for — on a wide desktop stage the box renders small with dead
  // space around it. Refit from the case's own known physical size instead,
  // the same approach mpc-3d.js uses for the hero. Framed symmetrically
  // around the SAME sceneCenterY the camera actually looks at, or the two
  // disagree and crop one edge.
  function refitRadius() {
    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * camera.aspect);
    const halfW = (caseW / 2) * 1.2;
    const halfH = (sceneTop - caseBottom) / 2 * 1.15;
    // Depth budget must reach back to wherever the reclined-open lid's tip
    // actually ends up (sceneBackZ), not just the case body — it swings
    // further back than caseBackZ alone once it's open.
    const halfD = (caseFrontZ - sceneBackZ) / 2 * 1.1;
    const effectiveHalfH = halfH * Math.cos(orbit.phi) + halfD * Math.sin(orbit.phi);
    const radiusForHeight = effectiveHalfH / Math.tan(vFovRad / 2);
    const radiusForWidth = halfW / Math.tan(hFovRad / 2);
    orbit.radius = Math.max(radiusForHeight, radiusForWidth) * 1.25;
  }
  function resize() {
    const w = stageWrap.clientWidth, h = stageWrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    refitRadius();
  }

  /* ---------- geometry helpers ---------- */
  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const hw = w / 2, hh = h / 2;
    s.moveTo(-hw + r, -hh);
    s.lineTo(hw - r, -hh);
    s.quadraticCurveTo(hw, -hh, hw, -hh + r);
    s.lineTo(hw, hh - r);
    s.quadraticCurveTo(hw, hh, hw - r, hh);
    s.lineTo(-hw + r, hh);
    s.quadraticCurveTo(-hw, hh, -hw, hh - r);
    s.lineTo(-hw, -hh + r);
    s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    return s;
  }
  function frontLipShape(w, h, r, notchR) {
    const s = new THREE.Shape();
    const hw = w / 2, hh = h / 2;
    s.moveTo(-hw + r, -hh);
    s.lineTo(hw - r, -hh);
    s.quadraticCurveTo(hw, -hh, hw, -hh + r);
    s.lineTo(hw, hh - r);
    s.quadraticCurveTo(hw, hh, hw - r, hh);
    s.lineTo(notchR, hh);
    s.absarc(0, hh, notchR, 0, Math.PI, true);
    s.lineTo(-hw + r, hh);
    s.quadraticCurveTo(-hw, hh, -hw, hh - r);
    s.lineTo(-hw, -hh + r);
    s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    return s;
  }
  function panelGeo(shape, depth) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 10 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  }
  function slopedSideGeo(depthSpan, lowH, highH, thickness) {
    const s = new THREE.Shape();
    const backZ = -depthSpan / 2, frontZ = depthSpan / 2;
    s.moveTo(backZ, 0);
    s.lineTo(frontZ, 0);
    s.lineTo(frontZ, lowH);
    s.lineTo(backZ, highH);
    s.lineTo(backZ, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -thickness / 2);
    geo.rotateY(Math.PI / 2);
    geo.scale(1, 1, -1);
    return geo;
  }
  function solidMat(color, rough) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough !== undefined ? rough : 0.5, metalness: 0.04 });
  }
  // Glossy black chassis/base plastic (spec: roughness 0.2, metalness 0.1).
  function glossBlackMat() {
    return new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.15, metalness: 0.12 });
  }
  // Smoked/translucent brown-tinted acrylic flip lid (spec values verbatim).
  function acrylicMat() {
    // True transmission looked right face-on but rendered solid black or
    // vanished entirely at other camera angles/aspect ratios (angle-
    // dependent background sampling in this vendored build, no env map to
    // stabilize it) — plain alpha blending is angle-independent: it always
    // shows whatever's actually behind the lid, tinted, which reads as
    // genuinely see-through smoked acrylic at every viewport size.
    return new THREE.MeshPhysicalMaterial({
      color: 0x2c2c27, roughness: 0.14, metalness: 0,
      transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false,
    });
  }

  /* ---------- physical organizer: a single crate of 5 fixed color-coded
     bins nested in a rising staircase — each bin both higher and further
     back than the one in front of it, like looking down over a milk crate
     of vinyl records tilted up toward the back, not a flat single-file row
     or a vertical mail-sorter stack. Each bin is one genre; disks fan
     inside their own bin, same as the old compartment system. */
  // Renders as an upright cassette case now (see bodyGeo in setupThree(),
  // makeLabelTexture below) — constant/variable names kept as DISK/disks/
  // diskMeshes throughout the file to keep this diff scoped to the
  // geometry itself, not a naming pass.
  const DISK = { w: 0.86, h: 0.56, depth: 0.16 };
  const BIN = { w: 1.18, depth: 0.55, wallT: 0.03 };
  const BIN_BACK_H = DISK.h * 0.6;
  const BIN_LIP_H = DISK.h * 0.13;
  const SLOTS = BIN_PALETTE.length; // 5 physical bins, always present — matches the real case even when fewer genres exist
  // The reference organizer nests the bins in a rising staircase — each
  // bin both higher AND further back than the one in front of it — not a
  // flat single-file row. STEP_Z now deliberately overlaps (<1x bin depth)
  // so the case stays compact front-to-back instead of the ~2.4:1
  // depth:width ratio the old flat-row layout produced.
  const STEP_Z = BIN.depth * 0.6;
  // Modest per-bin rise — 4 steps must add up to well under one bin's own
  // BIN_BACK_H or the staircase inflates caseTop enough to make the whole
  // case read as a tall tower instead of the reference's squat crate.
  const STEP_Y = BIN_LIP_H * 0.5; // each bin rises above the one in front, staircase toward the lid
  // rank 0 = frontmost/closest to camera (yellow) .. rank SLOTS-1 = backmost/furthest (maroon)
  // Centered on Z=0 so the camera math (always looks at world (0, sceneCenterY, 0))
  // is aimed at the row's middle.
  const ROW_CENTER_OFFSET = ((SLOTS - 1) / 2) * STEP_Z;
  function binOrigin(slot) {
    const rank = SLOTS - 1 - slot;
    return { y: rank * STEP_Y, z: ROW_CENTER_OFFSET - rank * STEP_Z };
  }
  const CASE_WALL_T = 0.05;
  const PEDESTAL_H = 0.2; // tall enough to read as its own plinth, not blend into the case floor
  const caseTop = binOrigin(0).y + BIN_BACK_H + 0.1; // slot 0 (back/top bin) now sets the case height
  const caseFloorY = -0.05; // where the case's own floor panel sits (unchanged from before)
  const caseBottom = caseFloorY - PEDESTAL_H; // extends the framed bounding box down to include the new pedestal
  const caseBackZ = binOrigin(0).z - BIN.depth / 2 - CASE_WALL_T - 0.015;
  const caseFrontZ = binOrigin(SLOTS - 1).z + BIN.depth / 2 + 0.09;
  const caseW = BIN.w + 0.16;
  const caseDepth = caseFrontZ - caseBackZ;
  const LID_CLOSED = Math.PI / 2;
  // Propped open near-horizontal, reclined almost all the way back to flat
  // (close to -pi/2) instead of standing anywhere near vertical — the lid
  // is as long as the case's full depth, so at a near-vertical angle it
  // reads as tall as (or taller than) the case itself and dominates the
  // frame; leaned back nearly flat, its length reads mostly as depth
  // (foreshortened away from camera) instead of height.
  const LID_OPEN = -1.55;
  const lidLen = caseDepth * 1.04;
  // The open lid's actual reach (up and back from its hinge) — both the
  // vertical framing budget and the depth (Z) budget must include it, or
  // the two disagree with what the camera really needs to show and crop it.
  const sceneTop = Math.max(caseTop, caseTop + lidLen * Math.cos(LID_OPEN)) + 0.1;
  const sceneBackZ = Math.min(caseBackZ, caseBackZ + CASE_WALL_T / 2 + lidLen * Math.sin(LID_OPEN)) - 0.1;
  const sceneCenterY = (sceneTop + caseBottom) / 2;
  const sceneCenterZ = (caseFrontZ + sceneBackZ) / 2;
  let holder, lidGroup;
  const lidAnim = { t: 0 };
  // Settles the whole case up into place on arrival from the MPC's floppy
  // transition (see app.js goToShop()) — reuses this same lerp/tick, not a
  // second animation system.
  const holderIntro = { t: 0, active: false };

  function buildHolder() {
    holder = new THREE.Group();
    scene.add(holder);

    const caseH = caseTop - caseBottom;
    const caseCy = (caseTop + caseBottom) / 2;
    const caseCz = (caseFrontZ + caseBackZ) / 2;

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
    {
      const backGeo = panelGeo(roundedRectShape(caseW, caseH, 0.03), CASE_WALL_T);
      const back = new THREE.Mesh(backGeo, glossBlackMat());
      back.position.set(0, caseCy, caseBackZ + CASE_WALL_T / 2);
      holder.add(back);
    }
    [-1, 1].forEach((side) => {
      const geo = panelGeo(roundedRectShape(caseDepth, caseH, 0.03), CASE_WALL_T);
      const wall = new THREE.Mesh(geo, glossBlackMat());
      wall.rotation.y = Math.PI / 2;
      wall.position.set(side * (caseW / 2 - CASE_WALL_T / 2), caseCy, caseCz);
      holder.add(wall);
    });

    lidGroup = new THREE.Group();
    lidGroup.position.set(0, caseTop, caseBackZ + CASE_WALL_T / 2);
    lidGroup.rotation.x = LID_CLOSED;
    holder.add(lidGroup);
    {
      const lidGeo = panelGeo(roundedRectShape(caseW, lidLen, 0.04), CASE_WALL_T);
      lidGeo.translate(0, lidLen / 2, 0);
      const lid = new THREE.Mesh(lidGeo, acrylicMat());
      lidGroup.add(lid);
    }
  }

  /* ---------- disks ---------- */
  let bodyGeo;

  function makeLabelTexture(entry) {
    const p = entry.product;
    // Canvas aspect matches the label plane's own aspect — buildDisks()
    // sizes that plane as DISK.w*0.86 x DISK.h*0.86, i.e. DISK.w/DISK.h
    // (~1.536, landscape) since Task 3 widened DISK. A portrait canvas
    // (the old 480x512) mapped onto that landscape plane with no aspect
    // correction stretched everything drawn here ~64% horizontally.
    const W = 600, H = 390;
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
    const bandH = H * 0.17;
    ctx.fillStyle = '#' + entry.color.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, W, bandH);

    // Dark text on light band colors (the yellow bin palette color reads
    // poorly under white) — luminance check, white everywhere else.
    const r = (entry.color >> 16) & 255, g = (entry.color >> 8) & 255, b = entry.color & 255;
    const bandLuminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    ctx.fillStyle = bandLuminance > 0.6 ? '#1c1a16' : '#fff';
    ctx.font = '700 26px -apple-system, "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(entry.genreKey, 24, bandH * 0.66);

    ctx.fillStyle = '#1c1a16';
    ctx.font = '40px "Kalam", cursive';
    ctx.save();
    ctx.translate(28, bandH + 54);
    ctx.rotate(-0.03);
    wrapText(ctx, p.title, 0, 0, W - 100, 44);
    ctx.restore();

    ctx.fillStyle = '#4a453a';
    ctx.font = '600 22px -apple-system, "Helvetica Neue", Arial, sans-serif';
    const metaStr = p.bpm ? (p.bpm + ' BPM' + (p.key ? ' · ' + p.key : '')) : (p.type === 'kit' ? 'SAMPLE KIT' : '');
    ctx.fillText(metaStr, 28, H - 48);

    ctx.fillStyle = '#1c1a16';
    ctx.font = '700 26px -apple-system, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('$' + minPrice(p).toFixed(0), W - 112, H - 20);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = ''; let ly = y;
    for (let n = 0; n < words.length; n++) {
      const test = line + words[n] + ' ';
      if (ctx.measureText(test).width > maxWidth && n > 0) {
        ctx.fillText(line, x, ly);
        line = words[n] + ' ';
        ly += lineHeight;
      } else line = test;
    }
    ctx.fillText(line, x, ly);
  }

  let items = []; // {product, index, genreKey, genreLabel, color}
  const disks = [];
  const diskMeshes = [];

  function buildDisks() {
    items.forEach((entry) => {
      const group = new THREE.Group();
      const visual = new THREE.Group();
      visual.position.y = DISK.h / 2;
      group.add(visual);

      const bodyMat = solidMat(entry.color, 0.55);
      bodyMat.emissive = new THREE.Color(0x39ff6a);
      bodyMat.emissiveIntensity = 0;
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.userData.diskIndex = entry.index;
      visual.add(body);

      const labelMat = new THREE.MeshStandardMaterial({
        map: makeLabelTexture(entry), roughness: 0.75, metalness: 0, side: THREE.DoubleSide,
      });
      const labelGeo = new THREE.PlaneGeometry(DISK.w * 0.86, DISK.h * 0.86);
      const label = new THREE.Mesh(labelGeo, labelMat);
      label.position.z = DISK.depth / 2 + 0.012;
      label.userData.diskIndex = entry.index;
      visual.add(label);

      // Disks live inside their genre's own bin group, not the shared
      // holder — a fixed physical slot, so their fan-out targets can just
      // be small local offsets instead of a whole compartment-position
      // calculation. A genre beyond the case's 5 real slots has no bin to
      // sit in yet, so it parks in the holder directly (edge case, not
      // reachable with today's catalog).
      const parent = bins[entry.slot] ? bins[entry.slot].group : holder;
      parent.add(group);
      diskMeshes.push(body, label);

      disks.push({
        index: entry.index, group, visual, bodyMat,
        inView: true, currentScale: 1, currentEmissive: 0,
        target: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, emissive: 0 },
      });
    });
  }

  /* soft floor spotlight under the active disk, one per bin (each bin is
     its own local coordinate space now) — depthTest:false + a high
     renderOrder are BOTH required, or the opaque floor mesh depth-occludes
     it and it silently renders invisible. */
  function makeGlowTexture() {
    const S = 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(90,255,150,0.5)');
    g.addColorStop(0.55, 'rgba(90,255,150,0.16)');
    g.addColorStop(1, 'rgba(90,255,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return new THREE.CanvasTexture(cv);
  }
  let glowTexture = null;
  function getGlowTexture() { return glowTexture || (glowTexture = makeGlowTexture()); }

  /* ---------- the 5 bins ----------
     Each bin is a real, always-present shelf (own back wall, sloped sides,
     front lip + feet), colored from the fixed BIN_PALETTE — not a flat
     divider tab. Genres fan their disks inside their assigned bin (same
     FAN_STEP stacking as before); an unpopulated bin still renders empty,
     exactly like the physical case has 5 slots whether or not you own that
     many genres yet. */
  const FOOT = { w: 0.1, h: 0.022, d: 0.035 };
  const FAN_STEP = { dx: 0.018, dy: 0.012, dz: -0.05 }; // per-disk offset stacking back into the bin
  const FAN_MAX = 6; // deepest disk rendered behind the front one — deeper ones reveal as you step past

  const PLATE = { w: BIN.w * 0.62, h: BIN.w * 0.62 * (90 / 220) };
  let plateGeo;
  function makePlateTexture(label) {
    const W = 220, H = 90;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f6f3ea';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(70,150,95,.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ly = 34 + i * 20;
      ctx.beginPath(); ctx.moveTo(12, ly); ctx.lineTo(W - 12, ly); ctx.stroke();
    }
    ctx.fillStyle = '#1c1a16';
    ctx.font = '700 22px -apple-system, "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label.toUpperCase(), 12, 22);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  const bins = []; // index = slot 0..SLOTS-1, {group, color, slot}
  function buildBins() {
    for (let slot = 0; slot < SLOTS; slot++) {
      const origin = binOrigin(slot);
      const color = BIN_PALETTE[slot];
      const group = new THREE.Group();
      group.position.set(0, origin.y, origin.z);
      holder.add(group);

      const mat = solidMat(color, 0.22); // glossier than before — reference bins show a clear specular highlight
      {
        const backGeo = panelGeo(roundedRectShape(BIN.w, BIN_BACK_H, 0.03), BIN.wallT);
        const back = new THREE.Mesh(backGeo, mat);
        back.position.set(0, BIN_BACK_H / 2, -BIN.depth / 2 + BIN.wallT / 2);
        group.add(back);
      }
      [-1, 1].forEach((side) => {
        const geo = slopedSideGeo(BIN.depth, BIN_LIP_H, BIN_BACK_H, BIN.wallT);
        const wall = new THREE.Mesh(geo, mat);
        wall.position.set(side * (BIN.w / 2 - BIN.wallT / 2), 0, 0);
        group.add(wall);
      });
      const lipZ = BIN.depth / 2 - BIN.wallT / 2;
      {
        const shape = frontLipShape(BIN.w, BIN_LIP_H, 0.03, 0.09);
        const geo = panelGeo(shape, BIN.wallT);
        const lip = new THREE.Mesh(geo, mat);
        lip.position.set(0, BIN_LIP_H / 2, lipZ);
        group.add(lip);
      }
      [-1, 1].forEach((side) => {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(FOOT.w, FOOT.h, FOOT.d), glossBlackMat());
        foot.position.set(side * BIN.w * 0.26, -FOOT.h / 2, lipZ + BIN.wallT / 2);
        group.add(foot);
      });
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.85, 0.85),
        new THREE.MeshBasicMaterial({ map: getGlowTexture(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })
      );
      glow.renderOrder = 10;
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.01;
      glow.visible = false;
      group.add(glow);
      bins.push({ group, color, slot, glow });
    }
  }
  // Attaches the little green-ruled paper name-plate to each populated
  // bin — called once genres/items are known, after buildBins().
  function buildBinLabels() {
    const bySlot = new Map();
    genreSlot.forEach((slot, key) => bySlot.set(slot, key));
    bins.forEach((bin) => {
      const genreKey = bySlot.get(bin.slot);
      if (genreKey == null) return;
      const entry = items.find((e) => e.genreKey === genreKey);
      const mat = new THREE.MeshStandardMaterial({
        map: makePlateTexture(entry.genreLabel), roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(plateGeo, mat);
      mesh.position.set(0, BIN_LIP_H + PLATE.h / 2 + 0.012, BIN.depth / 2 + 0.03);
      mesh.rotation.x = -0.5;
      bin.group.add(mesh);
    });
  }

  /* ---------- layout / targets ---------- */
  function minPriceOf(entry) { return minPrice(entry.product); }
  function visibleItems() {
    const q = filterState.search.trim().toLowerCase();
    let vis = items.filter((e) =>
      (filterState.type === 'all' || e.product.type === filterState.type) &&
      (filterState.genre === 'all' || e.genreKey === filterState.genre) &&
      (!q || e.product.title.toLowerCase().includes(q) || (e.product.tags || []).some((t) => t.toLowerCase().includes(q)))
    );
    if (filterState.sort === 'price') vis = vis.slice().sort((a, b) => minPriceOf(a) - minPriceOf(b));
    return vis;
  }
  function clampIndex() {
    const n = visibleItems().length;
    if (state.index < 0) state.index = 0;
    if (state.index > n - 1) state.index = Math.max(0, n - 1);
  }
  // Each genre already owns a fixed, always-present bin (see buildBins) —
  // no layout math needed to place a "compartment," just group the
  // currently-visible entries by genre and fan each group inside its own
  // bin's local space. A genre beyond the case's 5 real slots has nowhere
  // to render (not reachable with today's catalog; see buildDisks).
  function groupByGenre(vis) {
    const map = new Map();
    vis.forEach((e) => {
      if (!map.has(e.genreKey)) map.set(e.genreKey, []);
      map.get(e.genreKey).push(e);
    });
    return map;
  }

  function computeTargets() {
    const vis = visibleItems();
    clampIndex();
    if (!vis.length) { disks.forEach((d) => { d.inView = false; d.group.visible = false; }); return; }

    disks.forEach((d) => {
      const v = vis.find((e) => e.index === d.index);
      d.inView = !!v;
      if (!d.inView) d.group.visible = false;
    });

    const activeEntry = vis[state.index];
    const grouped = groupByGenre(vis);

    grouped.forEach((entries) => {
      const containsActive = entries.some((e) => e.index === activeEntry.index);
      // A bin nobody's browsing yet just rests on its own first disk, like
      // an unopened stack waiting to be picked — only the bin holding the
      // current selection advances its front card.
      const localActiveIdx = containsActive ? entries.findIndex((e) => e.index === activeEntry.index) : 0;

      entries.forEach((entry, li) => {
        const d = disks[entry.index];
        const localOffset = li - localActiveIdx;
        // Already-passed disks in this bin, or ones stacked too deep to
        // render — hidden until stepping wraps back around to them.
        if (localOffset < 0 || localOffset > FAN_MAX) { d.group.visible = false; return; }
        d.group.visible = true;

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
      });
    });
  }

  function selectByIndex(index) {
    const vis = visibleItems();
    const vIdx = vis.findIndex((e) => e.index === index);
    if (vIdx >= 0) state.index = vIdx;
    afterNav();
  }
  // Wraps forever in both directions — stepping past the last disk (in any
  // compartment) loops back to the first, so the bay always has a "next"
  // and never dead-ends, matching a crate you can flip through endlessly.
  function step(delta) {
    const n = visibleItems().length;
    if (!n) return;
    state.index = ((state.index + delta) % n + n) % n;
    afterNav();
  }
  function afterNav() { computeTargets(); updateActiveTagContent(); updateDots(); }

  /* ---------- tick / render loop ---------- */
  let clock, dragging = false, lastInteraction = 0, autoDir = 1;
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (lidAnim.t < 1) {
      lidAnim.t = Math.min(1, lidAnim.t + dt / 1.1);
      lidGroup.rotation.x = THREE.MathUtils.lerp(LID_CLOSED, LID_OPEN, easeOutCubic(lidAnim.t));
    }
    if (holderIntro.active) {
      holderIntro.t = Math.min(1, holderIntro.t + dt / 0.8);
      holder.position.y = THREE.MathUtils.lerp(-0.6, 0, easeOutCubic(holderIntro.t));
      if (holderIntro.t >= 1) holderIntro.active = false;
    }

    const f = 1 - Math.pow(0.0025, dt);
    disks.forEach((d) => {
      if (!d.inView) return;
      const g = d.group, tgt = d.target;
      g.position.x += (tgt.x - g.position.x) * f;
      g.position.y += (tgt.y - g.position.y) * f;
      g.position.z += (tgt.z - g.position.z) * f;
      g.rotation.x += (tgt.rx - g.rotation.x) * f;
      g.rotation.y += (tgt.ry - g.rotation.y) * f;
      g.rotation.z += (tgt.rz - g.rotation.z) * f;
      d.currentScale += (tgt.scale - d.currentScale) * f;
      d.visual.scale.setScalar(d.currentScale);
      // No body emissive tint on active/hover any more — even a small
      // additive green glow shifted the organizer's vivid, dark genre
      // colors (maroon especially) toward plain green. The spec's "soft
      // green glow" belongs UNDERNEATH the disk (bin.glow, in tick()
      // below), not on the casing itself; scale + forward-pop + the floor
      // glow are enough active-state feedback on their own.
      d.currentEmissive += (tgt.emissive - d.currentEmissive) * f;
    });
    if (!dragging && performance.now() - lastInteraction > 2200) {
      // Kept tighter than the drag clamp (±0.85) — at a small catalog size
      // (as few as 1-3 items) the near/active disk and the next one behind
      // it are close enough that swinging out to the full drag range lets
      // their labels visually cross over from some angles.
      orbit.theta += dt * 0.045 * autoDir;
      if (orbit.theta > 0.22) { orbit.theta = 0.22; autoDir = -1; }
      if (orbit.theta < -0.22) { orbit.theta = -0.22; autoDir = 1; }
    }
    // Only the bin holding the active disk shows its floor glow — bins are
    // fixed in place now, so this is just a visibility/position toggle,
    // not a whole-bin lerp.
    bins.forEach((bin) => { if (bin.glow) bin.glow.visible = false; });
    const activeIdx = currentActiveIndex();
    if (activeIdx !== null && disks[activeIdx]) {
      const bin = bins[items[activeIdx].slot];
      if (bin && bin.glow) {
        bin.glow.visible = true;
        const gp = disks[activeIdx].group.position;
        bin.glow.position.x += (gp.x - bin.glow.position.x) * f;
        bin.glow.position.z += (gp.z - bin.glow.position.z) * f;
      }
    }

    updateCameraFromOrbit();
    updateFloatingTags();

    renderer.render(scene, camera);
  }

  /* ---------- floating contextual UI ---------- */
  let activeTagEl, activeTitleEl, activeMetaEl, activePriceEl, loadBtn, hoverTagEl, hoverTitleEl, hoverPriceEl;
  const _v = new THREE.Vector3();
  function projectToScreen(worldPos) {
    const rect = stageWrap.getBoundingClientRect();
    _v.copy(worldPos).project(camera);
    return { x: (_v.x * 0.5 + 0.5) * rect.width, y: (1 - (_v.y * 0.5 + 0.5)) * rect.height };
  }
  function currentActiveIndex() {
    const vis = visibleItems();
    const e = vis[state.index];
    return e ? e.index : null;
  }
  function updateFloatingTags() {
    const activeIdx = currentActiveIndex();
    if (activeIdx !== null && disks[activeIdx]) {
      const d = disks[activeIdx];
      const p = d.visual.getWorldPosition(new THREE.Vector3());
      // A narrower/taller stage (mobile portrait) maps the same world-space
      // drop to a smaller fraction of screen height, so the tag needs to be
      // pushed further below the disk to clear the fan above it.
      const boxAspect = stageWrap.clientWidth / stageWrap.clientHeight;
      const dropFactor = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(boxAspect, 0.8, 1.75, 0.62, 0.44), 0.44, 0.62);
      p.y -= DISK.h * dropFactor;
      const s = projectToScreen(p);
      activeTagEl.style.left = s.x + 'px';
      activeTagEl.style.top = s.y + 'px';
      activeTagEl.hidden = false;
    } else {
      activeTagEl.hidden = true;
    }

    if (hoverIndex !== null && hoverIndex !== activeIdx && disks[hoverIndex] && disks[hoverIndex].inView) {
      const d = disks[hoverIndex];
      const p = d.visual.getWorldPosition(new THREE.Vector3());
      p.y += DISK.h * 0.48;
      const s = projectToScreen(p);
      hoverTagEl.style.left = s.x + 'px';
      hoverTagEl.style.top = s.y + 'px';
      hoverTagEl.hidden = false;
    } else {
      hoverTagEl.hidden = true;
    }
  }
  function updateActiveTagContent() {
    const idx = currentActiveIndex();
    if (idx === null) return;
    const entry = items[idx];
    activeTitleEl.textContent = entry.product.title;
    activeMetaEl.textContent = entry.product.bpm ? (entry.product.bpm + ' BPM · ' + entry.product.key) : (entry.product.type === 'kit' ? 'Sample Kit' : '');
    activePriceEl.textContent = 'FROM $' + minPrice(entry.product).toFixed(2);
  }
  function updateHoverTagContent() {
    if (hoverIndex === null) return;
    const entry = items[hoverIndex];
    hoverTitleEl.textContent = entry.product.title;
    hoverPriceEl.textContent = 'FROM $' + minPrice(entry.product).toFixed(2);
  }

  const dotsEl = () => document.getElementById('fb-dots');
  function updateDots() {
    const el = dotsEl();
    if (!el) return;
    el.innerHTML = '';
    const vis = visibleItems();
    vis.forEach((e, i) => {
      const s = document.createElement('span');
      if (i === state.index) s.classList.add('on');
      s.addEventListener('click', () => { state.index = i; afterNav(); });
      el.appendChild(s);
    });
  }

  /* ---------- pointer interaction: orbit + hover + click-to-select ---------- */
  let raycaster, pointerNdc, dragStart = null, dragMoved = false;

  function setPointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function bindInteraction() {
    stageWrap.addEventListener('pointerdown', (e) => {
      dragging = true; dragMoved = false;
      dragStart = { x: e.clientX, y: e.clientY, theta: orbit.theta, phi: orbit.phi };
      stageWrap.classList.add('dragging');
      lastInteraction = performance.now();
    });
    window.addEventListener('pointermove', (e) => {
      lastInteraction = performance.now();
      if (dragging && dragStart) {
        const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
        orbit.theta = THREE.MathUtils.clamp(dragStart.theta - dx * 0.006, -0.85, 0.85);
        orbit.phi = THREE.MathUtils.clamp(dragStart.phi - dy * 0.006, 0.62, 1.42);
        return;
      }
      if (e.target === canvas || stageWrap.contains(e.target)) {
        setPointerFromEvent(e);
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects(diskMeshes, false);
        const newHover = hits.length ? hits[0].object.userData.diskIndex : null;
        if (newHover !== hoverIndex) {
          hoverIndex = newHover;
          canvas.style.cursor = hoverIndex !== null ? 'pointer' : '';
          computeTargets();
          updateHoverTagContent();
        }
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (dragging && !dragMoved) {
        setPointerFromEvent(e);
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects(diskMeshes, false);
        if (hits.length) selectByIndex(hits[0].object.userData.diskIndex);
      }
      dragging = false; dragStart = null;
      stageWrap.classList.remove('dragging');
    });
    stageWrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      lastInteraction = performance.now();
      step(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    document.getElementById('fb-prev').addEventListener('click', () => { lastInteraction = performance.now(); step(-1); });
    document.getElementById('fb-next').addEventListener('click', () => { lastInteraction = performance.now(); step(1); });
    loadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadBtn.classList.remove('zap'); void loadBtn.offsetWidth; loadBtn.classList.add('zap');
      const idx = currentActiveIndex();
      if (idx !== null) onSelect(items[idx].product);
    });
  }

  /* ---------- setup ---------- */
  function setupThree() {
    stageWrap = document.getElementById('fb-stageWrap');
    canvas = document.getElementById('fb-stage');
    activeTagEl = document.getElementById('fb-activeTag');
    activeTitleEl = document.getElementById('fb-activeTitle');
    activeMetaEl = document.getElementById('fb-activeMeta');
    activePriceEl = document.getElementById('fb-activePrice');
    loadBtn = document.getElementById('fb-loadBtn');
    hoverTagEl = document.getElementById('fb-hoverTag');
    hoverTitleEl = document.getElementById('fb-hoverTitle');
    hoverPriceEl = document.getElementById('fb-hoverPrice');

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    updateCameraFromOrbit();
    window.addEventListener('resize', resize);

    scene.add(new THREE.AmbientLight(0xffffff, 0.42));
    const key = new THREE.DirectionalLight(0xfff3e0, 1.15); key.position.set(2.4, 4, 3.2); scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35); fill.position.set(-3, 2, -1.5); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xe4ecf2, 0.22); rim.position.set(-1, 2.5, -3); scene.add(rim);

    buildHolder();

    // A cassette case is a beveled box, not a flat floppy-disk silhouette —
    // reuse the same rounded-rect + extrude helpers the case shell/bins
    // already use, instead of a bespoke shape function.
    bodyGeo = panelGeo(roundedRectShape(DISK.w, DISK.h, 0.05), DISK.depth);
    plateGeo = new THREE.PlaneGeometry(PLATE.w, PLATE.h);

    raycaster = new THREE.Raycaster();
    pointerNdc = new THREE.Vector2();
    clock = new THREE.Clock();
    lastInteraction = performance.now();

    bindInteraction();
  }

  function boot() {
    resize();
    computeTargets();
    updateActiveTagContent();
    updateDots();
    tick();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        disks.forEach((d) => {
          const mat = d.visual.children[1].material;
          mat.map = makeLabelTexture(items[d.index]);
          mat.map.needsUpdate = true;
        });
      }).catch(() => {});
    }
  }

  function init(products, opts) {
    if (inited) return;
    onSelect = (opts && opts.onSelect) || function () {};
    items = products.map((p, i) => Object.assign({ product: p, index: i }, genreInfo(p.genre)));
    // Start on the first item — every bin rests on its own front disk
    // regardless, so there's no lopsided-fan reason to start mid-catalog.
    state.index = 0;
    setupThree(); // builds the case shell + lid (holder)
    buildBins();
    buildBinLabels();
    buildDisks();
    if (opts && opts.arrived) { holder.position.y = -0.6; holderIntro.active = true; }
    boot();
    inited = true;
  }
  // Patch-style: each UI control (type tabs, genre pills, search, sort)
  // only sends the field it changed.
  function setFilter(patch) {
    Object.assign(filterState, patch);
    state.index = 0; // each bin rests on its own front disk — no lopsided-fan reason to start mid-list
    afterNav();
  }

  return { init, setFilter, genreInfo };
})();
