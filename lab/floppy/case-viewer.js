/* Clear-case floppy viewer for /lab/floppy.
   Selecting a disk in a drawer opens it here: the disk sits in a clear plastic
   case on a white studio sweep. Motion modelled on the reference clip:
     - the lid swings on a left-side hinge (passes edge-on toward the camera)
     - the case tilts toward the pointer
     - drag sideways to flip it and see the back (snaps to front/back)
     - swipe up/down, scroll or arrow keys move to the next/previous disk in the
       drawer: the current case slides out the top, the next comes up from below
   The cabinet keeps its own scene; while the viewer is open the page renders
   this scene instead, so the bin itself is unchanged. */

const W = 10.4, H = 10.8, DEPTH = 1.0, WALL = 0.5, LID_T = 0.16;
const SLIDE = 24;                       // how far a case travels when swapping
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export function createCaseViewer({ THREE, renderer, canvas, makeDisk, insets, onLid, onIndex, onClose }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 400);   // wide-ish lens: the clip's strong perspective on tilt

  /* studio reflections for the plastic: a white room with two soft boxes */
  {
    const pm = new THREE.PMREMGenerator(renderer);
    const room = new THREE.Scene();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(60, 60, 60), new THREE.MeshBasicMaterial({ color: 0xbfc3c8, side: THREE.BackSide }));
    room.add(wall);
    const soft = (w, h, x, y, z, ry, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry; room.add(m); };
    soft(26, 10, -18, 14, 18, 0.8, 0xffffff);   // key box upper-left
    soft(8, 30, 24, 0, 10, -1.1, 0xf2f4f8);    // strip on the right
    soft(40, 4, 0, -22, 0, 0, 0xe8e8e8);       // floor bounce
    scene.environment = pm.fromScene(room, 0.03).texture;
    pm.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdedad0, 1.1));
  const key = new THREE.DirectionalLight(0xfff6ea, 1.6); key.position.set(-14, 20, 26); scene.add(key);
  const rim = new THREE.DirectionalLight(0xeef3ff, 0.5); rim.position.set(18, -6, 12); scene.add(rim);

  /* soft drop shadow, down-right like the clip */
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 30, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.55, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); return t;
  })();

  /* shared case materials */
  const M = {
    shell: new THREE.MeshPhysicalMaterial({ color: 0xf4f7fa, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.07, envMapIntensity: 0.45, clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide, depthWrite: false }),
    rim: new THREE.MeshPhysicalMaterial({ color: 0xcdd5de, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.6, envMapIntensity: 1.4, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    edge: new THREE.LineBasicMaterial({ color: 0x8e979f, transparent: true, opacity: 0.55, depthWrite: false }),
    edgeHi: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }),
    hub: new THREE.MeshStandardMaterial({ color: 0xc7cbd0, metalness: 0.9, roughness: 0.28 }),
    dark: new THREE.MeshBasicMaterial({ color: 0x1a1a1a }),
    shadow: new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.32 }),
  };
  const shared = new Set(Object.values(M));

  function clear(geo, mat, x, y, z, edges = true) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; g.add(m);
    if (edges) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), M.edge); e.renderOrder = 3; g.add(e); }
    g.position.set(x, y, z); return g;
  }
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  /* one case = tray + hinged lid + disk */
  function buildCase(product, index) {
    const root = new THREE.Group();      // slides between cases
    const spin = new THREE.Group();      // tilt + flip
    root.add(spin);
    const body = new THREE.Group();      // shifts right as the lid opens so the pair stays centred
    spin.add(body);

    // tray: back plate, four walls, corner clips and two ribs
    body.add(clear(B(W, H, 0.14), M.shell, 0, 0, -DEPTH / 2));
    body.add(clear(B(W, WALL, DEPTH), M.rim, 0, H / 2 - WALL / 2, 0));
    body.add(clear(B(W, WALL, DEPTH), M.rim, 0, -H / 2 + WALL / 2, 0));
    body.add(clear(B(WALL, H - 2 * WALL, DEPTH), M.rim, W / 2 - WALL / 2, 0, 0));
    body.add(clear(B(WALL, H - 2 * WALL, DEPTH), M.rim, -W / 2 + WALL / 2, 0, 0));
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) body.add(clear(B(0.9, 0.9, 0.5), M.rim, sx * (W / 2 - WALL - 0.45), sy * (H / 2 - WALL - 0.45), -0.12, false));
    body.add(clear(B(W - 2.6, 0.18, 0.3), M.rim, 0, H / 2 - WALL - 0.12, -0.3, false));
    body.add(clear(B(W - 2.6, 0.18, 0.3), M.rim, 0, -H / 2 + WALL + 0.12, -0.3, false));
    // hinge knuckles on the left edge
    for (const y of [-H / 2 + 1.2, 0, H / 2 - 1.2]) {
      const k = clear(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 14), M.rim, -W / 2 - 0.05, y, DEPTH / 2 + 0.05, false);
      body.add(k);
    }

    for (const pts of [[[-W / 2, H / 2, DEPTH / 2], [W / 2, H / 2, DEPTH / 2]], [[W / 2, -H / 2, DEPTH / 2], [W / 2, H / 2, DEPTH / 2]]]) {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(q => new THREE.Vector3(...q))), M.edgeHi); l.renderOrder = 4; body.add(l);
    }
    // the disk itself, with a steel hub on the back so the flip reads
    const disk = makeDisk(product, index);
    disk.traverse(o => { o.userData.fromDisk = true; });   // geometry/baked maps shared with the bin: never dispose
    disk.position.set(0, 0, 0.02);
    const hub = new THREE.Mesh(new THREE.CircleGeometry(1.25, 40), M.hub); hub.rotation.y = Math.PI; hub.position.set(0, -0.5, -0.17); disk.add(hub);
    const spindle = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), M.dark); spindle.rotation.y = Math.PI; spindle.position.set(0, -0.5, -0.18); disk.add(spindle);
    const drive = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.5), M.dark); drive.rotation.y = Math.PI; drive.position.set(-0.75, -0.25, -0.18); disk.add(drive);
    body.add(disk);

    // lid on a pivot at the hinge; plate plus a shallow lip
    const lidPivot = new THREE.Group(); lidPivot.position.set(-W / 2, 0, DEPTH / 2 + 0.08); body.add(lidPivot);
    const lid = new THREE.Group(); lid.position.set(W / 2, 0, 0); lidPivot.add(lid);
    lid.add(clear(B(W, H, LID_T), M.shell, 0, 0, 0));
    lid.add(clear(B(W - 0.2, 0.22, 0.32), M.rim, 0, H / 2 - 0.11, -0.12, false));
    lid.add(clear(B(W - 0.2, 0.22, 0.32), M.rim, 0, -H / 2 + 0.11, -0.12, false));
    lid.add(clear(B(0.22, H - 0.4, 0.32), M.rim, W / 2 - 0.11, 0, -0.12, false));
    // bright specular edge along the lid's free side, the strongest highlight in the clip
    const hiGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(W / 2, -H / 2, LID_T / 2), new THREE.Vector3(W / 2, H / 2, LID_T / 2)]);
    const hi = new THREE.Line(hiGeo, M.edgeHi); hi.renderOrder = 4; lid.add(hi);

    // soft shadow card behind the case
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.shadow);
    shadow.position.set(0.9, -1.3, -3.2); shadow.scale.set(W * 1.55, H * 1.45, 1); root.add(shadow);

    scene.add(root);
    return { root, spin, body, lidPivot, disk, shadow, product, lid: 0, lidTarget: 0 };
  }

  function disposeCase(c) {
    scene.remove(c.root);
    c.root.traverse(o => {
      if (o.geometry && !o.userData.fromDisk) o.geometry.dispose();
      for (const m of [].concat(o.material || [])) {
        if (!m || shared.has(m)) continue;
        if (m.map && m.map.isCanvasTexture) m.map.dispose();   // handwritten label: unique per disk
        if (o.userData.fromDisk) m.dispose();                    // per-disk clones; their baked maps stay
      }
    });
  }

  /* ---------------- state ---------------- */
  const st = {
    active: false, list: [], index: 0, cur: null, leaving: null,
    slide: null,                 // { t, dir }
    tilt: new THREE.Vector2(), tiltT: new THREE.Vector2(), clock: 0, lastMove: -1e9,
    vw: 1, vh: 1,
    yaw: 0, yawT: 0, drag: null, wheelLock: 0,
  };

  function setIndex(i, dir) {
    const n = st.list.length; if (!n) return;
    i = ((i % n) + n) % n;
    if (st.cur && dir) {
      if (st.leaving) disposeCase(st.leaving);
      st.leaving = st.cur; st.slide = { t: 0, dir };
    } else if (st.cur) disposeCase(st.cur);
    st.index = i;
    st.cur = buildCase(st.list[i], i);
    st.cur.root.position.y = dir ? -dir * SLIDE : 0;
    st.yaw = st.yawT = 0;
    onLid && onLid(false, st.list[i]);
    onIndex && onIndex(i, st.list[i]);
  }

  function setLid(open) {
    if (!st.cur || st.slide) return;
    st.cur.lidTarget = open ? 1 : 0;
    onLid && onLid(!!open, st.list[st.index]);
  }

  /* ---------------- input ---------------- */
  function local(e) { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)]; }
  function down(e) {
    if (!st.active) return;
    st.drag = { x: e.clientX, y: e.clientY, yaw0: st.yawT, moved: false, axis: null };
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!st.active) return;
    const [nx, ny] = local(e);
    st.tiltT.set(clamp(ny, -1, 1) * 0.22, clamp(nx, -1, 1) * 0.32); st.lastMove = st.clock;
    const d = st.drag; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.axis && Math.hypot(dx, dy) > 8) d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (d.axis) d.moved = true;
    if (d.axis === 'x') st.yawT = d.yaw0 + dx * 0.012;
  }
  function up(e) {
    if (!st.active) return;
    const d = st.drag; st.drag = null; if (!d) return;
    const dy = e.clientY - d.y;
    if (d.axis === 'x') { st.yawT = Math.round(st.yawT / Math.PI) * Math.PI; return; }
    if (d.axis === 'y' && Math.abs(dy) > 40) { go(dy < 0 ? 1 : -1); return; }
    if (!d.moved) setLid(!(st.cur && st.cur.lidTarget));
  }
  function wheel(e) {
    if (!st.active) return;
    e.preventDefault();
    const now = performance.now(); if (now < st.wheelLock || Math.abs(e.deltaY) < 8) return;
    st.wheelLock = now + 650; go(e.deltaY > 0 ? 1 : -1);
  }
  function keys(e) {
    if (!st.active) return;
    if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); }
    else if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowLeft') st.yawT = (Math.round(st.yawT / Math.PI) - 1) * Math.PI;
    else if (e.key === 'ArrowRight') st.yawT = (Math.round(st.yawT / Math.PI) + 1) * Math.PI;
    else if (e.key === ' ' || e.key === 'Enter') { if (e.target === document.body || e.target === canvas) { e.preventDefault(); setLid(!(st.cur && st.cur.lidTarget)); } }
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { st.drag = null; });
  canvas.addEventListener('wheel', wheel, { passive: false });
  addEventListener('keydown', keys, true);

  function go(dir) { if (st.slide || st.list.length < 2) return; setIndex(st.index + dir, dir); }

  /* ---------------- api ---------------- */
  function open(list, index) {
    st.list = list.slice(); st.active = true; st.tilt.set(0, 0); st.tiltT.set(0, 0);
    if (st.cur) disposeCase(st.cur); if (st.leaving) disposeCase(st.leaving); st.cur = st.leaving = null; st.slide = null;
    setIndex(index, 0);
  }
  function close() {
    if (!st.active) return;
    st.active = false; st.drag = null;
    if (st.cur) disposeCase(st.cur); if (st.leaving) disposeCase(st.leaving); st.cur = st.leaving = null; st.slide = null;
    onLid && onLid(false, null);
    onClose && onClose();
  }

  function frameCase(c, dt) {
    c.lid += (c.lidTarget - c.lid) * Math.min(1, dt * 5.5);
    const u = easeInOut(clamp(c.lid, 0, 1));
    c.lidPivot.rotation.y = -Math.PI * u;              // swings toward the camera, lies flat to the left
    c.body.position.x = (W / 2) * u;                   // keep tray + lid centred
    c.disk.position.z = 0.02 + 0.25 * u;               // disk lifts a touch when the case is open
    c.shadow.scale.x = W * (1.55 + 1.0 * u);
  }

  function update(dt) {
    if (!st.active) return;
    st.clock += dt;
    // idle: drift gently around a resting 3/4 angle; pointer movement takes over
    const idle = clamp((st.clock - st.lastMove - 2.5) / 1.5, 0, 1);
    const restX = -0.16 + Math.sin(st.clock * 0.6) * 0.05 * idle, restY = 0.36 + Math.sin(st.clock * 0.45) * 0.12 * idle;
    const gx = restX * (1 - 0.6 * (1 - idle)) + st.tiltT.x * (1 - idle), gy = restY * (1 - 0.6 * (1 - idle)) + st.tiltT.y * (1 - idle);
    st.tilt.x += (gx - st.tilt.x) * Math.min(1, dt * 6); st.tilt.y += (gy - st.tilt.y) * Math.min(1, dt * 6);
    st.yaw += (st.yawT - st.yaw) * Math.min(1, dt * 8);
    for (const c of [st.cur, st.leaving]) if (c) {
      frameCase(c, dt);
      c.spin.rotation.set(st.tilt.x, st.yaw + st.tilt.y, 0);
    }
    if (st.slide) {
      st.slide.t = Math.min(1, st.slide.t + dt / 0.6);
      const e = easeInOut(st.slide.t), dir = st.slide.dir;
      if (st.leaving) st.leaving.root.position.y = dir * SLIDE * e;
      st.cur.root.position.y = -dir * SLIDE * (1 - e);
      if (st.slide.t >= 1) { if (st.leaving) disposeCase(st.leaving); st.leaving = null; st.slide = null; }
    }
    // frame the case inside the free area between the top bar and the dock: size it
    // to that area, then shift the projection so it is centred there (pixel-exact)
    const open = st.cur ? easeInOut(clamp(st.cur.lid, 0, 1)) : 0;
    const ins = insets ? insets() : { top: 0, bottom: 0 };
    const vh = st.vh, vw = st.vw, freePx = Math.max(120, vh - ins.top - ins.bottom - 24);
    const t = Math.tan((camera.fov * Math.PI) / 360);
    const fitH = (H * 1.42) / 2 / (t * (freePx / vh));                            // tilted case (lid open, in perspective) fits in ~70% of the free height
    const fitW = ((W + 1.6) * (1 + open)) / 2 / (t * camera.aspect * 0.90);       // width incl. the open lid
    const swing = Math.sin(Math.PI * open);                                     // lid edge-on toward the camera mid-swing
    const z = Math.max(fitH, fitW) * (1 + 0.28 * swing);
    camera.position.set(0, 0.4, z); camera.lookAt(0, 0, 0);
    const dy = Math.round((ins.bottom - ins.top) / 2), v = camera.view;
    if (dy === 0) { if (v && v.enabled) camera.clearViewOffset(); }
    else if (!v || !v.enabled || v.offsetY !== dy || v.fullWidth !== vw || v.fullHeight !== vh) camera.setViewOffset(vw, vh, 0, dy, vw, vh);
  }

  function resize(w, h) { st.vw = w; st.vh = h; camera.aspect = w / h; camera.updateProjectionMatrix(); }

  return {
    scene, camera, open, close, update, resize, go, setLid,
    get active() { return st.active; },
    get index() { return st.index; },
    get lidOpen() { return !!(st.cur && st.cur.lidTarget); },
    flip(dir = 1) { st.yawT = (Math.round(st.yawT / Math.PI) + dir) * Math.PI; },
    _state: st,
  };
}
