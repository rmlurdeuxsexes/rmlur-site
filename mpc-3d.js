/* ============================================================
   RMLUR 3D MPC — Three.js viewer for the homepage nav.

   Wraps the actual mpc-hero.jpg photo onto real 3D geometry
   (16 pads + sockets, transport buttons, data wheel + grip,
   panel/body/LCD), instead of a generic purchased model's
   mismatched texture — every doodle, sticker, and printed label
   is pixel-correct because it *is* the real photo, just applied
   to raised 3D geometry instead of a flat image.

   Public API: window.mpc3d.init(wrapElId, lcdCanvasEl) -> Promise
   Callbacks:  window.mpc3d.onPadClick(padIndex 0-15)
               window.mpc3d.onPartClick(objectName)
   ============================================================ */
window.mpc3d = (function () {
  'use strict';

  const bridge = {
    onPadClick: null,
    onPartClick: null,
    init: init,
    setPadColor: setPadColor,
  };

  let scene, camera, renderer, canvasEl, wrapEl, tooltipEl;
  let raycaster, mouse;
  let hoveredPart = null;
  const interactives = {}; // name -> mesh[]
  const padMeshes = [];
  let lcdMesh = null, lcdTexture = null, lcdCanvasEl = null;
  let modelHalfW = null, modelHalfH = null, modelHalfD = null; // set once the model loads; reused to refit the camera whenever the container's aspect changes
  const CAM_PHI = 1.18; // elevation angle (rad) — leaned-over top-down 3/4 view, looking down and over the MPC

  // Fader drag — Btn_Fader slides along its own local Y between these two
  // measured endpoints (top/bottom of the printed slider track).
  let mpcRoot = null, faderMesh = null, cableMesh = null, draggingFader = false, suppressNextClick = false;
  const FADER_Y_MIN = -0.2515, FADER_Y_MAX = -0.1300;
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
  const dragPoint = new THREE.Vector3();

  function refitCamera() {
    if (modelHalfW == null) return; // model hasn't loaded yet
    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * camera.aspect);
    // As the camera tilts up by CAM_PHI, some of the panel's depth
    // foreshortens into the vertical frame too — approximate that so a
    // tilted shot isn't measured as if it were still perfectly flat.
    const effectiveHalfH = modelHalfH * Math.cos(CAM_PHI) + modelHalfD * Math.sin(CAM_PHI);
    const radiusForHeight = effectiveHalfH / Math.tan(vFovRad / 2);
    const radiusForWidth = modelHalfW / Math.tan(hFovRad / 2);
    const radius = Math.max(radiusForHeight, radiusForWidth) * 1.15;
    camera.position.set(0, radius * Math.sin(CAM_PHI), radius * Math.cos(CAM_PHI));
    camera.lookAt(0, 0, 0);
  }

  function init(wrapId, lcdCanvas) {
    wrapEl = document.getElementById(wrapId);
    lcdCanvasEl = lcdCanvas;
    if (!wrapEl) return Promise.reject(new Error('mpc3d: wrap element not found'));

    canvasEl = document.createElement('canvas');
    canvasEl.id = 'mpc3dCanvas';
    wrapEl.appendChild(canvasEl);

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'mpc3d-tooltip';
    wrapEl.appendChild(tooltipEl);

    const w = wrapEl.clientWidth || 640, h = wrapEl.clientHeight || 640;

    scene = new THREE.Scene();
    scene.background = null;
    camera = new THREE.PerspectiveCamera(18, w / h, 0.05, 100);

    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x000000, 0);

    // Flat, even product-photo lighting — this model's own texture (the
    // real photo) is already correctly lit/colored, so lights here just
    // need to reveal the 3D form (pad depth, wheel roundness) without
    // washing out or recoloring what's already baked into the photo.
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.5); key.position.set(0, 5, 6); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25); fill.position.set(-3, 2, 4); scene.add(fill);
    const fill2 = new THREE.DirectionalLight(0xffffff, 0.2); fill2.position.set(3, 2, 4); scene.add(fill2);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    canvasEl.addEventListener('pointermove', onPointerMove);
    canvasEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    canvasEl.addEventListener('click', onClick);
    canvasEl.addEventListener('pointerleave', () => {
      if (!draggingFader) { hoveredPart = null; hideTooltip(); canvasEl.style.cursor = 'default'; }
    });

    const ro = new ResizeObserver(() => {
      const ww = wrapEl.clientWidth, hh = wrapEl.clientHeight;
      if (ww > 0 && hh > 0) {
        camera.aspect = ww / hh;
        camera.updateProjectionMatrix();
        renderer.setSize(ww, hh, false);
        refitCamera(); // the container can resize (or first settle) after the model's already loaded
      }
    });
    ro.observe(wrapEl);

    return loadModel().then(() => { startLoop(); });
  }

  // Desk/floor/wall/lamp objects give the scene depth but shouldn't drive
  // how tightly the camera frames the MPC itself — genuine clutter, hidden
  // outright. "Text"/"Cylinder004" are a leftover floating "RMLUR" text
  // experiment parked off to the side of the scene. "MPC_Port" and
  // "VentSlot" are non-interactive chassis-detail props with no bevel
  // geometry behind them, so they rendered floating past the chassis
  // silhouette into the background instead of sitting on a surface —
  // hidden until they have a proper bevel to sit on. (Btn_Floppy, right
  // next to the vent slots, is a real functional button — left alone.)
  const HIDE_RE = /^(Desk|Floor|WallSeam|LampArm|Backdrop|Leg|Cone|Point|Plane|Text|Cylinder\.?004|MPC_Port|VentSlot)/i;
  // "iPod" was a placeholder mockup prop for the radio-station player —
  // that player shipped for real (radio-player.js, site-wide), so the
  // mockup has no future use left. Actually removed from the scene graph
  // (not just hidden) so it's gone for good, not lingering dead weight.
  const REMOVE_RE = /^iPod/i;
  // The connector cable to the drive renders (it's real geometry, part of
  // the scene) but its span shouldn't dictate the camera fit the way the
  // drive housing itself should — excluded from the box below, included
  // in rendering.
  const CABLE_RE = /^Cable/i;

  function loadTexture(url) {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(url, resolve, undefined, reject);
    });
  }

  // Pads had zero texture (flat near-black PadMat). assets/pad-texture.png
  // is a clean crop straight from the real panel photo (mpc-hero.jpg),
  // pre-processed (brightened, desaturated, tight-cropped with no
  // white/transparent border) so it fills the pad's full UV range — the
  // original placeholder file had exactly that kind of border baked in,
  // which is what caused a bright line where the pad's bevel/side faces
  // sampled into it. Cloned per-pad (not shared) so setPadColor's per-pad
  // emissive still works independently once something actually calls it.
  function applyPadTextures(padTex) {
    padTex.colorSpace = THREE.SRGBColorSpace;
    padTex.anisotropy = 4;
    // emissiveMap keeps the real texture/sheen visible at a fixed baseline
    // regardless of light angle (this scene's lighting + ACES tone mapping
    // otherwise crushes dark textures), while `map` gives real lit shading
    // on top for hover/press. High roughness + zero metalness reads as
    // matte rubber, not the glossy specular-streaked look low roughness
    // gave it. (setPadColor, if ever wired up, would need to blend with
    // this base emissive rather than replace it outright — unused today.)
    const base = new THREE.MeshStandardMaterial({
      map: padTex,
      emissiveMap: padTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.3,
      roughness: 0.88,
      metalness: 0,
    });
    padMeshes.forEach((mesh) => { if (mesh) mesh.material = base.clone(); });
  }

  // Drive_Body (the satellite tape/floppy unit on the end of the cable) was
  // authored with iPodBodyMat — the material for the *removed, unrelated*
  // iPod placeholder prop (see REMOVE_RE) — which is exactly why it read as
  // a cheap iPod widget instead of a physical drive. Reuse the tone of the
  // already-built Gotek material set (meant for this kind of unit) instead
  // of inventing a new one, tuned toward brushed metal for a standalone
  // satellite case rather than the small dark on-body button cluster.
  function applyDriveMaterial() {
    const driveMesh = mpcRoot.getObjectByName('Drive_Body');
    const source = mpcRoot.getObjectByName('GotekUSB') || mpcRoot.getObjectByName('GotekKnob');
    if (!driveMesh || !source || !source.material) return;
    const mat = source.material.clone();
    mat.color.setRGB(0.42, 0.43, 0.45);
    mat.metalness = 0.65;
    mat.roughness = 0.38;
    driveMesh.material = mat;
  }

  // The panel photo has the REC GAIN / MAIN VOLUME knobs baked into it as
  // printed pixels — a leftover from the original photograph, separate
  // from the interactive 3D knob mesh that sits on top of it. Whenever
  // that 3D mesh isn't pixel-perfectly registered with the baked-in knob,
  // the original printed knob peeks out from behind it — the same
  // duplicate-geometry failure mode the pads had before they got their
  // own texture, just showing up differently because this part of the
  // panel photo has real content to peek through instead of blank plate.
  // Fix: paint the printed knobs out of the actual texture the mesh uses
  // (patched at runtime — this file, not the exported mpc-hero.jpg, is
  // what the 3D panel actually samples; mpc.glb embeds its own copy of
  // the image), so the 3D knob mesh becomes the sole visual source for
  // them, matching how pads already work. Coordinates are pixel
  // positions in the embedded photo (1412x1400), found empirically.
  function patchPanelKnobs(panelMesh) {
    const tex = panelMesh && panelMesh.material && panelMesh.material.map;
    const img = tex && tex.image;
    if (!img || !img.width) return;

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    function eraseCircle(cx, cy, r, sampleDx) {
      const stripW = 24, stripH = r * 2;
      const strip = document.createElement('canvas');
      strip.width = stripW; strip.height = stripH;
      strip.getContext('2d').drawImage(canvas, cx + sampleDx - stripW / 2, cy - r, stripW, stripH, 0, 0, stripW, stripH);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      for (let x = cx - r; x < cx + r + stripW; x += stripW) ctx.drawImage(strip, x, cy - r);
      ctx.restore();
    }
    eraseCircle(1105, 232, 38, -90);
    eraseCircle(1240, 232, 38, 90);

    const patched = new THREE.CanvasTexture(canvas);
    patched.colorSpace = THREE.SRGBColorSpace;
    patched.offset.copy(tex.offset);
    patched.repeat.copy(tex.repeat);
    patched.rotation = tex.rotation;
    patched.center.copy(tex.center);
    patched.wrapS = tex.wrapS;
    patched.wrapT = tex.wrapT;
    panelMesh.material.map = patched;
    panelMesh.material.needsUpdate = true;
  }

  // Btn_Floppy (a real nav button) and the Gotek mini-panel (GotekScreen/
  // USB/Btn1/Btn2/Knob — also real, grouped into the clickable "Drive_Body"
  // interactive via DRIVE_RE) sit further forward (z~0.345-0.37) than the
  // thin front-lip trim behind them (MPC_FrontLip, z~0.33-0.338) — nothing
  // actually backs them, so they render floating past the chassis edge
  // into the background. These are real functionality, not clutter to
  // hide (unlike VentSlot/MPC_Port) — ground them with a simple backing
  // plate instead, sized to their combined footprint, colored to match
  // the chassis so it reads as a mounting surface, not a new visible part.
  function addFloppyClusterBacking() {
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.03, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x2e2e33, roughness: 0.7, metalness: 0.1 })
    );
    backing.position.set(-0.435, 0.758, 0.335);
    mpcRoot.add(backing);
  }

  // Drive_Body (the satellite unit at the end of the cable) sits well off
  // the main chassis with nothing beneath it — Desk/Floor/Backdrop are
  // hidden (see HIDE_RE), so it read as floating in a void with no cue
  // it's resting on anything. A soft radial contact shadow gives it an
  // implied surface without reintroducing a full floor/backdrop.
  function addDriveGroundShadow() {
    const drive = mpcRoot.getObjectByName('Drive_Body');
    if (!drive) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.26)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(drive.position.x + 0.03, drive.position.y - 0.28, drive.position.z + 0.02);
    mpcRoot.add(shadow);
  }

  // The cable mesh is a real curved tube (not a CSS line), but it was
  // authored almost perfectly taut — under 0.03 units of vertical sag
  // across its whole span. Rebuild it as a genuinely sagging tube between
  // its own real endpoints (found from its own geometry, not guessed).
  function applyCableSag() {
    if (!cableMesh || !cableMesh.geometry) return;
    const pos = cableMesh.geometry.attributes.position;
    let minI = 0, maxI = 0;
    for (let i = 1; i < pos.count; i++) {
      if (pos.getX(i) < pos.getX(minI)) minI = i;
      if (pos.getX(i) > pos.getX(maxI)) maxI = i;
    }
    const start = new THREE.Vector3(pos.getX(minI), pos.getY(minI), pos.getZ(minI));
    const end = new THREE.Vector3(pos.getX(maxI), pos.getY(maxI), pos.getZ(maxI));
    const span = start.distanceTo(end);
    const mid = start.clone().lerp(end, 0.5);
    mid.y -= span * 0.22; // gravity sag, proportional to how far the drive sits from the body
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const newGeo = new THREE.TubeGeometry(curve, 48, 0.0055, 8, false);
    cableMesh.geometry.dispose();
    cableMesh.geometry = newGeo;
  }

  function loadModel() {
    const GLTFLoaderClass = (typeof THREE.GLTFLoader !== 'undefined') ? THREE.GLTFLoader
      : (typeof window.GLTFLoader !== 'undefined') ? window.GLTFLoader : null;
    if (!GLTFLoaderClass) return Promise.reject(new Error('GLTFLoader not available'));

    const loader = new GLTFLoaderClass();
    const gltfPromise = new Promise((resolve, reject) => loader.load('assets/mpc-scene/mpc.glb', resolve, undefined, reject));
    const padTexPromise = loadTexture('assets/pad-texture.png?v=2');

    return Promise.all([gltfPromise, padTexPromise]).then(([gltf, padTex]) => {
      mpcRoot = gltf.scene;
      mpcRoot.updateMatrixWorld(true);

      const box = new THREE.Box3();
      const toRemove = [];
      mpcRoot.traverse((obj) => {
        if (!obj.isMesh) return;
        if (REMOVE_RE.test(obj.name || '')) { toRemove.push(obj); return; }
        if (HIDE_RE.test(obj.name || '')) { obj.visible = false; return; }
        tagPart(obj);
        // Drive housing (Drive_Body/Gotek*) counts toward the frame fit
        // so it's actually visible in the crop; the cable itself doesn't.
        if (CABLE_RE.test(obj.name || '')) { cableMesh = obj; return; }
        box.expandByObject(obj);
      });
      // Removed after the traverse completes, not during it — mutating the
      // scene graph mid-traverse can skip nodes.
      toRemove.forEach((obj) => {
        obj.geometry && obj.geometry.dispose();
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m && m.dispose());
        if (obj.parent) obj.parent.remove(obj);
      });

      applyPadTextures(padTex);
      applyDriveMaterial();
      applyCableSag();
      addFloppyClusterBacking();
      patchPanelKnobs(mpcRoot.getObjectByName('MPC_PanelPhoto'));

      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2.4 / maxDim;
      mpcRoot.scale.setScalar(scale);
      mpcRoot.position.sub(center.clone().multiplyScalar(scale));

      addDriveGroundShadow();
      buildLcdTexture();
      scene.add(mpcRoot);

      modelHalfW = (size.x * scale) / 2;
      modelHalfH = (size.y * scale) / 2;
      modelHalfD = (size.z * scale) / 2;
      refitCamera();
    });
  }

  const PAD_RE = /^Pad_(\d+)$/;
  const NAMED_RE = /^(Btn_|MPC_DataWheel)/;
  // The satellite tape/floppy drive is several separate meshes (body,
  // screen, buttons, knob) — grouped under one canonical name so hovering
  // any part of it gives one consistent tooltip/click target, same as a
  // real physical unit rather than 5 independently-behaving hotspots.
  const DRIVE_RE = /^(Drive_Body|Gotek)/i;
  const DRIVE_NAME = 'Drive_Body';

  // The panel photo is the real product photo, already correctly lit —
  // rendering it as a normal lit PBR material double-exposes it (scene
  // lights on top of the baked photo) and ACES tone-mapping then washes
  // the already-bright cream body toward pale/white. Every part that now
  // samples a crop of that same photo (pads/knobs/wheel excluded — those
  // keep their flat colors, lit normally, for real 3D shading) needs the
  // same unlit treatment so it reads as continuous with the panel instead
  // of washed-out or mismatched next to it. One shared converted material
  // per source texture, reused everywhere that texture appears.
  const unlitCache = new Map();
  function toUnlit(mat) {
    if (!mat || !mat.map) return mat;
    if (mat.userData && mat.userData.isPanelPhotoUnlit) return mat;
    const key = mat.map;
    let unlit = unlitCache.get(key);
    if (!unlit) {
      unlit = new THREE.MeshBasicMaterial({ map: mat.map, toneMapped: false });
      unlit.userData.isPanelPhotoUnlit = true;
      unlitCache.set(key, unlit);
    }
    return unlit;
  }
  function convertPanelPhotoMaterials(obj) {
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => (m && m.name === 'MPCPanelPhotoMat') ? toUnlit(m) : m);
    } else if (obj.material && obj.material.name === 'MPCPanelPhotoMat') {
      obj.material = toUnlit(obj.material);
    }
  }

  function tagPart(obj) {
    if (obj.name === 'MPC_LCD') {
      lcdMesh = obj;
      obj.userData.mpcName = 'MPC_LCD';
      (interactives['MPC_LCD'] || (interactives['MPC_LCD'] = [])).push(obj);
      return;
    }
    if (obj.name === 'Btn_Fader') { faderMesh = obj; }
    if (obj.name === 'MPC_PanelPhoto') {
      convertPanelPhotoMaterials(obj);
      return;
    }
    if (DRIVE_RE.test(obj.name || '')) {
      convertPanelPhotoMaterials(obj);
      obj.userData.mpcName = DRIVE_NAME;
      (interactives[DRIVE_NAME] || (interactives[DRIVE_NAME] = [])).push(obj);
      return;
    }
    convertPanelPhotoMaterials(obj);

    const n = obj.name || '';
    let matchName = n;
    if (!PAD_RE.test(matchName) && !NAMED_RE.test(matchName) && obj.parent) {
      const pn = obj.parent.name || '';
      if (PAD_RE.test(pn) || NAMED_RE.test(pn)) matchName = pn;
    }

    const padMatch = matchName.match(PAD_RE);
    if (padMatch) {
      const idx = parseInt(padMatch[1], 10); // Pad_0..Pad_15 — already 0-indexed, matches window.PADS directly
      if (!padMeshes[idx]) padMeshes[idx] = obj;
    } else if (!NAMED_RE.test(matchName)) {
      return;
    }

    obj.userData.mpcName = matchName;
    (interactives[matchName] || (interactives[matchName] = [])).push(obj);
  }

  function allRayMeshes() {
    return Object.values(interactives).flat();
  }

  function buildLcdTexture() {
    if (!lcdCanvasEl) return;
    lcdTexture = new THREE.CanvasTexture(lcdCanvasEl);
    lcdTexture.colorSpace = THREE.SRGBColorSpace;
    lcdTexture.magFilter = THREE.LinearFilter;
    lcdTexture.minFilter = THREE.LinearFilter;
    lcdTexture.generateMipmaps = false;
    lcdTexture.anisotropy = 4;
    if (lcdMesh) {
      lcdMesh.material = new THREE.MeshBasicMaterial({ map: lcdTexture, toneMapped: false });
    }
  }

  function onPointerMove(e) {
    const rect = canvasEl.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (draggingFader) {
      if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
        mpcRoot.worldToLocal(dragPoint);
        faderMesh.position.y = THREE.MathUtils.clamp(dragPoint.y, FADER_Y_MIN, FADER_Y_MAX);
      }
      return;
    }

    const hits = raycaster.intersectObjects(allRayMeshes(), false);
    if (hits.length) {
      hoveredPart = hits[0].object;
      canvasEl.style.cursor = 'pointer';
      showTooltip(e.clientX - rect.left, e.clientY - rect.top, labelFor(hoveredPart.userData.mpcName));
    } else {
      hoveredPart = null;
      canvasEl.style.cursor = 'default';
      hideTooltip();
    }
  }

  function onPointerDown() {
    if (faderMesh && hoveredPart === faderMesh) {
      draggingFader = true;
      // Plane through the fader's current world position, facing +Z (the
      // model carries no rotation, so world Z stays "up out of the panel").
      const worldPos = new THREE.Vector3();
      faderMesh.getWorldPosition(worldPos);
      dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), worldPos);
    }
  }
  function onPointerUp() {
    if (draggingFader) { draggingFader = false; suppressNextClick = true; }
  }

  function labelFor(name) {
    const padMatch = name.match(PAD_RE);
    if (padMatch) return 'PAD ' + (parseInt(padMatch[1], 10) + 1);
    if (name === DRIVE_NAME) return 'TAPE';
    return name.replace(/^(Btn_|MPC_)/, '').replace(/_/g, ' ').toUpperCase();
  }

  function showTooltip(x, y, text) {
    tooltipEl.textContent = text;
    tooltipEl.style.left = (x + 12) + 'px';
    tooltipEl.style.top = (y - 28) + 'px';
    tooltipEl.classList.add('show');
  }
  function hideTooltip() { tooltipEl.classList.remove('show'); }

  function onClick() {
    if (suppressNextClick) { suppressNextClick = false; return; }
    if (!hoveredPart) return;
    const name = hoveredPart.userData.mpcName;
    flashPart(name);
    const padMatch = name.match(PAD_RE);
    if (padMatch && bridge.onPadClick) { bridge.onPadClick(parseInt(padMatch[1], 10)); return; }
    if (bridge.onPartClick) bridge.onPartClick(name);
  }

  function setPadColor(idx, color) {
    const mesh = padMeshes[idx];
    if (!mesh || !mesh.material || !mesh.material.emissive) return;
    mesh.material.emissive = new THREE.Color(color);
    mesh.material.emissiveIntensity = color === '#111111' ? 0.05 : 0.65;
  }

  // Generic click feedback — a quick scale bump, material-agnostic (works on
  // the unlit panel-photo meshes too, unlike the pad emissive flash above).
  // Every named part gets this on click; none had any feedback before.
  const activePulses = [];
  function flashPart(name, duration) {
    duration = duration || 220;
    const meshes = interactives[name] || [];
    const now = performance.now();
    meshes.forEach((m) => {
      if (!m.userData._pulseBase) m.userData._pulseBase = m.scale.clone();
      activePulses.push({ mesh: m, base: m.userData._pulseBase, start: now, duration });
    });
  }

  function startLoop() {
    (function tick() {
      requestAnimationFrame(tick);
      for (let i = activePulses.length - 1; i >= 0; i--) {
        const p = activePulses[i];
        const t = (performance.now() - p.start) / p.duration;
        if (t >= 1) { p.mesh.scale.copy(p.base); activePulses.splice(i, 1); continue; }
        const bump = 1 + 0.08 * Math.sin(t * Math.PI); // up and back down, peak mid-pulse
        p.mesh.scale.copy(p.base).multiplyScalar(bump);
      }
      if (lcdTexture) lcdTexture.needsUpdate = true;
      renderer.render(scene, camera);
    })();
  }

  return bridge;
})();
