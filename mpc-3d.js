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
  const CAM_PHI = 1.0; // elevation angle (rad) — high top-down 3/4 view, reads clearly at a glance

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
    canvasEl.addEventListener('click', onClick);
    canvasEl.addEventListener('pointerleave', () => {
      hoveredPart = null; hideTooltip(); canvasEl.style.cursor = 'default';
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
  // how tightly the camera frames the MPC itself.
  // "Text"/"Cylinder004" are a leftover floating "RMLUR" text experiment
  // parked off to the side of the scene, not part of the MPC itself.
  const ENV_RE = /^(Desk|Floor|WallSeam|LampArm|Backdrop|Drive_Body|Cable|iPod|Leg|Cone|Point|Plane|Text|Cylinder\.?004)/i;

  function loadModel() {
    return new Promise((resolve, reject) => {
      const GLTFLoaderClass = (typeof THREE.GLTFLoader !== 'undefined') ? THREE.GLTFLoader
        : (typeof window.GLTFLoader !== 'undefined') ? window.GLTFLoader : null;
      if (!GLTFLoaderClass) { reject(new Error('GLTFLoader not available')); return; }

      const loader = new GLTFLoaderClass();
      loader.load('assets/mpc-scene/mpc.glb', (gltf) => {
        try {
          const mpcRoot = gltf.scene;
          mpcRoot.updateMatrixWorld(true);

          const box = new THREE.Box3();
          mpcRoot.traverse((obj) => {
            if (!obj.isMesh) return;
            // The desk/wall/lamp/cable/iPod-prop environment reads as
            // clutter at this preview size (thin wires cutting through
            // frame, a stray desk-lamp prop) rather than adding context —
            // hide it and frame on the MPC alone.
            if (ENV_RE.test(obj.name || '')) { obj.visible = false; return; }
            tagPart(obj);
            box.expandByObject(obj);
          });

          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.4 / maxDim;
          mpcRoot.scale.setScalar(scale);
          mpcRoot.position.sub(center.clone().multiplyScalar(scale));

          buildLcdTexture();
          scene.add(mpcRoot);

          modelHalfW = (size.x * scale) / 2;
          modelHalfH = (size.y * scale) / 2;
          modelHalfD = (size.z * scale) / 2;
          refitCamera();

          resolve();
        } catch (err) {
          reject(err);
        }
      }, undefined, reject);
    });
  }

  const PAD_RE = /^Pad_(\d+)$/;
  const NAMED_RE = /^(Btn_|MPC_DataWheel)/;

  function tagPart(obj) {
    if (obj.name === 'MPC_LCD') { lcdMesh = obj; return; }
    // The panel photo is the real product photo, already correctly lit —
    // rendering it as a normal lit PBR material double-exposes it (scene
    // lights on top of the baked photo) and ACES tone-mapping then washes
    // the already-bright cream body toward pale/white. Render it unlit,
    // same treatment as the LCD's canvas texture below.
    if (obj.name === 'MPC_PanelPhoto') {
      if (obj.material && obj.material.map) {
        obj.material = new THREE.MeshBasicMaterial({ map: obj.material.map, toneMapped: false });
      }
      return;
    }

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
    if (lcdMesh) {
      lcdMesh.material = new THREE.MeshBasicMaterial({ map: lcdTexture, toneMapped: false });
    }
  }

  function onPointerMove(e) {
    const rect = canvasEl.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
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

  function labelFor(name) {
    const padMatch = name.match(PAD_RE);
    if (padMatch) return 'PAD ' + (parseInt(padMatch[1], 10) + 1);
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
    if (!hoveredPart) return;
    flash(hoveredPart);
    const name = hoveredPart.userData.mpcName;
    const padMatch = name.match(PAD_RE);
    if (padMatch && bridge.onPadClick) { bridge.onPadClick(parseInt(padMatch[1], 10)); return; }
    if (bridge.onPartClick) bridge.onPartClick(name);
  }

  function flash(mesh) {
    if (!mesh.material) return;
    if (!mesh.material.emissive) return; // MPC_LCD's canvas material has no emissive channel
    const orig = mesh.material.emissiveIntensity || 0;
    mesh.material.emissive = new THREE.Color(0xffffff);
    mesh.material.emissiveIntensity = 0.5;
    setTimeout(() => { if (mesh.material) mesh.material.emissiveIntensity = orig; }, 160);
  }

  function setPadColor(idx, color) {
    const mesh = padMeshes[idx];
    if (!mesh || !mesh.material || !mesh.material.emissive) return;
    mesh.material.emissive = new THREE.Color(color);
    mesh.material.emissiveIntensity = color === '#111111' ? 0.05 : 0.65;
  }

  function startLoop() {
    (function tick() {
      requestAnimationFrame(tick);
      if (lcdTexture) lcdTexture.needsUpdate = true;
      renderer.render(scene, camera);
    })();
  }

  return bridge;
})();
