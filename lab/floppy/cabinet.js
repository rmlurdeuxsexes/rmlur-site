/* /lab/floppy — beige media-drawer cabinet (2 rows x 3 cols), procedural Three.js.
   Units ~ cm. Layout/proportions follow the reference photos: cream ABS lid, six
   drawers each with a clear-window label, lock plate, finger slot, red steel
   slides, grey dividers inside, white diamond key. Content comes from
   data/cabinet.config.json + the catalog (see cabinet-data.js). */
import { loadProducts, assignDrawers, checkPassword } from './cabinet-data.js';
import { createCaseViewer } from './case-viewer.js';

const THREE = window.THREE;
const $ = id => document.getElementById(id);

/* ---------------- procedural textures ---------------- */
function canvasTex(w, h, draw, srgb = true, flipY = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.flipY = flipY;
  return t;
}
function noise(ctx, w, h, amt, base) {
  const id = ctx.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amt;
    d[i] = Math.max(0, Math.min(255, d[i] + n)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.9));
  }
  ctx.putImageData(id, 0, 0);
}
// cream ABS: slight yellowing, fine grain, dust darkening toward edges, a few scuffs
function absTexture(seed = 0) {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#e2dccb'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75);
    g.addColorStop(0, 'rgba(255,250,230,0.18)'); g.addColorStop(1, 'rgba(120,100,60,0.22)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 14);
    ctx.globalAlpha = 0.08; ctx.strokeStyle = '#5a4a2a';
    for (let i = 0; i < 14; i++) { ctx.beginPath(); const x = (Math.sin(i * 12.9 + seed) * 0.5 + 0.5) * w, y = (Math.sin(i * 7.3 + seed * 3) * 0.5 + 0.5) * h; ctx.moveTo(x, y); ctx.lineTo(x + 20 + (i * 13) % 50, y + ((i * 7) % 9) - 4); ctx.stroke(); }
    ctx.globalAlpha = 1;
  });
}
function bumpTexture() { return canvasTex(256, 256, (ctx, w, h) => { ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h); noise(ctx, w, h, 60); }, false); }

function paperTexture(lines, opts = {}) {
  const { y0 = 50, flipY = true, w = 512, h = 180, font = '"Nothing You Could Do", "Grape Nuts", cursive', ink = '#243044', size = 38, ruled = false } = opts;
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = opts.paper || '#efeadb'; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 16);
    if (ruled) { ctx.strokeStyle = 'rgba(70,130,210,.55)'; ctx.lineWidth = 1.2; for (let y = 52; y < h; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } }
    ctx.fillStyle = ink; ctx.font = `${size}px ${font}`; ctx.textBaseline = 'alphabetic';
    lines.forEach((t, i) => ctx.fillText(t, 18 + (i % 2) * 2, y0 + i * 36 + (i % 2 ? 1 : 0), w - 36));
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,.10)'); g.addColorStop(.15, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, true, flipY);
}

/* drawer label: a strip of clear tape over the label window, written on in
   Sharpie. The tape is frosted and slightly glossy with cut ends; the ink has a
   little marker texture. Drawn at 1024px so it stays crisp when zoomed. */
function tapeTexture(text, seed = 1) {
  const W = 1024, H = 288, rnd = (n => () => (n = (n * 16807) % 2147483647) / 2147483647)(Math.floor(seed * 9973) + 7);
  return canvasTex(W, H, (ctx) => {
    ctx.clearRect(0, 0, W, H);
    // strip outline with lightly serrated cut ends (tape torn off the dispenser)
    const top = 34, bot = H - 34, l = 22, r = W - 22;
    const path = new Path2D(); path.moveTo(l, top); path.lineTo(r, top);
    for (let y = top, i = 0; y < bot; y += 9, i++) path.lineTo(r - (i % 2 ? 7 : 0) - rnd() * 3, Math.min(bot, y + 9));
    path.lineTo(l, bot);
    for (let y = bot, i = 0; y > top; y -= 9, i++) path.lineTo(l + (i % 2 ? 7 : 0) + rnd() * 3, Math.max(top, y - 9));
    path.closePath();
    // frosted film
    ctx.fillStyle = 'rgba(250,249,243,0.50)'; ctx.fill(path);
    ctx.save(); ctx.clip(path);
    const sheen = ctx.createLinearGradient(0, top, 0, bot);
    sheen.addColorStop(0, 'rgba(255,255,255,0.55)'); sheen.addColorStop(0.18, 'rgba(255,255,255,0.08)');
    sheen.addColorStop(0.8, 'rgba(255,255,255,0.02)'); sheen.addColorStop(1, 'rgba(255,255,255,0.30)');
    ctx.fillStyle = sheen; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) { ctx.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.08})`; ctx.fillRect(rnd() * W, top + rnd() * (bot - top), 1 + rnd() * 2, 1); }
    // Sharpie: fit to the strip, slight baseline drift, two-pass ink for marker bleed
    const label = String(text).toUpperCase();
    let size = 132; ctx.font = `${size}px "Permanent Marker", "Marker Felt", cursive`;
    while (ctx.measureText(label).width > (r - l) * 0.84 && size > 48) { size -= 4; ctx.font = `${size}px "Permanent Marker", "Marker Felt", cursive`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.translate(W / 2, (top + bot) / 2 + 6); ctx.rotate((rnd() - 0.5) * 0.035);
    ctx.fillStyle = 'rgba(14,14,16,0.22)'; ctx.fillText(label, 1.5, 1.5);
    ctx.fillStyle = '#121214'; ctx.fillText(label, 0, 0);
    ctx.restore();
    // marker grain: knock tiny flecks out of the ink so it reads as felt tip, not vector type
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(0,0,0,${0.10 + rnd() * 0.25})`; ctx.fillRect(rnd() * W, rnd() * H, 1.2, 1.2); }
    ctx.restore();
    // thin edge highlight on the film
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(l + 8, top + 1); ctx.lineTo(r - 8, top + 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.beginPath(); ctx.moveTo(l + 8, bot - 1); ctx.lineTo(r - 8, bot - 1); ctx.stroke();
  }, true, true);   // THREE.PlaneGeometry UVs run bottom-up, unlike the glTF label quads
}
function tapeMesh(text, idx, z) {
  const tex = tapeTexture(text, idx + 1); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(13.9, 13.9 * 288 / 1024),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.02, roughness: 0.32, metalness: 0, depthWrite: false }));
  // tape is torn by hand: a touch off-level, never the same twice
  m.position.set(-4.0 + ((idx * 37) % 5 - 2) * 0.06, 4.7 + ((idx * 53) % 3 - 1) * 0.05, z);
  m.rotation.z = (((idx * 29) % 7) - 3) * 0.006;
  m.renderOrder = 5; m.userData.tape = true;
  return m;
}

/* ---------------- materials ---------------- */
const abs = absTexture(1), absBump = bumpTexture();
const M = {
  abs: new THREE.MeshStandardMaterial({ map: abs, bumpMap: absBump, bumpScale: 0.08, roughness: 0.62, metalness: 0 }),
  absDark: new THREE.MeshStandardMaterial({ color: 0x8d8570, roughness: 0.8 }),
  inner: new THREE.MeshStandardMaterial({ color: 0xc9c0a8, roughness: 0.9 }),
  hole: new THREE.MeshBasicMaterial({ color: 0x14110c }),
  slot: new THREE.MeshStandardMaterial({ color: 0x7a7361, roughness: 1 }),
  red: new THREE.MeshStandardMaterial({ color: 0xb02a2e, roughness: 0.35, metalness: 0.35 }),
  clear: new THREE.MeshPhysicalMaterial({ color: 0xdfe6f2, roughness: 0.12, transmission: 0.85, thickness: 0.3, ior: 1.5, transparent: true, opacity: 0.55 }),
  key: new THREE.MeshStandardMaterial({ color: 0xf3f1ea, roughness: 0.45 }),
  divider: new THREE.MeshStandardMaterial({ color: 0x59595c, roughness: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xbfc3c8, roughness: 0.3, metalness: 0.9 }),
};

/* ---------------- geometry helpers ---------------- */
function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function bevelBox(w, h, d, r = 0.4, bevel = 0.18) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w, h, r), { depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 22, uv.getY(i) / 22); // extruded UVs are in cm
  return g;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; }

/* ---------------- dimensions ---------------- */
const COLS = 3, ROWS = 2, CELL_W = 22, CELL_H = 18, DEPTH = 36;
const CAB_W = COLS * CELL_W + 2, CAB_H = ROWS * CELL_H + 2;
const TRAVEL = 26;
const FACE_W = CELL_W - 0.8, FACE_H = CELL_H - 0.8, FACE_D = 3;
// disks in an open drawer: one row standing on the bin floor, leaning back a
// little so the front label faces the camera; flipped disks fall forward onto
// a pile. Sized so a full row (max) still clears the bin's back wall.
const STACK = { z0: -FACE_D / 2 - 9.6, gap: 0.7, floor: -6.2, lean: -0.5, flat: 1.25, max: 18 };

/* ---------------- Blender kit (assets/cabinet/cabinet.glb) ----------------
   Built by scripts/blender/build_cabinet.py. If it fails to load the procedural
   cabinet below is used instead, so the page never breaks. */
const KIT_TINT = [0.95, 1.0, 1.12];   // cool trim: the bake is warm, the reference plastic is nearly neutral
async function loadKit() {
  if (!THREE.GLTFLoader) return null;
  try {
    const gltf = await new Promise((res, rej) => new THREE.GLTFLoader().load('/assets/cabinet/cabinet.glb', res, undefined, rej));
    const by = n => gltf.scene.getObjectByName(n);
    const kit = { cabinet: by('Cabinet'), drawer: by('Drawer'), window: by('Drawer_Window'), label: by('Drawer_Label'), disk: by('Disk'), diskLabel: by('Disk_Label'), divider: by('Divider'), key: by('Key') };
    if (Object.values(kit).some(v => !v)) throw new Error('kit is missing objects');
    gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) m[k].anisotropy = 8; } });
    // colour-balance trim on the baked materials (keeps the bake neutral; no rebake needed to tweak)
    const baked = []; gltf.scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.map && !baked.includes(m)) baked.push(m); });
    window.__tint = c => baked.forEach(m => m.color.setRGB(c[0], c[1], c[2]));
    window.__tint(KIT_TINT);
    return kit;
  } catch (e) { console.warn('[cabinet] using procedural fallback:', e.message || e); return null; }
}

const kit = await loadKit();

// canvas labels are drawn once; draw them only after the handwriting fonts load
// (otherwise they silently fall back to a system serif)
async function fontsReady() {
  if (!document.fonts) return;
  const want = ['72px "Permanent Marker"', '38px "Nothing You Could Do"'];
  try { await Promise.race([Promise.all(want.map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 4000))]); } catch {}
}
await fontsReady();

/* ---------------- scene ---------------- */
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.55;   // calibrated against the reference photos (see PROGRESS.md)
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff);
const camera = new THREE.PerspectiveCamera(28, 1, 1, 600);
{ // soft studio reflections for the metal parts (disk shutters, slide rails)
  const pm = new THREE.PMREMGenerator(renderer), room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(80, 80, 80), new THREE.MeshBasicMaterial({ color: 0x9ea2a8, side: THREE.BackSide })));
  const soft = (w, h, x, y, z, ry, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry; room.add(m); };
  soft(40, 14, -24, 22, 26, 0.7, 0xffffff); soft(10, 40, 32, 4, 12, -1.1, 0xe9ecf0); soft(60, 6, 0, -30, 0, 0, 0xdcdcdc);
  scene.environment = pm.fromScene(room, 0.04).texture; scene.environmentIntensity = 0.55; pm.dispose();
}

scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d3c4, 1.0));
const key = new THREE.DirectionalLight(0xfff3e0, 2.0); key.position.set(-60, 110, 90); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -90, right: 90, top: 90, bottom: -60, near: 10, far: 400 }); key.shadow.bias = -0.0004; key.shadow.radius = 5;
scene.add(key);
const fill = new THREE.DirectionalLight(0xe6eeff, 0.35); fill.position.set(80, 30, 60); scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), new THREE.ShadowMaterial({ opacity: 0.16 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

/* cabinet shell */
const cab = new THREE.Group(); scene.add(cab);
function buildProceduralShell() {
cab.add(box(CAB_W + 1.2, 1.4, DEPTH + 1.5, M.abs, 0, CAB_H + 0.7, 0.4));          // lid, slight front overhang
  cab.add(box(CAB_W, 1.2, DEPTH, M.abs, 0, 0.6, 0));                                   // base
  cab.add(box(1.2, CAB_H, DEPTH, M.abs, -CAB_W / 2 + 0.6, CAB_H / 2, 0));              // sides
  cab.add(box(1.2, CAB_H, DEPTH, M.abs, CAB_W / 2 - 0.6, CAB_H / 2, 0));
  cab.add(box(CAB_W, CAB_H, 1, M.inner, 0, CAB_H / 2, -DEPTH / 2 + 0.5));              // back
  cab.add(box(CAB_W, 1, DEPTH, M.abs, 0, 1 + CELL_H, 0));                              // mid shelf
  for (const x of [-CELL_W / 2, CELL_W / 2]) cab.add(box(0.8, CAB_H, DEPTH - 2, M.abs, x, CAB_H / 2, -1));
  // fixed red slide rails inside each cell
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cx = (c - 1) * CELL_W, cy = 1.2 + r * (CELL_H + 0.0) + 2;
    for (const s of [-1, 1]) cab.add(box(0.35, 0.35, DEPTH - 6, M.steel, cx + s * 10.0, cy + 6.6, -2));
  }
  
  
}
if (kit) cab.add(kit.cabinet.clone()); else buildProceduralShell();

/* ---------------- drawers ---------------- */
const drawerObjs = [];   // {group, face, cfg, open, target, cx, cy, items:[disk groups], lock:Vector3}
function buildFace(cfg) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(bevelBox(FACE_W, FACE_H, FACE_D, 0.9, 0.22), M.abs); base.castShadow = base.receiveShadow = true; g.add(base);
  const front = FACE_D / 2 + 0.05;
  // label window: frame, paper, clear cover
  const wx = -4.0, wy = 4.7;
  g.add(box(13.6, 4.8, 0.5, M.absDark, wx, wy, front - 0.1));
  const label = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 3.9), new THREE.MeshStandardMaterial({ map: paperTexture([], { w: 512, h: 144 }), roughness: 0.9 }));
  label.position.set(wx, wy, front + 0.18); g.add(label);
  const clear = box(13.0, 4.2, 0.5, M.clear, wx, wy, front + 0.42); clear.castShadow = false; g.add(clear);
  g.add(box(13.2, 0.3, 0.7, M.steel, wx, wy + 2.15, front + 0.45)); // retainer lip
  g.add(tapeMesh(cfg.label, cfg._idx || 0, front + 0.72));
  // lock plate + keyhole
  const lx = 7.4, ly = 4.7;
  g.add(box(4.6, 4.6, 0.6, M.abs, lx, ly, front + 0.1));
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), M.hole); hole.position.set(lx, ly, front + 0.43); g.add(hole);
  // finger slot
  g.add(box(14, 4.4, 0.9, M.slot, 0, -5.0, front - 0.35));
  g.add(box(14.6, 0.5, 0.5, M.abs, 0, -2.6, front + 0.05));
  // molded mark
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.7), new THREE.MeshBasicMaterial({ map: canvasTex(128, 28, (ctx, w, h) => { ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0, 0, w, h); ctx.strokeStyle = 'rgba(80,70,50,.35)'; ctx.strokeRect(1, 1, w - 2, h - 2); ctx.fillStyle = 'rgba(80,70,50,.45)'; ctx.font = 'italic 16px serif'; ctx.fillText('rmlur', 8, 20); }), transparent: true }));
  mark.position.set(5.6, -0.6, front + 0.02); g.add(mark);
  g.userData.lock = new THREE.Vector3(lx, ly, front + 0.5);
  return g;
}
function kitFace(cfg) {
  const g = new THREE.Group();
  g.add(kit.drawer.clone());
  const lab = kit.label.clone();
  lab.material = new THREE.MeshStandardMaterial({ map: paperTexture([], { w: 512, h: 144, flipY: false }), roughness: 0.9 });
  g.add(lab);
  const win = kit.window.clone(); win.material = M.clear; win.castShadow = false; g.add(win);
  g.add(tapeMesh(cfg.label, cfg._idx || 0, FACE_D / 2 + 0.33));   // window front sits at ~+1.80
  g.userData.lock = new THREE.Vector3(7.4, 4.7, FACE_D / 2 + 0.5);
  return g;
}
function buildBody() {
  const g = new THREE.Group(), L = 28, W = 19.6, H = 13;
  g.add(box(W, 0.6, L, M.inner, 0, -H / 2, -L / 2 - FACE_D / 2));
  for (const s of [-1, 1]) {
    g.add(box(0.6, H, L, M.inner, s * W / 2, 0, -L / 2 - FACE_D / 2));
    g.add(box(0.5, 0.5, L + 3, M.red, s * (W / 2 + 0.55), H / 2 - 0.4, -L / 2 - FACE_D / 2 + 1.5));   // red coated slide
    g.add(box(0.5, 0.5, L + 3, M.red, s * (W / 2 + 0.55), H / 2 - 1.2, -L / 2 - FACE_D / 2 + 1.5));
  }
  g.add(box(W, H, 0.6, M.inner, 0, 0, -L - FACE_D / 2));
  // molded ribs on the floor
  for (let i = 0; i < 7; i++) g.add(box(0.3, 0.3, L - 4, M.absDark, -9 + i * 3, -H / 2 + 0.45, -L / 2 - FACE_D / 2));
  return g;
}

/* disks */
const SHELLS = [0x2b3b8f, 0x6b2d3a, 0x2d6b4f, 0x5b5b5f, 0x8a6a2a, 0x3b5f8a];
function buildKitDisk(p, i) {
  const g = new THREE.Group();
  const body = kit.disk.clone();
  // multi-material meshes load as a Group of meshes: tint only the baked-texture shell, keep the steel shutter
  body.traverse(o => { if (o.isMesh && o.material && o.material.map) { o.material = o.material.clone(); o.material.color = new THREE.Color(SHELLS[i % SHELLS.length]).multiplyScalar(1.7); } });
  g.add(body);
  const lines = [String(p.title || '').toLowerCase(), p.genre || '', [p.bpm ? p.bpm + ' bpm' : '', p.key || ''].filter(Boolean).join(' · ')];
  const lab = kit.diskLabel.clone(); lab.material = new THREE.MeshStandardMaterial({ map: paperTexture(lines, { w: 360, h: 230, size: 34, ruled: true, flipY: false }), roughness: 0.9 });
  g.add(lab);
  g.userData.product = p; g.traverse(o => { o.userData.diskRoot = g; });
  return g;
}
function buildDisk(p, i) {
  if (kit) return buildKitDisk(p, i);
  const g = new THREE.Group();
  const shellColor = SHELLS[i % SHELLS.length];
  const shell = new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.55 });
  g.add(box(9, 9.4, 0.32, shell));
  g.add(box(4.8, 3.2, 0.36, M.steel, 0.4, 3.0, 0));                 // shutter
  const lines = [String(p.title || '').toLowerCase(), p.genre || '', [p.bpm ? p.bpm + ' bpm' : '', p.key || ''].filter(Boolean).join(' · ')];
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.6), new THREE.MeshStandardMaterial({ map: paperTexture(lines, { w: 360, h: 230, size: 34, ruled: true }), roughness: 0.9 }));
  lab.position.set(0, -2.3, 0.18); g.add(lab);
  g.userData.product = p; g.traverse(o => { o.userData.diskRoot = g; });
  return g;
}

const config = await (await fetch('/data/cabinet.config.json')).json();
const products = await loadProducts();
const drawers = assignDrawers(products, config);

drawers.forEach((cfg, idx) => {
  cfg._idx = idx;
  const r = Math.floor(idx / COLS), c = idx % COLS;
  const cx = (c - 1) * CELL_W, cy = 1.2 + (ROWS - 1 - r) * (CELL_H + 0) + CELL_H / 2 - 0.4;
  const group = new THREE.Group(); group.position.set(cx, cy, DEPTH / 2 - FACE_D / 2);
  const face = kit ? kitFace(cfg) : buildFace(cfg); group.add(face); if (!kit) group.add(buildBody());
  const disks = cfg.items.slice(0, STACK.max).map((p, i) => {
    const d = buildDisk(p, i);
    const pivot = new THREE.Group();                       // hinge along the disk's bottom edge
    pivot.position.set(0, STACK.floor, STACK.z0 - i * STACK.gap);
    d.position.set(0, 4.7, 0); pivot.add(d); group.add(pivot);
    Object.assign(d.userData, { pivot, index: i, angle: STACK.lean, va: 0, ta: STACK.lean, y: 0, ty: 0, holdUntil: 0 });
    pivot.rotation.x = STACK.lean;
    return d;
  });
  if (cfg.locked) { // dark divider tabs like the reference's grey plastic dividers, behind the disks
    for (let i = 0; i < 3; i++) { const dv = kit ? kit.divider.clone() : box(18, 8, 0.5, M.divider, 0, 0, 0); dv.position.set(0, -1, STACK.z0 - (disks.length + 1.5 + i * 2.2) * STACK.gap); group.add(dv); }
  }
  cab.add(group);
  drawerObjs.push({ group, face, cfg, cx, cy, open: 0, target: 0, disks, cur: 0, hover: 0, row: r, locked: !!cfg.locked, unlocked: !cfg.locked });
});

/* key */
const keyGroup = new THREE.Group();
if (kit) { keyGroup.add(kit.key.clone()); keyGroup.visible = false; scene.add(keyGroup); } else {
  const s = new THREE.Shape(); s.moveTo(0, 2.6); s.lineTo(2.6, 0); s.lineTo(0, -2.6); s.lineTo(-2.6, 0); s.lineTo(0, 2.6);
  const hole = new THREE.Path(); hole.absarc(0, -1.2, 0.5, 0, Math.PI * 2, true); s.holes.push(hole);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.15, bevelSegments: 2 }), M.key);
  body.castShadow = true; keyGroup.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.6, 14), M.key); stem.rotation.x = Math.PI / 2; stem.position.set(0, 1.0, -1.4); keyGroup.add(stem);
  keyGroup.visible = false; scene.add(keyGroup);
}

/* ---------------- camera ---------------- */
const VIEWS = {
  closed: { pos: new THREE.Vector3(0, 30, 132), look: new THREE.Vector3(0, 18, 0) },
  top: { pos: new THREE.Vector3(0, 132, 104), look: new THREE.Vector3(0, 16, 26) },
  bottom: { pos: new THREE.Vector3(0, 112, 98), look: new THREE.Vector3(0, 4, 26) },
};
// open drawer: the camera comes in close over the bin, looking down at the front
// disk so its label is readable, and follows it back as you flip through
function binView(d) {
  const gz = DEPTH / 2 - FACE_D / 2 + TRAVEL;
  const f = new THREE.Vector3(d.cx, d.cy + STACK.floor + 4.4, gz + STACK.z0 - d.cur * STACK.gap + 0.8);
  const ins = insets(), freeFrac = Math.max(0.25, (innerHeight - ins.top - ins.bottom - 24) / innerHeight);
  const t = Math.tan((camera.fov * Math.PI) / 360);
  // the front disk (9.4 tall, leaning back, seen ~65deg from above) takes ~58% of the free height; never wider than 70% of the screen
  // visible height at distance d is 2*d*t, so solve 8.2 = 0.58 * freeFrac * 2*d*t (and the same for width)
  const dist = Math.max(8.2 / (2 * t * 0.58 * freeFrac), 9.4 / (2 * t * camera.aspect * 0.70));
  const dir = new THREE.Vector3(0, 32, 15).normalize();   // steep enough to look over the drawer front at the pile and the front disk
  return { pos: f.clone().addScaledVector(dir, dist), look: f };
}
// shift the projection so the scene is centred in the space between the top bar
// and the dock (pixel-exact; raycasting uses the same projection)
function frameOffset(cam) {
  const { top, bottom } = insets(), w = innerWidth, h = innerHeight, dy = Math.round((bottom - top) / 2);
  const cur = cam.view, on = cur && cur.enabled;
  if (dy === 0) { if (on) cam.clearViewOffset(); return; }
  if (!on || cur.offsetY !== dy || cur.fullWidth !== w || cur.fullHeight !== h) cam.setViewOffset(w, h, 0, dy, w, h);
}
let viewer = null;   // clear-case viewer, created once the drawers exist
let camPos = VIEWS.closed.pos.clone(), camLook = VIEWS.closed.look.clone(), view = 'closed';
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w / h < 1 ? 28 / Math.min(1, (w / h) * 1.1) : 28; camera.updateProjectionMatrix();
  if (viewer) viewer.resize(w, h);
}
addEventListener('resize', resize); resize();

/* ---------------- interaction ---------------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let openDrawer = null, hoverDrawer = null, hoverDisk = null, busy = false, clock = 0;
const ctxEl = $('ctx'), dock = $('dock');
const isTyping = t => t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');

// screen space the 3D view must leave free: the top bar and the bottom dock
function insets() {
  const top = $('topbar').getBoundingClientRect().bottom;
  const bottom = dock.hidden ? 0 : Math.max(0, innerHeight - dock.getBoundingClientRect().top);
  return { top, bottom };
}

function setPtr(e) { const r = canvas.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
function pick(e) {
  setPtr(e); ray.setFromCamera(ptr, camera);
  if (openDrawer && openDrawer.disks.length) {
    const hit = ray.intersectObjects(openDrawer.disks, true)[0];
    if (hit) return { type: 'disk', disk: hit.object.userData.diskRoot };
  }
  const hit = ray.intersectObjects(drawerObjs.map(d => d.face), true)[0];
  if (hit) { let o = hit.object; while (o && !drawerObjs.some(d => d.face === o)) o = o.parent; return { type: 'drawer', drawer: drawerObjs.find(d => d.face === o) }; }
  return null;
}
canvas.addEventListener('pointermove', e => {
  if (viewer.active) return;
  const p = pick(e);
  hoverDrawer = p?.type === 'drawer' ? p.drawer : null;
  hoverDisk = p?.type === 'disk' ? p.disk : null;
  canvas.style.cursor = p ? 'pointer' : 'default';
});
canvas.addEventListener('pointerleave', () => { hoverDrawer = hoverDisk = null; });
canvas.addEventListener('click', e => {
  if (busy || viewer.active) return;
  const p = pick(e);
  if (!p) return;
  if (p.type === 'disk') return tapDisk(openDrawer, p.disk);
  const d = p.drawer;
  if (d === openDrawer) return closeDrawer();
  requestOpen(d);
});
addEventListener('keydown', e => {
  if (viewer.active || isTyping(e.target)) return;
  if (e.key === 'Escape') { if (!$('pw').classList.contains('show')) closeDrawer(); hidePw(); return; }
  if (!openDrawer || !openDrawer.disks.length) return;
  const onPage = e.target === document.body || e.target === canvas;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || (e.key === ' ' && onPage)) { e.preventDefault(); stepDisk(openDrawer, 1); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); stepDisk(openDrawer, -1); }
  else if (e.key === 'Enter' && onPage) { e.preventDefault(); openCase(); }
});

function requestOpen(d) {
  closeDrawer(true);
  if (d.locked && !d.unlocked) return showPw(d);
  hidePw(); d.target = 1; openDrawer = d;
  showItem(d);
}
function closeDrawer(silent) {
  hidePw(); stopAudio();
  if (openDrawer) { openDrawer.target = 0; openDrawer = null; }
  hoverDisk = null; dock.hidden = true; view = 'closed';
  if (!silent) ctxEl.textContent = 'tap a drawer';
}

/* ---- flip-through: tap the front disk and it falls forward onto the pile,
   showing the next beat; tap a flipped disk to bring it back; on the last disk
   a tap stands the whole row back up (the last one down comes up first). */
function setCurrent(d, i, restack = false) {
  const n = d.disks.length; if (!n) return;
  const prev = d.cur; d.cur = Math.max(0, Math.min(n - 1, i));
  if (restack) d.disks.forEach((k, j) => { k.userData.holdUntil = clock + Math.max(0, prev - 1 - j) * 0.07; });
  if (d.cur !== prev) stopAudio();
  showItem(d);
}
function stepDisk(d, dir) {
  const n = d.disks.length; if (!n) return;
  if (dir > 0) { if (d.cur + 1 < n) setCurrent(d, d.cur + 1); else setCurrent(d, 0, true); }
  else setCurrent(d, d.cur - 1);
}
function tapDisk(d, disk) {
  if (!d || !disk) return;
  const i = disk.userData.index;
  if (i === d.cur) stepDisk(d, 1); else setCurrent(d, i);
}
function diskTarget(d, k) {
  const u = k.userData, i = u.index;
  if (i < d.cur) return { a: Math.max(0.78, STACK.flat - 0.045 * i), y: 0 };           // on the pile
  if (i === d.cur) return { a: STACK.lean, y: k === hoverDisk ? 0.9 : 0.35 };          // front disk sits a touch proud
  return { a: STACK.lean, y: 0 };
}

/* ---------------- dock: the current beat, with play / license / buy ---------------- */
let dockItem = null, dockSource = null;   // dockSource: 'bin' | 'case'
function tiersFor(p) {
  const opts = (p.tiers || []).slice().sort((a, b) => a.price - b.price);
  if (p.exclusive) opts.push({ id: 'exclusive', label: 'EXCLUSIVE', price: p.exclusive.price, stripeLink: p.exclusive.stripeLink, buyable: p.exclusive.buyable });
  return opts;
}
const money = n => '$' + Number(n).toFixed(2).replace(/\.00$/, '');
function fillDock(p, index, total, source) {
  dockItem = p; dockSource = source;
  $('pTitle').textContent = p.title;
  $('pMeta').textContent = [p.genre, p.bpm ? p.bpm + ' bpm' : '', p.key].filter(Boolean).join(' · ');
  const opts = tiersFor(p), sel = $('pTier'); sel.innerHTML = '';
  opts.forEach((t, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${t.label} ${money(t.price)}`; sel.appendChild(o); });
  sel.disabled = !opts.length; dock._opts = opts;
  setBuyLabel();
  $('pCase').hidden = source !== 'bin';
  renderDots(total, index);
  refreshPlay();
  dock.hidden = false;
}
function setBuyLabel() {
  const t = dock._opts && dock._opts[$('pTier').value];
  // buyable === false: no download file yet, so ask instead of taking payment (same rule as /store)
  $('pBuy').textContent = t && t.buyable === false ? 'Ask' : 'Buy';
  $('pBuy').disabled = !t;
}
$('pTier').addEventListener('change', setBuyLabel);
function renderDots(n, i) {
  const el = $('vDots'); el.innerHTML = ''; el.hidden = n < 2;
  for (let k = 0; k < n; k++) {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'dot' + (k === i ? ' on' : ''); b.setAttribute('aria-label', `Beat ${k + 1} of ${n}`);
    if (k === i) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => {
      if (viewer.active) { if (k !== viewer.index) viewer.go(k - viewer.index); }
      else if (openDrawer) setCurrent(openDrawer, k);
    });
    el.appendChild(b);
  }
}
function showItem(d) {
  const n = d.disks.length;
  if (!n) { dock.hidden = true; ctxEl.textContent = `${d.cfg.label} · empty`; return; }
  const p = d.disks[d.cur].userData.product;
  fillDock(p, d.cur, n, 'bin');
  ctxEl.textContent = `${d.cfg.label} · ${d.cur + 1} / ${n}`;
}

/* ---------------- preview audio ----------------
   Catalog paths are site-relative ("previews/x.mp3"); resolve them from the
   site root, not from /lab/floppy/. A HEAD check tells us up front whether
   the file exists so the button says so instead of failing silently. */
const audio = $('audio');
const previewOk = new Map();   // src -> true | false | Promise
function previewSrc(p) { return p && p.preview ? new URL(p.preview, location.origin + '/').href : null; }
function checkPreview(src) {
  if (!src) return Promise.resolve(false);
  if (previewOk.has(src)) return Promise.resolve(previewOk.get(src));
  const pr = fetch(src, { method: 'HEAD' }).then(r => r.ok && !/text\/html/.test(r.headers.get('content-type') || '')).catch(() => false)
    .then(ok => { previewOk.set(src, ok); return ok; });
  previewOk.set(src, pr); return pr;
}
function setPlay(label, disabled) { const b = $('pPlay'); b.textContent = label; b.disabled = !!disabled; }
function refreshPlay() {
  const p = dockItem, src = previewSrc(p);
  if (!src) return setPlay('No preview', true);
  if (!audio.paused && audio.dataset.id === p.id) return setPlay('Pause');
  setPlay('Play');
  checkPreview(src).then(ok => { if (dockItem === p && !ok) setPlay('No preview yet', true); });
}
function stopAudio() { audio.pause(); if (dockItem) refreshPlay(); }
function playPreview(p) {
  const src = previewSrc(p); if (!src || previewOk.get(src) === false) return refreshPlay();
  if (audio.dataset.id !== p.id) { audio.src = src; audio.dataset.id = p.id; }
  setPlay('Pause');
  audio.play().catch(() => { previewOk.set(src, false); refreshPlay(); });
}
audio.addEventListener('error', () => { if (audio.src) previewOk.set(audio.src, false); refreshPlay(); });   // a missing file never closes the case
audio.addEventListener('ended', () => { refreshPlay(); if (viewer.active && viewer.lidOpen) viewer.setLid(false); });
$('pPlay').addEventListener('click', () => {
  if (!dockItem) return;
  if (viewer.active) return viewer.setLid(!viewer.lidOpen);      // in the case, the lid is the play button
  if (!audio.paused && audio.dataset.id === dockItem.id) { audio.pause(); refreshPlay(); }
  else playPreview(dockItem);
});
$('pBuy').addEventListener('click', async () => {
  const tier = dock._opts && dock._opts[$('pTier').value], p = dockItem; if (!tier || !p) return;
  const fallback = () => { location.href = tier.stripeLink || 'mailto:jayrewindbeatz@gmail.com?subject=' + encodeURIComponent(`Buy "${p.title}" — ${tier.label}`); };
  if (tier.buyable === false) return fallback();
  try {
    const cfg = await (await fetch('/api/checkout')).json(); if (!cfg.enabled) return fallback();
    const j = await (await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, tierId: tier.id }) })).json();
    if (j.url) location.href = j.url; else fallback();
  } catch { fallback(); }
});

/* ---------------- the clear case (case-viewer.js) ----------------
   "Open case" shows the current disk in its case; swiping there moves through
   the same drawer, and closing it leaves the bin on whatever disk you ended on. */
let viewerDrawer = null;
viewer = createCaseViewer({
  THREE, renderer, canvas, makeDisk: buildDisk, insets,
  onLid: (open, p) => { if (open && p) playPreview(p); else { audio.pause(); if (dockItem) refreshPlay(); } },
  onIndex: (i, p) => { const n = viewerDrawer ? viewerDrawer.disks.length : 1; fillDock(p, i, n, 'case'); ctxEl.textContent = `${viewerDrawer ? viewerDrawer.cfg.label : ''} · ${i + 1} / ${n}`; },
  onClose: () => {
    document.body.classList.remove('viewing');
    if (viewerDrawer && openDrawer === viewerDrawer) setCurrent(viewerDrawer, viewer.index);
    viewerDrawer = null;
  },
});
viewer.resize(innerWidth, innerHeight);
function whiteFade() { const f = $('fade'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
function openCase() {
  const d = openDrawer; if (!d || !d.disks.length) return;
  viewerDrawer = d; whiteFade(); document.body.classList.add('viewing');
  viewer.open(d.disks.map(k => k.userData.product), d.cur);
}
function selectDisk(disk) {   // kept for tests/console: open a specific disk in its case
  const d = drawerObjs.find(x => x.disks.includes(disk)); if (!d) return;
  if (openDrawer !== d) requestOpen(d);
  setCurrent(d, disk.userData.index); openCase();
}
$('pCase').addEventListener('click', openCase);
$('vBack').addEventListener('click', () => { whiteFade(); viewer.close(); });

/* vault: key flies to the lock, turns (or refuses) */
let pwDrawer = null, keyAnim = null;
function showPw(d) { pwDrawer = d; $('pwErr').textContent = ''; $('pw').classList.add('show'); $('pwInput').value = ''; $('pwInput').focus(); view = d.row === 0 ? 'top' : 'bottom'; view = 'closed'; }
function hidePw() { $('pw').classList.remove('show'); if (!keyAnim) keyGroup.visible = false; }
$('pw').addEventListener('submit', async e => {
  e.preventDefault(); if (!pwDrawer || keyAnim) return;
  const ok = await checkPassword(pwDrawer.cfg, $('pwInput').value);
  const d = pwDrawer, lockWorld = d.face.userData.lock.clone().applyMatrix4(d.group.matrixWorld);
  keyGroup.visible = true; busy = true;
  keyAnim = { t: 0, ok, d, lock: lockWorld };
});
function stepKey(dt) {
  const k = keyAnim; if (!k) return; k.t += dt;
  const start = new THREE.Vector3(k.lock.x + 14, k.lock.y - 8, k.lock.z + 20);
  const ins = k.lock.clone().add(new THREE.Vector3(0, -1.2, 1.4));
  const t = k.t;
  if (t < 0.7) { const u = easeOut(t / 0.7); keyGroup.position.lerpVectors(start, ins.clone().add(new THREE.Vector3(0, 0, 4)), u); keyGroup.rotation.set(0, 0, 0); }
  else if (t < 1.0) { const u = (t - 0.7) / 0.3; keyGroup.position.copy(ins).add(new THREE.Vector3(0, 0, 4 * (1 - u))); }
  else if (t < 1.6) { const u = easeOut((t - 1.0) / 0.6); keyGroup.rotation.z = (k.ok ? -Math.PI / 2 : -0.28) * u; keyGroup.position.copy(ins); }
  else if (t < 1.9) { if (!k.ok) { keyGroup.rotation.z = -0.28 * (1 - (t - 1.6) / 0.3) + Math.sin(t * 60) * 0.03; } }
  else {
    keyAnim = null; busy = false; keyGroup.visible = false; keyGroup.rotation.set(0, 0, 0);
    if (k.ok) { k.d.unlocked = true; hidePw(); requestOpen(k.d); } else { $('pwErr').textContent = 'wrong key'; $('pwInput').select(); }
  }
}
const easeOut = u => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);

/* ---------------- loop ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
  for (const d of drawerObjs) {
    const goal = d.target + (d === hoverDrawer && !d.target ? 0.04 : 0);
    d.open += (goal - d.open) * Math.min(1, dt * 6);
    d.group.position.z = DEPTH / 2 - FACE_D / 2 + d.open * TRAVEL;
    for (const k of d.disks) {
      const u = k.userData;
      if (clock >= u.holdUntil) { const t = diskTarget(d, k); u.ta = t.a; u.ty = t.y; }
      // slightly under-damped hinge spring: the disk lands on the pile with a small bounce
      u.va += ((u.ta - u.angle) * 140 - u.va * 15) * dt; u.angle += u.va * dt;
      u.y += (u.ty - u.y) * Math.min(1, dt * 10);
      u.pivot.rotation.x = u.angle; u.pivot.position.y = STACK.floor + u.y;
    }
  }
  stepKey(dt);
  const v = openDrawer ? binView(openDrawer) : VIEWS[view];
  camPos.lerp(v.pos, Math.min(1, dt * 3)); camLook.lerp(v.look, Math.min(1, dt * 3));
  camera.position.copy(camPos); camera.lookAt(camLook);
  frameOffset(camera);
  viewer.update(dt);
  if (viewer.active) renderer.render(viewer.scene, viewer.camera);   // the bin keeps its state underneath
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// settle(): jump every animation to its resting state (used by the headless layout tests)
function settle() {
  for (const d of drawerObjs) {
    d.open = d.target; d.group.position.z = DEPTH / 2 - FACE_D / 2 + d.open * TRAVEL;
    for (const k of d.disks) { const u = k.userData, t = diskTarget(d, k); u.ta = u.angle = t.a; u.va = 0; u.ty = u.y = t.y; u.holdUntil = 0; u.pivot.rotation.x = u.angle; u.pivot.position.y = STACK.floor + u.y; }
  }
  const v = openDrawer ? binView(openDrawer) : VIEWS[view];
  camPos.copy(v.pos); camLook.copy(v.look);
  camera.position.copy(camPos); camera.lookAt(camLook); frameOffset(camera); camera.updateMatrixWorld();
}
window.__cabinet = { drawers: drawerObjs, requestOpen, closeDrawer, selectDisk, openCase, stepDisk, tapDisk, settle, camera, get openDrawer() { return openDrawer; }, viewer, tune: { renderer, key, fill, hemi: scene.children.find(o => o.isHemisphereLight) } };
