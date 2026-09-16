/* ============================================================
   RMLUR FLOPPY BAY — 3D shop disk browser (Three.js)

   Ported from a standalone prototype into a data-driven module: renders
   window.PRODUCTS as floppy disks fanned inside a cream tray (translucent
   frosted lid, low front lip w/ thumb-notch), grouped by genre with
   colored divider cards between groups. shop.js drives it (setFilter on
   tab click) and receives selections (init's onSelect) to open its own
   PDP overlay — this module owns rendering/layout only, not purchasing.

   Public API: window.floppyBay.init(products, {onSelect}) , .setFilter(type)
   ============================================================ */
window.floppyBay = (function () {
  'use strict';

  let inited = false;
  let onSelect = function () {};
  let filterType = 'all';
  const state = { index: 0 };
  let hoverIndex = null;

  /* ---------- genre color, derived per genre string (no fixed dict —
     scales to any future catalog without code changes) ---------- */
  const GENRE_PALETTE = [0x2b6a4f, 0x5a3d2b, 0x7a1f1f, 0x233a5c, 0x4a4a2b, 0x6b2d5c, 0x3b5c8a, 0x8a5a2b];
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function genreInfo(genre) {
    const key = (genre || 'Beat').split(' / ')[0].trim() || 'Beat';
    const color = GENRE_PALETTE[hashStr(key) % GENRE_PALETTE.length];
    return { genreKey: key.toUpperCase(), genreLabel: key, color };
  }
  function minPrice(p) {
    const prices = (p.tiers || []).map((t) => t.price);
    return prices.length ? Math.min(...prices) : 0;
  }
  function hash(i) { const x = Math.sin(i * 999.13) * 10000; return x - Math.floor(x); }

  /* ---------- three basics ---------- */
  let stageWrap, canvas, renderer, scene, camera;
  const orbit = { theta: 0.12, phi: 1.18, radius: 4.7 };
  function updateCameraFromOrbit() {
    camera.position.set(
      orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      orbit.radius * Math.cos(orbit.phi),
      orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta)
    );
    camera.lookAt(0, 0.62, 0);
  }
  function resize() {
    const w = stageWrap.clientWidth, h = stageWrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
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
  function frostedMat(color) {
    return new THREE.MeshStandardMaterial({
      color: color !== undefined ? color : 0xc9cdd1,
      transparent: true, opacity: 0.4, roughness: 0.35, metalness: 0,
      side: THREE.DoubleSide, depthWrite: false,
    });
  }

  /* ---------- holder ---------- */
  // width scales to the catalog size so a small (or filtered-down) shop
  // still reads as a packed case instead of one disk floating in front of
  // a mostly-empty tray — clamped so it never gets absurdly cramped or wide.
  const TRAY = { width: 1.85, depth: 0.98, wallT: 0.045 };
  function fitTrayWidth(itemCount) {
    TRAY.width = THREE.MathUtils.clamp(0.95 + itemCount * 0.24, 1.15, 1.85);
  }
  const DISK = { w: 0.86, h: 0.95, depth: 0.05 };
  const backWallH = DISK.h * 1.05;
  const frontLipH = DISK.h * 0.22;
  const LID_CLOSED = Math.PI / 2;
  const LID_OPEN = -0.36;
  let holder, lidGroup;
  const lidAnim = { t: 0 };

  function buildHolder() {
    holder = new THREE.Group();
    scene.add(holder);

    {
      const floorGeo = panelGeo(roundedRectShape(TRAY.width, TRAY.depth, 0.05), 0.06);
      floorGeo.rotateX(-Math.PI / 2);
      const floor = new THREE.Mesh(floorGeo, solidMat(0xe9dfc9, 0.5));
      floor.position.y = -0.03;
      holder.add(floor);
    }
    {
      const backGeo = panelGeo(roundedRectShape(TRAY.width, backWallH, 0.04), TRAY.wallT);
      const back = new THREE.Mesh(backGeo, solidMat(0xe9dfc9, 0.5));
      back.position.set(0, backWallH / 2, -TRAY.depth / 2 + TRAY.wallT / 2);
      holder.add(back);
    }
    [-1, 1].forEach((side) => {
      const geo = slopedSideGeo(TRAY.depth, frontLipH, backWallH, TRAY.wallT);
      const wall = new THREE.Mesh(geo, frostedMat(0xcfd3d6));
      wall.position.set(side * (TRAY.width / 2 - TRAY.wallT / 2), 0, 0);
      holder.add(wall);
    });
    {
      const shape = frontLipShape(TRAY.width, frontLipH, 0.05, 0.11);
      const geo = panelGeo(shape, TRAY.wallT);
      const lip = new THREE.Mesh(geo, solidMat(0xe9dfc9, 0.5));
      lip.position.set(0, frontLipH / 2, TRAY.depth / 2 - TRAY.wallT / 2);
      holder.add(lip);
    }
    lidGroup = new THREE.Group();
    lidGroup.position.set(0, backWallH, -TRAY.depth / 2 + TRAY.wallT / 2);
    lidGroup.rotation.x = LID_CLOSED;
    holder.add(lidGroup);
    {
      const lidLen = TRAY.depth * 1.02;
      const lidGeo = panelGeo(roundedRectShape(TRAY.width, lidLen, 0.05), TRAY.wallT);
      lidGeo.translate(0, lidLen / 2, 0);
      const lid = new THREE.Mesh(lidGeo, frostedMat(0xd2d6d8));
      lidGroup.add(lid);
    }
  }

  /* ---------- disks ---------- */
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
  let bodyGeo;

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

    const shutterH = H * 0.16;
    const grad = ctx.createLinearGradient(0, 0, 0, shutterH);
    grad.addColorStop(0, '#e8ecef'); grad.addColorStop(0.5, '#b7bec4'); grad.addColorStop(1, '#8b9298');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, shutterH);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(W * 0.42, shutterH * 0.18, W * 0.4, shutterH * 0.64);

    ctx.fillStyle = '#3a352c';
    ctx.font = '700 24px -apple-system, "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.save();
    ctx.translate(28, shutterH + 42);
    ctx.fillText(entry.genreKey, 0, 0);
    ctx.restore();
    ctx.fillStyle = '#' + entry.color.toString(16).padStart(6, '0');
    ctx.beginPath(); ctx.arc(W - 40, shutterH + 34, 9, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#1c1a16';
    ctx.font = '46px "Kalam", cursive';
    ctx.save();
    ctx.translate(26, shutterH + 118);
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

      holder.add(group);
      diskMeshes.push(body, label);

      disks.push({
        index: entry.index, group, visual, bodyMat,
        inView: true, currentScale: 1, currentEmissive: 0,
        target: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, emissive: 0 },
      });
    });
  }

  /* soft floor spotlight under the active disk — depthTest:false + a high
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
  let pickGlow;

  /* ---------- genre dividers ---------- */
  const DIV = { w: DISK.w * 0.5, h: DISK.h * 1.14, depth: DISK.depth * 0.7 };
  let dividerGeo;
  function makeDividerTexture(genreKey, genreLabel, color) {
    const W = 260, H = 560;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#e7ddc8';
    ctx.fillRect(0, 0, W, H);
    const capH = H * 0.22;
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, W, capH);
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    ctx.font = '700 30px -apple-system, "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(genreLabel.toUpperCase(), W / 2, capH / 2 + 11);
    ctx.textAlign = 'left';
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }
  const dividers = {}; // keyed by genreKey
  function buildDividers() {
    const seen = {};
    items.forEach((entry) => { seen[entry.genreKey] = entry; });
    Object.keys(seen).forEach((key) => {
      const entry = seen[key];
      const group = new THREE.Group();
      const visual = new THREE.Group();
      visual.position.y = DIV.h / 2;
      group.add(visual);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xe7ddc8, map: makeDividerTexture(key, entry.genreLabel, entry.color), roughness: 0.8, metalness: 0, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(dividerGeo, mat);
      visual.add(mesh);
      group.visible = false;
      holder.add(group);
      dividers[key] = { group, visual, currentScale: 1, target: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 } };
    });
  }

  /* ---------- layout / targets ---------- */
  function visibleItems() {
    return items.filter((e) => filterType === 'all' || e.product.type === filterType);
  }
  function clampIndex() {
    const n = visibleItems().length;
    if (state.index < 0) state.index = 0;
    if (state.index > n - 1) state.index = Math.max(0, n - 1);
  }
  function buildLayoutList(vis) {
    if (filterType !== 'all') return vis.map((e) => ({ type: 'disk', entry: e }));
    const list = [];
    let lastKey = null;
    vis.forEach((e) => {
      if (lastKey !== null && e.genreKey !== lastKey) list.push({ type: 'divider', key: e.genreKey });
      list.push({ type: 'disk', entry: e });
      lastKey = e.genreKey;
    });
    return list;
  }

  function computeTargets() {
    const vis = visibleItems();
    clampIndex();
    if (!vis.length) { disks.forEach((d) => { d.inView = false; d.group.visible = false; }); Object.values(dividers).forEach((dv) => { dv.inView = false; dv.group.visible = false; }); return; }

    disks.forEach((d) => {
      const v = vis.find((e) => e.index === d.index);
      d.inView = !!v;
      d.group.visible = d.inView;
    });
    Object.values(dividers).forEach((dv) => { dv.inView = false; dv.group.visible = false; });

    const list = buildLayoutList(vis);
    const activeEntry = vis[state.index];

    // Even row: every disk stays face-on and readable, like folders actually
    // standing organized in labeled slots — not fanned/rotated away with
    // only the active one legible. Slot width adapts to item count so a
    // full "all" row (disks + genre dividers) still fits inside the tray
    // walls, while a short filtered list doesn't stretch out unnaturally.
    const weights = list.map((e) => (e.type === 'disk' ? 1 : 0.5));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const available = TRAY.width * 0.82;
    const unit = Math.min(available / totalWeight, DISK.w * 0.75);
    let x = -(unit * totalWeight) / 2;
    const centers = weights.map((w) => { const c = x + (unit * w) / 2; x += unit * w; return c; });

    list.forEach((e, i) => {
      const cx = centers[i];
      if (e.type === 'disk') {
        const d = disks[e.entry.index];
        const isActive = e.entry.index === activeEntry.index;
        const hovered = hoverIndex === e.entry.index;
        const j = hash(e.entry.index);
        const leanRy = -0.12 + (j - 0.5) * 0.1; // slight shared lean + per-disk jitter — still face-on, never edge-on
        Object.assign(d.target, {
          x: cx,
          y: isActive ? (hovered ? 0.05 : 0.03) : 0,
          z: isActive ? (hovered ? 0.26 : 0.2) : -0.02,
          rx: -0.08, ry: leanRy, rz: (j - 0.5) * 0.04,
          scale: isActive ? (hovered ? 1.1 : 1.06) : (hovered ? 1.04 : 1),
          emissive: isActive ? (hovered ? 1 : 0.4) : (hovered ? 0.6 : 0),
        });
      } else {
        const dv = dividers[e.key];
        dv.inView = true; dv.group.visible = true;
        Object.assign(dv.target, { x: cx, y: 0, z: -0.03, rx: -0.08, ry: -0.1, rz: 0, scale: 1 });
      }
    });
  }

  function selectByIndex(index) {
    const vis = visibleItems();
    const vIdx = vis.findIndex((e) => e.index === index);
    if (vIdx >= 0) state.index = vIdx;
    afterNav();
  }
  function step(delta) { state.index += delta; clampIndex(); afterNav(); }
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
      d.currentEmissive += (tgt.emissive - d.currentEmissive) * f;
      d.bodyMat.emissiveIntensity = d.currentEmissive * 0.55;
    });
    Object.values(dividers).forEach((dv) => {
      if (!dv.inView) return;
      const g = dv.group, tgt = dv.target;
      g.position.x += (tgt.x - g.position.x) * f;
      g.position.y += (tgt.y - g.position.y) * f;
      g.position.z += (tgt.z - g.position.z) * f;
      g.rotation.x += (tgt.rx - g.rotation.x) * f;
      g.rotation.y += (tgt.ry - g.rotation.y) * f;
      g.rotation.z += (tgt.rz - g.rotation.z) * f;
      dv.currentScale += (tgt.scale - dv.currentScale) * f;
      dv.visual.scale.setScalar(dv.currentScale);
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
    const activeIdx = currentActiveIndex();
    if (activeIdx !== null && disks[activeIdx]) {
      const gp = disks[activeIdx].group.position;
      pickGlow.position.x += (gp.x - pickGlow.position.x) * f;
      pickGlow.position.z += (gp.z - pickGlow.position.z) * f;
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

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff3e0, 0.95); key.position.set(2.4, 4, 3.2); scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35); fill.position.set(-3, 2, -1.5); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xe4ecf2, 0.22); rim.position.set(-1, 2.5, -3); scene.add(rim);

    buildHolder();

    bodyGeo = (function () {
      const geo = new THREE.ExtrudeGeometry(diskShape(), { depth: DISK.depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 6 });
      geo.translate(0, 0, -DISK.depth / 2);
      return geo;
    })();
    dividerGeo = panelGeo(roundedRectShape(DIV.w, DIV.h, 0.03), DIV.depth);

    pickGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 1.05),
      new THREE.MeshBasicMaterial({ map: makeGlowTexture(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })
    );
    pickGlow.renderOrder = 10;
    pickGlow.rotation.x = -Math.PI / 2;
    pickGlow.position.y = 0.01;
    holder.add(pickGlow);

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
        Object.keys(dividers).forEach((key) => {
          const entry = items.find((e) => e.genreKey === key);
          const mat = dividers[key].visual.children[0].material;
          mat.map = makeDividerTexture(key, entry.genreLabel, entry.color);
          mat.map.needsUpdate = true;
        });
      }).catch(() => {});
    }
  }

  function init(products, opts) {
    if (inited) return;
    onSelect = (opts && opts.onSelect) || function () {};
    items = products.map((p, i) => Object.assign({ product: p, index: i }, genreInfo(p.genre)));
    fitTrayWidth(items.length);
    // Start on the middle item, not the first — fanning only ever queues
    // items to one side of the active disk, so starting at index 0 leaves
    // the whole other side of the tray looking empty.
    state.index = Math.max(0, Math.floor((items.length - 1) / 2));
    setupThree();
    buildDisks();
    buildDividers();
    boot();
    inited = true;
  }
  function setFilter(type) {
    filterType = type;
    const vis = visibleItems();
    state.index = Math.max(0, Math.floor((vis.length - 1) / 2));
    afterNav();
  }

  return { init, setFilter };
})();
