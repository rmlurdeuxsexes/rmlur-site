/* /museum — JayRewind placements as a white-wall gallery.
   Procedural Three.js (same global build as /lab/floppy). Content comes only
   from data/placements.json; this file is the room + how a plaque is built.
   Look around by dragging; tap a plaque to walk up to it; Esc steps back. */
(function () {
  var THREE = window.THREE;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('stage'), card = $('card'), backBtn = $('back'), hud = $('hud');

  // Room: metres. Viewer stands in the middle, eye height 1.6.
  var ROOM = { w: 12, d: 10, h: 4.2 };
  var WIN = { w: 7.0, y0: 0.75, y1: 3.6 };   // left-wall picture window (metres, along the wall / heights)
  var EYE = 1.6, HOME = new THREE.Vector3(0, EYE, -0.3);

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });   // alpha: the window lets the live-cam layer show through
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f3f0);
  var camera = new THREE.PerspectiveCamera(58, 1, 0.05, 140);
  camera.position.copy(HOME);

  /* ---------- canvas textures ---------- */
  function canvasTex(w, h, draw, srgb) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  function grain(ctx, w, h, amt) {
    var id = ctx.getImageData(0, 0, w, h), d = id.data;
    for (var i = 0; i < d.length; i += 4) { var n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    ctx.putImageData(id, 0, 0);
  }
  // fit text to a width by shrinking the font
  function fitText(ctx, text, x, y, maxW, size, weight, family) {
    var s = size;
    do { ctx.font = weight + ' ' + s + 'px ' + family; s -= 1; } while (ctx.measureText(text).width > maxW && s > 8);
    ctx.fillText(text, x, y);
  }

  /* ---------- the room ---------- */
  var wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, envMapIntensity: 0.25 });
  // polished concrete: warm grey, soft cloudy mottling, fine aggregate, almost no seams;
  // low roughness so the ceiling strips glare off it
  var floorTex = canvasTex(1024, 1024, function (ctx, w, h) {
    ctx.fillStyle = '#b9b3a8'; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 70; i++) {
      var x = Math.random() * w, y = Math.random() * h, r = 60 + Math.random() * 220;
      var g = ctx.createRadialGradient(x, y, 0, x, y, r), light = Math.random() < 0.5;
      g.addColorStop(0, light ? 'rgba(235,230,220,.16)' : 'rgba(120,112,100,.13)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    grain(ctx, w, h, 10);
    for (var j = 0; j < 2600; j++) { ctx.fillStyle = 'rgba(70,64,56,' + (0.06 + Math.random() * 0.12) + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4); }
    ctx.strokeStyle = 'rgba(60,55,48,.10)'; ctx.lineWidth = 1.5;            // one faint saw-cut joint
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(2, 1.7);
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d),
    new THREE.MeshPhysicalMaterial({ map: floorTex, roughness: 0.24, metalness: 0.0, clearcoat: 0.55, clearcoatRoughness: 0.18, envMapIntensity: 1.1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  var ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM.h; scene.add(ceil);

  // walls: name → { position, rotationY } ; the wall faces into the room
  var WALLS = {
    back:  { pos: new THREE.Vector3(0, ROOM.h / 2, -ROOM.d / 2), rot: 0, len: ROOM.w },
    front: { pos: new THREE.Vector3(0, ROOM.h / 2, ROOM.d / 2), rot: Math.PI, len: ROOM.w },
    left:  { pos: new THREE.Vector3(-ROOM.w / 2, ROOM.h / 2, 0), rot: Math.PI / 2, len: ROOM.d },
    right: { pos: new THREE.Vector3(ROOM.w / 2, ROOM.h / 2, 0), rot: -Math.PI / 2, len: ROOM.d }
  };
  var baseMat = new THREE.MeshStandardMaterial({ color: 0xe9e7e1, roughness: 0.8 });
  Object.keys(WALLS).forEach(function (k) {
    var W = WALLS[k];
    var m = new THREE.Mesh(k === 'left' ? windowWallGeo(W.len) : new THREE.PlaneGeometry(W.len, ROOM.h), wallMat);
    m.position.copy(W.pos); m.rotation.y = W.rot; m.receiveShadow = true; scene.add(m);
    var base = new THREE.Mesh(new THREE.BoxGeometry(W.len, 0.09, 0.015), baseMat);
    base.position.copy(W.pos); base.position.y = 0.045; base.rotation.y = W.rot;
    base.translateZ(0.008); scene.add(base);
  });

  /* ---------- picture window on the left wall, looking out at Boston at dusk ---------- */
  function windowWallGeo(len) {
    var s = new THREE.Shape(), hw = len / 2, hh = ROOM.h / 2;
    s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.closePath();
    var h = new THREE.Path(), wx = WIN.w / 2, a = WIN.y0 - hh, b = WIN.y1 - hh;
    h.moveTo(-wx, a); h.lineTo(-wx, b); h.lineTo(wx, b); h.lineTo(wx, a); h.closePath(); s.holes.push(h);
    return new THREE.ShapeGeometry(s);
  }
  (function windowView() {
    var x = -ROOM.w / 2, cy = (WIN.y0 + WIN.y1) / 2, wh = WIN.y1 - WIN.y0;
    // real photo: "Boston Skyline Panorama Dusk" by Fcb981, Wikimedia Commons, CC BY-SA 3.0 (credited on the wall label below)
    // wrapped on the inside of a big half-cylinder around the room, so the view
    // stays continuous from any angle you look out of the window
    var R = 40, ARC = Math.PI * 1.05, VH = R * ARC * 1004 / 3840, WATERLINE = 0.74;   // fraction down the photo where river meets city
    var viewMat = new THREE.MeshBasicMaterial({ color: 0x1b2a4a, side: THREE.BackSide, toneMapped: false });
    var view = new THREE.Mesh(new THREE.CylinderGeometry(R, R, VH, 96, 1, true, Math.PI * 1.5 - ARC / 2, ARC), viewMat);
    view.position.set(0, 1.0 + (WATERLINE - 0.5) * VH, 0); scene.add(view);
    loadTex('assets/museum/boston-skyline-dusk.jpg', function (t) {
      t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1;                 // seen from inside: un-mirror
      viewMat.map = t; viewMat.color.set(0xffffff); viewMat.needsUpdate = true;
    });
    var topY = view.position.y + VH / 2, botY = view.position.y - VH / 2;
    var sky = new THREE.Mesh(new THREE.CylinderGeometry(R + 1, R + 1, 200, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0x274e85, side: THREE.BackSide, toneMapped: false }));
    sky.position.y = topY + 100 - 0.5; scene.add(sky);
    var river = new THREE.Mesh(new THREE.CylinderGeometry(R + 1, R + 1, 200, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0x253352, side: THREE.BackSide, toneMapped: false }));
    river.position.y = botY - 100 + 0.5; scene.add(river);
    var credit = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshStandardMaterial({ roughness: 0.8, map: canvasTex(840, 420, function (ctx, w, h) {
      ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#1b1b1b'; ctx.textBaseline = 'top';
      ctx.font = '600 40px "IBM Plex Mono", monospace'; ctx.fillText('THE VIEW', 40, 40);
      ctx.font = 'italic 36px Georgia, serif'; ctx.fillText('Boston, Back Bay at dusk', 40, 104);
      ctx.fillStyle = '#55524a'; ctx.font = '400 26px "IBM Plex Mono", monospace';
      ctx.fillText('Photo: Fcb981 / Wikimedia Commons', 40, 200); ctx.fillText('CC BY-SA 3.0', 40, 244);
    }) }));
    credit.rotation.y = Math.PI / 2; credit.position.set(x + 0.006, 1.45, WIN.w / 2 + 0.45); scene.add(credit);
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w, wh), new THREE.MeshPhysicalMaterial({
      color: 0xdfe8f0, transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0, envMapIntensity: 1.4, depthWrite: false }));
    glass.rotation.y = Math.PI / 2; glass.position.set(x - 0.05, cy, 0); scene.add(glass);
    var black = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.4, metalness: 0.6 });
    var white = new THREE.MeshStandardMaterial({ color: 0xf3f2ee, roughness: 0.9 });
    // reveals (wall thickness) and black steel mullions
    [[0.25, 0.02, WIN.w, x - 0.125, WIN.y0, 0, white], [0.25, 0.02, WIN.w, x - 0.125, WIN.y1, 0, white],
     [0.25, wh, 0.02, x - 0.125, cy, -WIN.w / 2, white], [0.25, wh, 0.02, x - 0.125, cy, WIN.w / 2, white]].forEach(function (b) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(b[0], b[1], b[2]), b[6]); m.position.set(b[3], b[4], b[5]); scene.add(m);
    });
    for (var i = 0; i <= 4; i++) {
      var z = -WIN.w / 2 + WIN.w * i / 4;
      var mu = new THREE.Mesh(new THREE.BoxGeometry(0.06, wh, 0.05), black); mu.position.set(x - 0.06, cy, z); scene.add(mu);
    }
    [WIN.y0 + 0.02, WIN.y1 - 0.02].forEach(function (y) { var t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, WIN.w), black); t.position.set(x - 0.06, y, 0); scene.add(t); });
    var dusk = new THREE.PointLight(0x7f96e0, 2.0, 8, 1.5); dusk.position.set(x + 0.8, cy, 0); scene.add(dusk);
  })();

  /* ---------- live Boston through the window ----------
     A 24/7 YouTube live cam plays in a real <iframe> placed in 3D (CSS 3D
     transforms, same camera) 14 m behind the glass; the WebGL scene punches a
     transparent hole exactly over it so the city shows through. The photo
     panorama stays around it and is all you see if no stream is playing.
     Streams are third-party and can go offline, so several are tried in order. */
  var LIVE_CAMS = ['BBlaNNmUJy8', 'UZ20XjGsCCs', '3I_cIS24AfY'];   // Boston live cams: Back Bay/Charles, Charles River, Harbor
  var live = (function () {
    var layer = document.createElement('div'), camEl = document.createElement('div'), box = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0;background:#fff';
    camEl.style.cssText = 'position:absolute;left:0;top:0;transform-style:preserve-3d';
    var PX_W = 1920, PX_H = 1080, W = 48, H = W * 9 / 16;
    box.style.cssText = 'position:absolute;width:' + PX_W + 'px;height:' + PX_H + 'px;background:#000;backface-visibility:hidden';
    var mount = document.createElement('div'); box.appendChild(mount);
    camEl.appendChild(box); layer.appendChild(camEl);
    canvas.parentNode.insertBefore(layer, canvas); canvas.style.zIndex = 1;
    // where the video sits in the world (behind the left-wall window, facing into the room)
    var anchor = new THREE.Object3D();
    anchor.position.set(-ROOM.w / 2 - 14, 3.2, 0); anchor.rotation.y = Math.PI / 2; anchor.scale.set(W / PX_W, H / PX_H, 1);
    scene.add(anchor);
    var hole = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending }));
    hole.position.copy(anchor.position); hole.rotation.copy(anchor.rotation); hole.visible = false; scene.add(hole);

    function ep(v) { return Math.abs(v) < 1e-10 ? 0 : v; }
    function camCss(m) { var e = m.elements; return 'matrix3d(' + [e[0], -e[1], e[2], e[3], e[4], -e[5], e[6], e[7], e[8], -e[9], e[10], e[11], e[12], -e[13], e[14], e[15]].map(ep).join(',') + ')'; }
    function objCss(m) { var e = m.elements; return 'translate(-50%,-50%)matrix3d(' + [e[0], e[1], e[2], e[3], -e[4], -e[5], -e[6], -e[7], e[8], e[9], e[10], e[11], e[12], e[13], e[14], e[15]].map(ep).join(',') + ')'; }
    function render() {
      // always kept positioned (and technically on screen) so the player is never
      // "hidden" — YouTube won't autoplay a hidden player
      var w = canvas.clientWidth, h = canvas.clientHeight, fov = camera.projectionMatrix.elements[5] * h / 2;
      layer.style.perspective = fov + 'px';
      camera.updateMatrixWorld(); anchor.updateMatrixWorld();
      camEl.style.width = w + 'px'; camEl.style.height = h + 'px';
      camEl.style.transform = 'translateZ(' + fov + 'px)' + camCss(camera.matrixWorldInverse) + 'translate(' + w / 2 + 'px,' + h / 2 + 'px)';
      box.style.transform = objCss(anchor.matrixWorld);
    }
    // YouTube IFrame API: muted autoplay; the hole only opens while a stream is actually playing
    var idx = 0, player = null, watchdog = null, playing = false;
    function show(on) { playing = on; hole.visible = on; box.style.opacity = on ? '1' : '0.01'; }
    function fresh() { if (player) { try { player.destroy(); } catch (e) {} } player = null; box.textContent = ''; var m = document.createElement('div'); box.appendChild(m); return m; }
    function kick() {                                          // (re)start playback and jump to the live edge
      if (!player || !player.playVideo) return;
      try { player.mute(); player.playVideo(); var d = player.getDuration && player.getDuration(); if (d > 0) player.seekTo(d, true); } catch (e) {}
    }
    function tryNext() {
      show(false);
      if (idx >= LIVE_CAMS.length) { idx = 0; return setTimeout(tryNext, 5 * 60e3); }   // all down: photo now, try again in 5 min
      var id = LIVE_CAMS[idx++];
      clearTimeout(watchdog); watchdog = setTimeout(function () { if (!playing) { fresh(); tryNext(); } }, 20000);
      player = new YT.Player(fresh(), {
        width: PX_W, height: PX_H, videoId: id,
        playerVars: { autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, playsinline: 1, modestbranding: 1 },
        events: {
          onReady: function () { kick(); },
          onStateChange: function (e) {
            if (e.data === 1) { clearTimeout(watchdog); show(true); }              // playing
            else if (e.data === 0) { show(false); setTimeout(kick, 3000); }        // stream ended/stalled: back to live
            else if (e.data === 2 || e.data === -1 || e.data === 5) { show(false); setTimeout(kick, 1500); }   // paused / not started
          },
          onError: function () { clearTimeout(watchdog); fresh(); tryNext(); }
        }
      });
    }
    // keep it live: every 10 min (and whenever you come back to the tab) snap to the live edge
    setInterval(function () { if (playing) kick(); }, 10 * 60e3);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
    // browsers that still block autoplay (e.g. Safari Low Power Mode) get it on the first touch, drag or key
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, function () { if (!playing) kick(); }, { passive: true }); });
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () { if (prev) prev(); tryNext(); };
    var tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; tag.async = true; document.head.appendChild(tag);
    return { render: render };
  })();

  /* ---------- straight gallery track lighting ----------
     black ceiling tracks running parallel to each wall, 1 m in from it;
     every artwork gets its own spot can on the track aimed at it (see addCan). */
  var TRACK_IN = 1.0, trackMat = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.45, metalness: 0.5 });
  [[0, -ROOM.d / 2 + TRACK_IN, ROOM.w - 2 * TRACK_IN, 0], [0, ROOM.d / 2 - TRACK_IN, ROOM.w - 2 * TRACK_IN, 0],
   [-ROOM.w / 2 + TRACK_IN, 0, ROOM.d - 2 * TRACK_IN, 1], [ROOM.w / 2 - TRACK_IN, 0, ROOM.d - 2 * TRACK_IN, 1]].forEach(function (t) {
    var rail = new THREE.Mesh(t[3] ? new THREE.BoxGeometry(0.04, 0.035, t[2]) : new THREE.BoxGeometry(t[2], 0.035, 0.04), trackMat);
    rail.position.set(t[0], ROOM.h - 0.018, t[1]); scene.add(rail);
  });
  var canMat = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.4, metalness: 0.6 });
  var lensMat = new THREE.MeshBasicMaterial({ color: 0xfff4e0, toneMapped: false });
  // a cylindrical spot can hanging from the track, pointed at `target`; moves the light to its lens
  function addCan(spot, target) {
    var top = new THREE.Vector3(spot.position.x, ROOM.h - 0.035, spot.position.z);
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), canMat);
    stem.position.copy(top).add(new THREE.Vector3(0, -0.045, 0)); scene.add(stem);
    var pivot = top.clone().add(new THREE.Vector3(0, -0.1, 0));
    var dir = target.clone().sub(pivot).normalize();
    var can = new THREE.Group(); can.position.copy(pivot);
    can.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.17, 24), canMat); body.position.y = -0.06; can.add(body);
    var lens = new THREE.Mesh(new THREE.CircleGeometry(0.032, 24), lensMat); lens.rotation.x = Math.PI / 2; lens.position.y = -0.146; can.add(lens);
    scene.add(can);
    spot.position.copy(pivot).addScaledVector(dir, 0.16);
  }
  // soft general fill so the room isn't black between the spot pools
  [[-2.5, 0], [2.5, 0]].forEach(function (p) { var f = new THREE.PointLight(0xfffaf2, 2.2, 9, 1.5); f.position.set(p[0], ROOM.h - 0.4, p[1]); scene.add(f); });

  /* ---------- Persian rug + a simple gallery bench on it ---------- */
  (function rugAndBench() {
    var RW = 4.4, RL = 6.05, RZ = -1.6;
    var rugMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    var rug = new THREE.Mesh(new THREE.BoxGeometry(RW, 0.01, RL), [baseRug(), baseRug(), rugMat, baseRug(), baseRug(), baseRug()]);
    function baseRug() { return new THREE.MeshStandardMaterial({ color: 0x3a0d12, roughness: 1 }); }
    rug.position.set(0, 0.006, RZ); rug.receiveShadow = true; scene.add(rug);
    new THREE.TextureLoader().load('assets/museum/rug-persian.jpg', function (t) {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; rugMat.map = t; rugMat.bumpMap = t; rugMat.bumpScale = 0.8; rugMat.needsUpdate = true;
    });
    // bench: a long walnut slab on two black steel sled legs
    var wood = new THREE.MeshStandardMaterial({ color: 0x5a3b26, roughness: 0.55, metalness: 0 });
    var steel = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.4, metalness: 0.7 });
    var BL = 1.7, BD = 0.42, BH = 0.44;
    var seat = new THREE.Mesh(new THREE.BoxGeometry(BL, 0.06, BD), wood);
    seat.position.set(0, BH, RZ); seat.castShadow = seat.receiveShadow = true; scene.add(seat);
    [-1, 1].forEach(function (s) {
      var x = s * (BL / 2 - 0.22);
      [[0.025, BH - 0.03, 0.025, x, (BH - 0.03) / 2, RZ - BD / 2 + 0.06], [0.025, BH - 0.03, 0.025, x, (BH - 0.03) / 2, RZ + BD / 2 - 0.06],
       [0.025, 0.025, BD - 0.1, x, 0.0125 + 0.012, RZ], [0.025, 0.025, BD - 0.1, x, BH - 0.045, RZ]].forEach(function (b) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(b[0], b[1], b[2]), steel); m.position.set(b[3], b[4], b[5]); m.castShadow = true; scene.add(m);
      });
    });
  })();

  /* ---------- raised viewing platform + guardrail along the left wall ----------
     black studded rubber deck, white skirt, black steel rail on its open edge */
  (function platform() {
    var D = 1.05, Hh = 0.16, L = ROOM.d - 1.2, x0 = -ROOM.w / 2 + D / 2;
    var studs = canvasTex(256, 256, function (ctx, w, h) {
      ctx.fillStyle = '#2a2b2e'; ctx.fillRect(0, 0, w, h);
      for (var y = 16; y < h; y += 32) for (var x = (y / 32) % 2 ? 32 : 16; x < w; x += 32) {
        var g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10); g.addColorStop(0, '#5c5e63'); g.addColorStop(1, '#2a2b2e');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      }
    });
    var bump = canvasTex(256, 256, function (ctx, w, h) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (var y = 16; y < h; y += 32) for (var x = (y / 32) % 2 ? 32 : 16; x < w; x += 32) {
        var g = ctx.createRadialGradient(x, y, 0, x, y, 10); g.addColorStop(0, '#fff'); g.addColorStop(1, '#000');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
      }
    }, false);
    [studs, bump].forEach(function (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(D * 4, L * 4); });
    var deckMat = new THREE.MeshStandardMaterial({ map: studs, bumpMap: bump, bumpScale: 1.2, roughness: 0.55, metalness: 0.1 });
    var skirt = new THREE.MeshStandardMaterial({ color: 0xf2f1ee, roughness: 0.8 });
    var deck = new THREE.Mesh(new THREE.BoxGeometry(D, Hh, L), [skirt, skirt, deckMat, skirt, skirt, skirt]);
    deck.position.set(x0, Hh / 2, 0); deck.receiveShadow = deck.castShadow = true; scene.add(deck);
    var steel = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.35, metalness: 0.7 });
    var railX = x0 + D / 2 - 0.04, top = Hh + 0.92;
    var bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, L - 0.1), steel); bar.position.set(railX, top, 0); bar.castShadow = true; scene.add(bar);
    var mid = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, L - 0.1), steel); mid.position.set(railX, Hh + 0.46, 0); scene.add(mid);
    for (var z = -L / 2 + 0.05; z <= L / 2 - 0.04; z += (L - 0.1) / 5) {
      var post = new THREE.Mesh(new THREE.BoxGeometry(0.035, top - Hh, 0.035), steel);
      post.position.set(railX, Hh + (top - Hh) / 2, z); post.castShadow = true; scene.add(post);
    }
  })();

  /* ---------- the neon wall: pink RMLUR neon over a wheat-paste mural of the
     brand's art (assets/museum/mural-rmlur.webp, transparent PNG pieces) ---------- */
  function neonTex() {
    return canvasTex(2048, 1100, function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      function tubes(text, font, x, y) {
        ctx.save(); ctx.translate(x, y); ctx.transform(1, -0.06, -0.18, 1, 0, 0); ctx.font = font;
        [[46, 'rgba(255,40,200,.22)', 90], [22, '#ff3fd4', 40], [8, '#ffd3f6', 12]].forEach(function (t) {   // bloom, tube, hot core
          ctx.shadowColor = '#ff2fd0'; ctx.shadowBlur = t[2]; ctx.lineWidth = t[0]; ctx.strokeStyle = t[1]; ctx.strokeText(text, 0, 0);
        });
        ctx.restore();
      }
      tubes('RMLUR', 'italic 900 400px "Arial Black", Impact, "Helvetica Neue", sans-serif', w / 2, h * 0.36);
      tubes('deux SEXES', 'italic 900 210px "Arial Black", Impact, "Helvetica Neue", sans-serif', w / 2 + 40, h * 0.79);
      function star(cx, cy, r) {
        ctx.beginPath();
        for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        ctx.closePath(); ctx.lineJoin = 'round';
        ctx.shadowColor = '#ff2fd0'; ctx.shadowBlur = 30; ctx.lineWidth = 12; ctx.strokeStyle = '#ff3fd4'; ctx.stroke();
        ctx.shadowBlur = 8; ctx.lineWidth = 4; ctx.strokeStyle = '#ffd3f6'; ctx.stroke();
      }
      star(w * 0.39, h * 0.1, 46); star(w * 0.47, h * 0.19, 34); star(w * 0.83, h * 0.62, 40);
    });
  }
  (function neonWall() {
    var W = WALLS.front;
    var mural = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 4.7 * 1500 / 3200),
      new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.04, roughness: 0.9, opacity: 0 }));
    new THREE.TextureLoader().load('assets/museum/mural-rmlur.webp', function (t) {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; mural.material.map = t; mural.material.opacity = 1; mural.material.needsUpdate = true;
    });
    mural.position.copy(W.pos); mural.position.y = 2.85; mural.rotation.y = W.rot; mural.translateZ(0.006); mural.receiveShadow = true; scene.add(mural);
    var neon = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 3.9 * 1100 / 2048),
      new THREE.MeshBasicMaterial({ map: neonTex(), transparent: true, depthWrite: false, toneMapped: false }));
    neon.position.copy(W.pos); neon.position.y = 2.95; neon.rotation.y = W.rot; neon.translateZ(0.09); scene.add(neon);
    // the neon throws pink onto the wall, the mural and the concrete
    var glow = new THREE.PointLight(0xff2fd0, 14, 7.5, 1.4);
    glow.position.copy(W.pos); glow.position.y = 3.0; glow.rotation.y = W.rot; glow.translateZ(0.6); scene.add(glow);
  })();

  // vinyl wall lettering, like a gallery title wall
  function wallText(text, sub, wall, y, width) {
    var tex = canvasTex(2048, 360, function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#1b1b1b'; ctx.textAlign = 'center';
      ctx.font = '600 150px "IBM Plex Mono", monospace'; ctx.fillText(text, w / 2, 170);
      if (sub) { ctx.font = '400 54px "IBM Plex Mono", monospace'; ctx.fillStyle = '#6b675e'; ctx.fillText(sub, w / 2, 290); }
    });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 360 / 2048),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    var W = WALLS[wall]; m.position.copy(W.pos); m.position.y = y; m.rotation.y = W.rot; m.translateZ(0.005);
    scene.add(m);
  }

  // the chrome RMLUR belt (cut-out PNG) as the gallery title over the back wall
  function beltSign() {
    var W = WALLS.back, w = 2.5;
    var mat = new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.08, roughness: 0.45, metalness: 0, opacity: 0 });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 245 / 620), mat);
    loadTex('assets/museum/rmlur-belt.png', function (t) { mat.map = t; mat.opacity = 1; mat.needsUpdate = true; });
    m.position.copy(W.pos); m.position.y = 3.5; m.rotation.y = W.rot; m.translateZ(0.03); m.castShadow = true; scene.add(m);
    var spot = new THREE.SpotLight(0xffffff, 5, 6, 0.42, 0.8, 1.6);
    spot.position.set(0, ROOM.h - 0.05, W.pos.z + 1.0); spot.target.position.set(0, 3.5, W.pos.z); addCan(spot, spot.target.position); scene.add(spot); scene.add(spot.target);
  }

  /* ---------- light ---------- */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d3ca, 0.8));
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  var key = new THREE.DirectionalLight(0xffffff, 0.5);
  key.position.set(2, 6, 4); scene.add(key);

  // Soft studio reflections so gold/platinum read as metal, not brown plastic:
  // a white box with a few bright ceiling panels, prefiltered into an env map.
  (function studioEnv() {
    var env = new THREE.Scene();
    var box = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), new THREE.MeshBasicMaterial({ color: 0x9a9894, side: THREE.BackSide }));
    env.add(box);
    var panel = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [[-4, 4.9, -3], [4, 4.9, -3], [0, 4.9, 4], [-9.9, 2, 0], [9.9, 2, 0]].forEach(function (p, i) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(i < 3 ? 0.6 : 6, i < 3 ? 7 : 3), panel);   // ceiling entries = long thin strips
      m.position.set(p[0], p[1], p[2]);
      if (i < 3) m.rotation.x = Math.PI / 2; else m.rotation.y = p[0] < 0 ? Math.PI / 2 : -Math.PI / 2;
      env.add(m);
    });
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.04).texture;
    scene.environmentIntensity = 0.9;
  })();

  /* ---------- plaques ---------- */
  var CERT = {
    gold:     { color: 0xd8b25a, label: 'GOLD' },
    platinum: { color: 0xe6e6e8, label: 'PLATINUM' },
    diamond:  { color: 0xf2f5fa, label: 'DIAMOND' },
    silver:   { color: 0xc9cccf, label: 'SILVER' }
  };
  function certInfo(cert) {
    if (!cert || cert === 'none') return null;
    var m = /^multi-platinum:(\d+)$/.exec(cert);
    if (m) return { color: CERT.silver.color, label: m[1] + '× PLATINUM' };
    return CERT[cert] || null;
  }

  // Height map for a real record face: fine grooves, smooth gaps between tracks,
  // a flat run-out ring by the label and a raised lip at the edge. The disc
  // geometry is a CircleGeometry whose UVs map 0..1 across the diameter.
  function grooveTex() {
    return canvasTex(2048, 2048, function (ctx, w, h) {
      var cx = w / 2, cy = h / 2, R = w / 2;
      ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
      var gaps = [0.52, 0.64, 0.75, 0.87];          // track breaks (fraction of radius)
      ctx.lineWidth = 1.3;
      for (var r = 0.40 * R; r < 0.965 * R; r += 2.6) {
        var f = r / R;
        if (gaps.some(function (g) { return Math.abs(f - g) < 0.009; })) continue;
        ctx.strokeStyle = (Math.round(r / 2.6) % 2) ? 'rgba(60,60,60,.55)' : 'rgba(205,205,205,.55)';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
      // raised outer lip
      ctx.lineWidth = 0.022 * R; ctx.strokeStyle = '#b8b8b8';
      ctx.beginPath(); ctx.arc(cx, cy, 0.985 * R, 0, Math.PI * 2); ctx.stroke();
    }, false);
  }
  var GROOVES = grooveTex();

  // Colour map for the record face: the radial "pie-wedge" sheen real gold
  // records show (light catching the grooves), plus visible groove rings and
  // track gaps. Baked in so it reads the same under any lighting.
  function discFaceTex(base) {
    return canvasTex(2048, 2048, function (ctx, w, h) {
      var cx = w / 2, cy = h / 2, R = w / 2;
      var light = base.light, mid = base.mid, dark = base.dark;
      // conic sheen (older Safari has no createConicGradient → flat base tone)
      var cg = ctx.createConicGradient ? ctx.createConicGradient(-Math.PI / 2 + 0.35, cx, cy) : null;
      if (cg) {
        [[0, mid], [0.06, light], [0.13, mid], [0.25, dark], [0.36, mid], [0.44, light], [0.5, mid],
         [0.56, light], [0.63, mid], [0.75, dark], [0.86, mid], [0.94, light], [1, mid]]
          .forEach(function (st) { cg.addColorStop(st[0], st[1]); });
      }
      ctx.fillStyle = cg || mid; ctx.fillRect(0, 0, w, h);
      // soft overall falloff toward the rim
      var rg = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R);
      rg.addColorStop(0, 'rgba(255,255,255,0.10)'); rg.addColorStop(1, 'rgba(0,0,0,0.10)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
      var gaps = [0.52, 0.64, 0.75, 0.87];
      for (var r = 0.40 * R; r < 0.965 * R; r += 3.2) {
        var f = r / R, isGap = gaps.some(function (g) { return Math.abs(f - g) < 0.009; });
        if (isGap) continue;
        ctx.strokeStyle = base.groove; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
      gaps.forEach(function (g0) {      // track gaps catch the light as bright rings
        ctx.strokeStyle = base.gap; ctx.lineWidth = 0.006 * R;
        ctx.beginPath(); ctx.arc(cx, cy, g0 * R, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.strokeStyle = base.gap; ctx.lineWidth = 0.028 * R;                 // dead wax ring by the label
      ctx.beginPath(); ctx.arc(cx, cy, 0.385 * R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = base.dark; ctx.lineWidth = 0.02 * R;                 // outer lip
      ctx.beginPath(); ctx.arc(cx, cy, 0.985 * R, 0, Math.PI * 2); ctx.stroke();
    });
  }
  var DISC_FACES = {};
  function discFace(kind) {
    var tones = {
      gold:     { light: '#fff4cf', mid: '#d9bf7a', dark: '#8f763c', groove: 'rgba(90,70,30,.22)', gap: 'rgba(255,248,220,.28)' },
      platinum: { light: '#ffffff', mid: '#d4d6d9', dark: '#8a8d92', groove: 'rgba(60,60,70,.2)', gap: 'rgba(255,255,255,.3)' },
      vinyl:    { light: '#5a5a5c', mid: '#1c1c1d', dark: '#070707', groove: 'rgba(0,0,0,.35)', gap: 'rgba(120,120,125,.35)' }
    };
    return DISC_FACES[kind] || (DISC_FACES[kind] = discFaceTex(tones[kind]));
  }

  // Fine linen weave for the charcoal mat
  var LINEN = canvasTex(512, 512, function (ctx, w, h) {
    ctx.fillStyle = '#2f2f31'; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < w; i += 2) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.025 + Math.random() * 0.03) + ')'; ctx.fillRect(i, 0, 1, h);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.04 + Math.random() * 0.05) + ')'; ctx.fillRect(0, i, w, 1);
    }
    grain(ctx, w, h, 10);
  });
  LINEN.wrapS = LINEN.wrapT = THREE.RepeatWrapping; LINEN.repeat.set(3, 4);

  // Brushed, slightly worn finish for the gilt frame moulding
  var GILT_BUMP = canvasTex(512, 64, function (ctx, w, h) {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 260; i++) {
      ctx.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '40,40,40' : '220,220,220') + ',' + (0.1 + Math.random() * 0.25) + ')';
      var y = Math.random() * h; ctx.beginPath(); ctx.moveTo(Math.random() * w, y); ctx.lineTo(Math.random() * w, y + (Math.random() - 0.5) * 2); ctx.stroke();
    }
  }, false);
  GILT_BUMP.wrapS = GILT_BUMP.wrapT = THREE.RepeatWrapping;

  function placeholderCover(p) {
    return canvasTex(512, 512, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2a2723'); g.addColorStop(1, '#4b443b');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, 10);
      ctx.fillStyle = '#efe9da'; ctx.textAlign = 'center';
      fitText(ctx, (p.artist || '').toUpperCase(), w / 2, h / 2 - 10, w - 60, 46, '600', '"IBM Plex Mono", monospace');
      ctx.fillStyle = 'rgba(239,233,218,.7)';
      fitText(ctx, p.album || '', w / 2, h / 2 + 40, w - 60, 26, '400', '"IBM Plex Mono", monospace');
    });
  }
  function coverTex(p) {
    var t = placeholderCover(p);
    if (p.cover) {
      new THREE.TextureLoader().load(p.cover, function (real) {
        real.colorSpace = THREE.SRGBColorSpace; t.image = real.image; t.needsUpdate = true;
      });
    }
    return t;
  }

  var SERIF = 'Georgia, "Times New Roman", serif';
  var PLATE_FONT = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  var CERT_UNITS = { gold: '500,000', platinum: '1,000,000', diamond: '10,000,000' };
  function certUnits(cert) {
    var m = /^multi-platinum:(\d+)$/.exec(cert || '');
    return m ? Number(m[1]).toLocaleString('en-US') + ',000,000' : CERT_UNITS[cert];
  }

  // Printed paper record label for the centre of the disc
  function recordLabelTex(p) {
    return canvasTex(1024, 1024, function (ctx, w, h) {
      var cx = w / 2, cy = h / 2, R = w / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, p.labelColor || '#f3f6f8'); g.addColorStop(1, '#dfe6ea');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, 6);
      ctx.fillStyle = '#2c3d52'; ctx.textAlign = 'center';
      // label name as a simple wordmark (text only — never a real label's logo)
      fitText(ctx, (p.label || 'RMLUR').split('/').pop().trim().toUpperCase(), cx, 250, 600, 64, '600', SERIF);
      ctx.fillStyle = '#1d1d1d';
      ctx.font = '600 34px ' + SERIF; ctx.textAlign = 'right'; ctx.fillText('SIDE 1', cx + 330, 360);
      ctx.fillText(p.format === 'single' ? '45 RPM' : '33⅓ RPM', cx + 330, 395);
      ctx.textAlign = 'left'; ctx.fillText('STEREO', cx - 330, 380);
      ctx.textAlign = 'center';
      fitText(ctx, ((p.artist || '') + ' / ' + (p.album || '')).toUpperCase(), cx, 640, 720, 40, '700', SERIF);
      ctx.font = '400 22px ' + SERIF; ctx.textAlign = 'left';
      [(p.track || 1) + '. ' + (p.song || ''), 'Produced by ' + (p.producers || 'JayRewind')].forEach(function (t, i) {
        fitText(ctx, t, cx - 300, 700 + i * 40, 600, 30, '400', SERIF);
      });
      ctx.textAlign = 'center'; ctx.font = '400 15px ' + SERIF; ctx.fillStyle = '#555';
      ctx.fillText('℗ ' + (p.released ? p.released.slice(0, 4) : '') + ' ' + (p.label || '') + ' • All rights reserved', cx, 800);
      ctx.restore();
      // spindle hole
      ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
    });
  }

  // Engraved brass plate: award wording on the left, round seal on the right.
  function plateTex(p, presentedTo) {
    var c = certInfo(p.cert);
    return canvasTex(1400, 560, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#c7a85a'); g.addColorStop(.45, '#ead48e'); g.addColorStop(.7, '#d6b867'); g.addColorStop(1, '#b8954a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < h; i += 2) { ctx.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.05 + ')'; ctx.fillRect(0, i, w, 1); }
      grain(ctx, w, h, 6);
      ctx.strokeStyle = 'rgba(90,65,20,.45)'; ctx.lineWidth = 4; ctx.strokeRect(14, 14, w - 28, h - 28);

      var textCx = w * 0.36, maxW = w * 0.64;
      ctx.fillStyle = '#3a2c12'; ctx.textAlign = 'center';
      var single = p.format === 'single';
      var awarded = (single ? (p.song || p.album) : (p.album || p.song)) || '';
      var lines = p.milestone
        ? [['PRESENTED TO', 30], [presentedTo.toUpperCase(), 46],
           ['TO COMMEMORATE MORE THAN', 34],
           [Number(p.milestone).toLocaleString('en-US') + ' STREAMS OF', 34],
           ['“' + (p.song || '').toUpperCase() + '”', 44],
           [(p.artist || '').toUpperCase(), 36],
           [(p.album && p.album !== p.song ? p.album : 'SINGLE').toUpperCase(), 28]]
        : c
        ? [['PRESENTED TO', 30], [presentedTo.toUpperCase(), 46],
           ['TO COMMEMORATE THE SALE OF MORE THAN', 34],
           [certUnits(p.cert) + (single ? ' UNITS OF THE' : ' COPIES OF THE'), 34],
           [((p.label || '').split('/').pop() || '').trim().toUpperCase(), 46],
           [single ? 'SINGLE' : 'LONG PLAYING RECORD ALBUM', 30],
           ['“' + awarded.toUpperCase() + '”', 42]]
        : [['PRESENTED TO', 30], [presentedTo.toUpperCase(), 46],
           ['IN RECOGNITION OF PRODUCTION ON', 34],
           ['“' + (p.song || '').toUpperCase() + '”', 42],
           [(p.artist || '').toUpperCase(), 40],
           [(p.album || '').toUpperCase(), 30]];
      // condensed engraved caps, vertically centred like the reference plate
      var total = lines.reduce(function (a, l) { return a + l[1] + 18; }, -18);
      var y = (h - total) / 2 + lines[0][1] * 0.8;
      lines.forEach(function (l) { fitText(ctx, l[0], textCx, y, maxW, l[1], '600', PLATE_FONT); y += l[1] + 18; });

      // seal: engraved ring with lettering around the edge
      var sx = w * 0.825, sy = h / 2, sr = h * 0.37;
      ctx.strokeStyle = '#3a2c12'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, sr * 0.66, 0, Math.PI * 2); ctx.stroke();
      // scalloped edge like a stamped seal
      for (var k = 0; k < 64; k++) {
        var a = k / 64 * Math.PI * 2;
        ctx.beginPath(); ctx.arc(sx + Math.cos(a) * (sr + 9), sy + Math.sin(a) * (sr + 9), 5, 0, Math.PI * 2); ctx.fillStyle = '#3a2c12'; ctx.fill();
      }
      function ringText(text, radius, start, end, size, flip) {
        ctx.save(); ctx.translate(sx, sy); ctx.font = '700 ' + size + 'px ' + SERIF; ctx.fillStyle = '#3a2c12';
        var chars = text.split(''), step = (end - start) / Math.max(1, chars.length - 1);
        chars.forEach(function (ch, i) {
          var a = start + step * i;
          // bottom arc: letters stay upright (tops toward the centre) and read left→right
          ctx.save(); ctx.rotate(a); ctx.translate(0, flip ? radius : -radius);
          ctx.textAlign = 'center'; ctx.fillText(ch, 0, size * 0.35); ctx.restore();
        });
        ctx.restore();
      }
      if (p.milestone) {
        ringText('STREAMING', sr * 0.82, -0.95, 0.95, 34, false);
        ringText('MILESTONE', sr * 0.82, 1.05, -1.05, 32, true);
        ctx.fillStyle = '#3a2c12'; ctx.textAlign = 'center';
        var mm = p.milestone >= 1e6 ? Math.round(p.milestone / 1e6) + 'M' : Math.round(p.milestone / 1e3) + 'K';
        fitText(ctx, mm, sx, sy + 34, sr * 1.1, 110, '700', SERIF);
      } else if (c) {
        ringText('CERTIFIED', sr * 0.82, -0.95, 0.95, 34, false);
        ringText('SALES AWARD', sr * 0.82, 1.1, -1.1, 32, true);
        ctx.fillStyle = '#3a2c12'; ctx.textAlign = 'center';
        fitText(ctx, (p.certBody || 'RIAA').toUpperCase(), sx, sy + 30, sr * 1.18, 96, '700', SERIF);
        ctx.beginPath(); ctx.moveTo(sx - 18, sy + 44); ctx.lineTo(sx + 18, sy + 44); ctx.lineTo(sx, sy + 66); ctx.closePath(); ctx.fill();
      } else {
        ringText('RMLUR', sr * 0.83, -0.7, 0.7, 30, false);
        ringText('DEUX SEXES', sr * 0.83, 1.0, -1.0, 28, true);
        ctx.fillStyle = '#3a2c12'; ctx.textAlign = 'center';
        fitText(ctx, 'PROD.', sx, sy + 16, sr * 1.1, 46, '700', SERIF);
      }
    });
  }

  function billboardTex(p) {
    return canvasTex(1024, 1280, function (ctx, w, h) {
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, 6);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      fitText(ctx, (p.title || 'billboard').toLowerCase(), w / 2, 300, w - 160, 190, '700', 'Helvetica, Arial, sans-serif');
      ctx.fillStyle = '#d6d6d6';
      fitText(ctx, (p.headline || '').toUpperCase(), w / 2, 560, w - 160, 64, '600', '"IBM Plex Mono", monospace');
      fitText(ctx, p.detail || '', w / 2, 680, w - 160, 40, '400', '"IBM Plex Mono", monospace');
      if (p.date) fitText(ctx, p.date, w / 2, 780, w - 160, 36, '400', '"IBM Plex Mono", monospace');
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; ctx.strokeRect(70, 70, w - 140, h - 140);
    });
  }

  var plaques = []; // { group, data, focus:Vector3, look:Vector3 }
  var gilt = new THREE.MeshStandardMaterial({ color: 0x8f7638, metalness: 1, roughness: 0.5, bumpMap: GILT_BUMP, bumpScale: 0.35 });
  var liner = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.85 });
  var backing = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

  // Thin gilt moulding: a rounded-profile frame (outer rect minus inner opening)
  // with a bevel, like the reference's narrow gold frame.
  function giltFrame(W, H, band, depth) {
    var shape = roundedRect(W, H, 0.004), hole = roundedRect(W - 2 * band, H - 2 * band, 0.002);
    shape.holes.push(hole);
    var geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.007, bevelSegments: 4, curveSegments: 4 });
    var m = new THREE.Mesh(geo, gilt); m.castShadow = true; m.receiveShadow = true; return m;
  }
  function roundedRect(w, h, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }

  /* ---------- Victorian gilt frame for gold records ----------
     wide carved moulding (scroll/acanthus relief baked into a bump + colour
     map), C-scroll corner ornaments, a shell crest on top and pearl beading
     around the opening. Procedural — no photo texture. */
  function scrollwork(ctx, w, h, mode) {     // mode 'bump' → greys, 'color' → gold tones
    ctx.fillStyle = mode === 'bump' ? '#6a6a6a' : '#b48a3a'; ctx.fillRect(0, 0, w, h);
    var hi = mode === 'bump' ? '#e8e8e8' : '#f6dc8c', lo = mode === 'bump' ? '#202020' : '#5a4118';
    function spiral(cx, cy, r, dir, rot) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.beginPath();
      for (var t = 0; t < Math.PI * 3.2; t += 0.08) { var rr = r * (1 - t / (Math.PI * 3.6)); ctx.lineTo(Math.cos(t * dir) * rr, Math.sin(t * dir) * rr); }
      ctx.lineCap = 'round'; ctx.strokeStyle = lo; ctx.lineWidth = r * 0.34; ctx.stroke();
      ctx.strokeStyle = hi; ctx.lineWidth = r * 0.2; ctx.stroke(); ctx.restore();
    }
    function leaf(x, y, a, L) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath();
      ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.5, -L * 0.35, L, 0); ctx.quadraticCurveTo(L * 0.5, L * 0.35, 0, 0);
      ctx.fillStyle = hi; ctx.fill(); ctx.strokeStyle = lo; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L * 0.1, 0); ctx.lineTo(L * 0.85, 0); ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    for (var y = 0; y < h; y += 128) for (var x = 0; x < w; x += 128) {
      spiral(x + 40, y + 64, 30, 1, 0); spiral(x + 96, y + 64, 30, -1, Math.PI);
      leaf(x + 64, y + 64, -Math.PI / 2, 44); leaf(x + 64, y + 64, Math.PI / 2, 44);
      ctx.fillStyle = hi; ctx.beginPath(); ctx.arc(x + 64, y + 64, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.filter = 'blur(1.5px)'; ctx.drawImage(ctx.canvas, 0, 0); ctx.filter = 'none';
  }
  var ORN_MAP = canvasTex(512, 512, function (ctx, w, h) { scrollwork(ctx, w, h, 'color'); });
  var ORN_BUMP = canvasTex(512, 512, function (ctx, w, h) { scrollwork(ctx, w, h, 'bump'); }, false);
  [ORN_MAP, ORN_BUMP].forEach(function (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); });
  var ornGold = new THREE.MeshStandardMaterial({ color: 0xffe2a0, map: ORN_MAP, bumpMap: ORN_BUMP, bumpScale: 3, metalness: 1, roughness: 0.32, envMapIntensity: 1.1 });
  var ornSmooth = new THREE.MeshStandardMaterial({ color: 0xe8c372, metalness: 1, roughness: 0.25, envMapIntensity: 1.2 });
  function cScroll(r, tube, arc) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 28, arc), ornSmooth); }
  function ornateFrame(W, H, band) {
    var g = new THREE.Group(), ORN = 0.075, OW = W + 2 * ORN, OH = H + 2 * ORN;
    var shape = roundedRect(OW, OH, 0.01); shape.holes.push(roundedRect(W - 2 * band, H - 2 * band, 0.002));
    var body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.024, bevelSize: 0.026, bevelSegments: 6, curveSegments: 6 }), ornGold);
    body.castShadow = body.receiveShadow = true; g.add(body);
    // raised outer bead + inner sight-edge torus-like rims
    [[OW - 0.02, OH - 0.02, 0.009, 0.056], [W - 2 * band + 0.03, H - 2 * band + 0.03, 0.007, 0.058]].forEach(function (r) {
      var sh = roundedRect(r[0], r[1], 0.01), hole = roundedRect(r[0] - 2 * r[2], r[1] - 2 * r[2], 0.008); sh.holes.push(hole);
      var m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 3 }), ornSmooth);
      m.position.z = r[3] - 0.004; g.add(m);
    });
    // pearl beading around the opening
    var iw = W - 2 * band + 0.06, ih = H - 2 * band + 0.06, step = 0.018, pts = [];
    for (var x = -iw / 2; x <= iw / 2; x += step) { pts.push([x, ih / 2]); pts.push([x, -ih / 2]); }
    for (var y = -ih / 2 + step; y < ih / 2; y += step) { pts.push([iw / 2, y]); pts.push([-iw / 2, y]); }
    var pearls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0062, 10, 8), ornSmooth, pts.length), mx = new THREE.Matrix4();
    pts.forEach(function (p, i) { mx.makeTranslation(p[0], p[1], 0.06); pearls.setMatrixAt(i, mx); }); g.add(pearls);
    // corner ornaments: boss + two C-scrolls + an acanthus leaf pointing out
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (c) {
      var k = new THREE.Group(); k.position.set(c[0] * (OW / 2 - 0.045), c[1] * (OH / 2 - 0.045), 0.06);
      k.rotation.z = Math.atan2(c[1], c[0]) - Math.PI / 4;
      var boss = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), ornSmooth); boss.scale.set(1, 1, 0.45); k.add(boss);
      var s1 = cScroll(0.032, 0.007, Math.PI * 1.35); s1.position.set(-0.045, 0.006, 0); s1.rotation.z = -0.3; k.add(s1);
      var s2 = cScroll(0.032, 0.007, Math.PI * 1.35); s2.position.set(0.006, -0.045, 0); s2.rotation.z = Math.PI + 0.9; s2.scale.x = -1; k.add(s2);
      var lf = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 4), ornSmooth); lf.scale.set(1, 1, 0.35); lf.rotation.z = -Math.PI / 4; lf.position.set(0.035, 0.035, 0); k.add(lf);
      g.add(k);
    });
    // shell crest at the top centre + smaller cartouche at the bottom
    function crest(y, sc, flip) {
      var k = new THREE.Group(); k.position.set(0, y, 0.062); k.scale.setScalar(sc); if (flip) k.rotation.z = Math.PI;
      for (var i = 0; i < 9; i++) {
        var a = -Math.PI * 0.42 + i * Math.PI * 0.84 / 8;
        var rib = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.06, 4, 8), ornSmooth);
        rib.position.set(Math.sin(a) * 0.04, Math.cos(a) * 0.04, 0); rib.rotation.z = -a; k.add(rib);
      }
      var base = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), ornSmooth); base.scale.set(1.4, 1, 0.5); k.add(base);
      [-1, 1].forEach(function (sd) { var sc2 = cScroll(0.03, 0.007, Math.PI * 1.25); sc2.position.set(sd * 0.075, -0.004, 0); sc2.rotation.z = sd > 0 ? Math.PI * 0.85 : Math.PI * 0.9; if (sd < 0) sc2.scale.x = -1; k.add(sc2); });
      g.add(k);
    }
    crest(OH / 2 - 0.03, 1.15, false); crest(-OH / 2 + 0.03, 0.75, true);
    return g;
  }

  /* ---------- Billboard chart plaque (white frame, black face) ---------- */
  function billboardFaceTex(p, presentedTo, w, h) {
    return canvasTex(w, h, function (ctx) {
      ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, 4);
      var SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif', M = 70;
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      fitText(ctx, 'billboard', w / 2, 600, w - 2 * M, 230, '800', SANS);
      ctx.fillRect(M, 640, w - 2 * M, 6);
      var ch = (p.charts || [])[0] || {}, ch2 = (p.charts || [])[1];
      // chart box: name + year, header row, highlighted entry; peak box on the right
      var bx = M, by = 690, bw = w - 2 * M - 240, bh = 270;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.strokeRect(bx, by, bw, bh); ctx.strokeRect(bx + bw + 20, by, 220, bh);
      ctx.textAlign = 'left'; fitText(ctx, ch.chart || '', bx + 24, by + 66, bw - 200, 54, '500', SANS);
      ctx.textAlign = 'right'; fitText(ctx, String(p.year || ''), bx + bw - 22, by + 58, 160, 34, '700', SANS);
      ctx.fillRect(bx, by + 92, bw, 4);
      ctx.textAlign = 'left'; ctx.font = '700 20px ' + SANS; ctx.fillText('PEAK', bx + 22, by + 124);
      ctx.fillText('ARTIST', bx + 150, by + 124); ctx.textAlign = 'right'; ctx.fillText('TITLE', bx + bw - 22, by + 124);
      ctx.fillStyle = '#e9577f'; ctx.fillRect(bx + 130, by + 140, bw - 150, 110);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx + 70, by + 195, 40, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b0b0b'; ctx.textAlign = 'center'; ctx.font = '800 46px ' + SANS; ctx.fillText(String(ch.peak || ''), bx + 70, by + 212);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; fitText(ctx, (p.artist || '').toUpperCase(), bx + 150, by + 185, bw - 420, 34, '700', SANS);
      ctx.font = '400 22px ' + SANS; ctx.fillText(((p.label || '').split('/').pop() || '').trim().toUpperCase(), bx + 150, by + 228);
      ctx.textAlign = 'right'; fitText(ctx, (p.song || '').toUpperCase(), bx + bw - 34, by + 228, 260, 34, '700', SANS);
      ctx.textAlign = 'center'; fitText(ctx, '#' + (ch.peak || ''), bx + bw + 130, by + bh / 2 + 62, 190, 170, '800', SANS);
      if (ch2) { ctx.font = '500 30px ' + SANS; ctx.fillText(ch2.chart + ' — peak #' + ch2.peak, w / 2, by + bh + 60); }
      // presentation plate
      var pw = 620, ph = 300, px = (w - pw) / 2, py = h - ph - 70;
      ctx.lineWidth = 4; ctx.strokeRect(px, py, pw, ph); ctx.lineWidth = 2; ctx.strokeRect(px + 12, py + 12, pw - 24, ph - 24);
      var lines = ['PRESENTED TO', presentedTo.toUpperCase(), 'FOR HIS CONTRIBUTION TO', '“' + (p.song || '').toUpperCase() + '”',
        'BY ' + (p.contribution || 'PRODUCING').toUpperCase(), (p.artist || '').toUpperCase()];
      lines.forEach(function (t, i) { fitText(ctx, t, w / 2, py + 64 + i * 42, pw - 80, i === 1 || i === 3 ? 32 : 26, i === 1 || i === 3 ? '700' : '500', SANS); });
    });
  }
  var whiteFrame = new THREE.MeshStandardMaterial({ color: 0xf6f6f4, roughness: 0.55 });
  function buildBillboard(p, presentedTo) {
    var g = new THREE.Group(), W = 0.88, H = 1.19, BAND = 0.045;
    var back = new THREE.Mesh(new THREE.BoxGeometry(W - 0.01, H - 0.01, 0.02), backing); back.position.z = 0.01; back.castShadow = true; g.add(back);
    var shape = roundedRect(W, H, 0.003); shape.holes.push(roundedRect(W - 2 * BAND, H - 2 * BAND, 0.001));
    var fr = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }), whiteFrame);
    fr.castShadow = fr.receiveShadow = true; g.add(fr);
    var fw = W - 2 * BAND, fh = H - 2 * BAND, FZ = 0.021;
    var face = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshStandardMaterial({ map: billboardFaceTex(p, presentedTo, 1024, Math.round(1024 * fh / fw)), roughness: 0.75 }));
    face.position.z = FZ; face.receiveShadow = true; g.add(face);
    // cover (top-left) with a gold 7" record tucked half behind it — gold because the song went gold
    var cs = fw * 0.33, cx = -fw / 2 + 0.07 + cs / 2, cy = fh / 2 - 0.04 - cs / 2;
    var DR = cs * 0.47;
    var discMat = new THREE.MeshPhysicalMaterial({ map: discFace('gold'), metalness: 0.55, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.12, bumpMap: GROOVES, bumpScale: 0.25, envMapIntensity: 0.8 });
    var disc = new THREE.Mesh(new THREE.CircleGeometry(DR, 96), discMat); disc.position.set(cx + cs * 0.62, cy, FZ + 0.003); disc.castShadow = true; g.add(disc);
    var lab = new THREE.Mesh(new THREE.CircleGeometry(DR * 0.42, 64), new THREE.MeshStandardMaterial({ map: recordLabelTex(Object.assign({}, p, { format: 'single', labelColor: '#e9577f' })), roughness: 0.7, transparent: true }));
    lab.position.set(cx + cs * 0.62, cy, FZ + 0.0035); g.add(lab);
    var cov = new THREE.Mesh(new THREE.BoxGeometry(cs, cs, 0.004), new THREE.MeshStandardMaterial({ map: coverTex(p), roughness: 0.6 }));
    cov.position.set(cx, cy, FZ + 0.006); cov.castShadow = true; g.add(cov);
    return g;
  }

  function buildPlaque(p, presentedTo) {
    var g = new THREE.Group();
    // Proportions measured off the reference award (outer frame 0.82 : 1.02)
    var W = 0.86, H = 1.07, BAND = 0.03, D = 0.045;
    var isBoard = p.type === 'billboard';

    var back = new THREE.Mesh(new THREE.BoxGeometry(W - 0.01, H - 0.01, 0.02), backing);
    back.position.z = 0.01; back.castShadow = true; g.add(back);
    if (isBoard) return buildBillboard(p, presentedTo);
    var victorian = p.cert === 'gold';
    var frame = victorian ? ornateFrame(W, H, BAND) : giltFrame(W, H, BAND, D - 0.016); frame.position.z = 0.0; g.add(frame);

    // black liner step just inside the gilt, then the recessed face
    var innerW = W - 2 * BAND, innerH = H - 2 * BAND, LINER = 0.022;
    var linerShape = roundedRect(innerW, innerH, 0.001); linerShape.holes.push(roundedRect(innerW - 2 * LINER, innerH - 2 * LINER, 0.001));
    var linerMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(linerShape, { depth: 0.012, bevelEnabled: false }), liner);
    linerMesh.position.z = 0.02; linerMesh.receiveShadow = true; g.add(linerMesh);
    var FACE_Z = 0.021, faceW = innerW - 2 * LINER, faceH = innerH - 2 * LINER;

    if (isBoard) {
      var face = new THREE.Mesh(new THREE.PlaneGeometry(faceW, faceH), new THREE.MeshStandardMaterial({ map: billboardTex(p), roughness: 0.7 }));
      face.position.z = FACE_Z; face.receiveShadow = true; g.add(face);
      return g;
    }

    var mat = new THREE.Mesh(new THREE.PlaneGeometry(faceW, faceH), new THREE.MeshStandardMaterial({ map: LINEN, roughness: 1 }));
    mat.position.z = FACE_Z; mat.receiveShadow = true; g.add(mat);

    // Record: mirror gold/platinum for an award, glossy black vinyl for a placement
    var c = certInfo(p.cert), DISC_R = faceW * 0.35, DISC_Y = faceH * 0.16;
    var kind = !c ? 'vinyl' : (c.color === CERT.gold.color ? 'gold' : 'platinum');
    var discMat = new THREE.MeshPhysicalMaterial({ map: discFace(kind), metalness: c ? 0.55 : 0, roughness: c ? 0.28 : 0.3,
      clearcoat: c ? 0.6 : 1, clearcoatRoughness: 0.12, bumpMap: GROOVES, bumpScale: 0.25, envMapIntensity: c ? 0.7 : 1 });
    var disc = new THREE.Mesh(new THREE.CircleGeometry(DISC_R, 128), discMat);
    disc.position.set(0, DISC_Y, FACE_Z + 0.004); disc.castShadow = true; g.add(disc);
    var discEdge = new THREE.Mesh(new THREE.CylinderGeometry(DISC_R, DISC_R, 0.003, 128, 1, true), discMat);
    discEdge.rotation.x = Math.PI / 2; discEdge.position.set(0, DISC_Y, FACE_Z + 0.0025); g.add(discEdge);
    var label = new THREE.Mesh(new THREE.CircleGeometry(DISC_R * 0.36, 96),
      new THREE.MeshStandardMaterial({ map: recordLabelTex(p), roughness: 0.75, transparent: true }));
    label.position.set(0, DISC_Y, FACE_Z + 0.0045); g.add(label);

    // bottom row: album cover with a white border (left), brass plate with seal (right)
    var ROW_Y = -faceH * 0.335;
    var coverS = faceW * 0.22;
    var border = new THREE.Mesh(new THREE.BoxGeometry(coverS + 0.012, coverS + 0.012, 0.003), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.7 }));
    border.position.set(-faceW * 0.29, ROW_Y, FACE_Z + 0.0015); border.castShadow = true; g.add(border);
    var cover = new THREE.Mesh(new THREE.PlaneGeometry(coverS, coverS), new THREE.MeshStandardMaterial({ map: coverTex(p), roughness: 0.6 }));
    cover.position.set(-faceW * 0.29, ROW_Y, FACE_Z + 0.0032); g.add(cover);

    var plateW = faceW * 0.46, plateH = plateW * 0.4;
    var brassSide = new THREE.MeshStandardMaterial({ color: 0xc9a85c, metalness: 1, roughness: 0.3 });
    var plate = new THREE.Mesh(new THREE.BoxGeometry(plateW, plateH, 0.003),
      [brassSide, brassSide, brassSide, brassSide,
       new THREE.MeshStandardMaterial({ map: plateTex(p, presentedTo), metalness: 0.75, roughness: 0.3, envMapIntensity: 0.8 }), brassSide]);
    plate.position.set(faceW * 0.17, ROW_Y, FACE_Z + 0.0015); plate.castShadow = true; g.add(plate);
    return g;
  }

  /* ---------- wall pieces: sign, canvas art, credits panel ---------- */
  function loadTex(src, cb) {
    new THREE.TextureLoader().load(src, function (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; cb(t); });
  }
  // the Parental Advisory RMLUR sign: a brushed-metal plate on stand-offs
  function buildSign(p) {
    var g = new THREE.Group(), w = p.w || 1.4, h = w * 0.47;
    var mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.55, roughness: 0.32, envMapIntensity: 0.9 });
    var edge = new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 1, roughness: 0.35 });
    var plate = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), [edge, edge, edge, edge, mat, edge]);
    plate.position.z = 0.045; plate.castShadow = true; g.add(plate);
    loadTex(p.src, function (t) { mat.map = t; mat.needsUpdate = true; h = w * t.image.height / t.image.width; plate.scale.y = h / (w * 0.47); });
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (c) {           // chrome stand-offs
      var s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 16), edge);
      s.rotation.x = Math.PI / 2; s.position.set(c[0] * (w / 2 - 0.05), c[1] * (w * 0.47 / 2 - 0.05), 0.02); g.add(s);
    });
    return g;
  }
  // stretched canvas: image wraps the front, plain gesso sides, a gallery wall label beside it
  function artLabelTex(p) {
    return canvasTex(1024, 640, function (ctx, w, h) {
      ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1b1b1b'; ctx.textBaseline = 'top';
      ctx.font = '600 50px "IBM Plex Mono", monospace'; ctx.fillText(p.artist || 'JayRewind', 56, 52);
      ctx.font = 'italic 600 58px Georgia, serif'; ctx.fillText(p.title || '', 56, 130);
      ctx.font = '400 40px Georgia, serif'; ctx.fillText(p.year || '', 56, 206);
      ctx.fillStyle = '#55524a'; ctx.font = '400 34px "IBM Plex Mono", monospace';
      [p.medium, p.size, p.edition].filter(Boolean).forEach(function (t, i) { ctx.fillText(t, 56, 290 + i * 50); });
      ctx.fillStyle = '#1b1b1b'; ctx.font = '600 44px "IBM Plex Mono", monospace'; ctx.fillText(p.price || '', 56, 470);
      ctx.fillStyle = '#8a877f'; ctx.font = '400 28px "IBM Plex Mono", monospace'; ctx.fillText('tap to purchase', 56, 548);
    }, true);
  }
  function buildArt(p) {
    var g = new THREE.Group(), S = 1.05, D = 0.045;
    var front = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
    var gesso = new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.95 });
    var cv = new THREE.Mesh(new THREE.BoxGeometry(S, S, D), [gesso, gesso, gesso, gesso, front, gesso]);
    cv.position.z = D / 2 + 0.01; cv.castShadow = true; g.add(cv);
    loadTex(p.src, function (t) { front.map = t; front.bumpMap = LINEN; front.bumpScale = 0.6; front.needsUpdate = true; });
    var lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2125), new THREE.MeshStandardMaterial({ map: artLabelTex(p), roughness: 0.8 }));
    lbl.position.set(S / 2 + 0.3, -S / 2 + 0.25, 0.006); lbl.castShadow = true; g.add(lbl);
    return g;
  }
  // credits wall: a white panel listing the newest credits; tap it for all of them
  function buildCredits(p) {
    var g = new THREE.Group(), W = 1.25, H = 1.55;
    var mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    var panel = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.02), [baseMat, baseMat, baseMat, baseMat, mat, baseMat]);
    panel.position.z = 0.02; panel.castShadow = true; g.add(panel);
    fetch(p.src, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (data) {
      p._credits = data;
      mat.map = canvasTex(1024, 1270, function (ctx, w, h) {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#1b1b1b'; ctx.textBaseline = 'top';
        ctx.font = '600 66px "IBM Plex Mono", monospace'; ctx.fillText('CREDITS', 60, 56);
        ctx.fillStyle = '#55524a'; ctx.font = '400 30px "IBM Plex Mono", monospace';
        ctx.fillText(data.count + ' credits · featured first', 60, 140);
        ctx.fillStyle = '#d9d6ce'; ctx.fillRect(60, 196, w - 120, 2);
        data.credits.slice(0, 22).forEach(function (c, i) {
          var y = 222 + i * 44;
          ctx.fillStyle = '#1b1b1b'; ctx.font = '600 28px "IBM Plex Mono", monospace';
          var t = c.title.length > 24 ? c.title.slice(0, 23) + '…' : c.title; ctx.fillText(t, 60, y);
          ctx.fillStyle = '#55524a'; ctx.font = '400 26px "IBM Plex Mono", monospace';
          var a = c.artists.join(', '); a = a.length > 22 ? a.slice(0, 21) + '…' : a; ctx.fillText(a, 560, y);
        });
        ctx.fillStyle = '#8a877f'; ctx.font = '400 28px "IBM Plex Mono", monospace'; ctx.fillText('tap for all ' + data.count + ' →', 60, h - 70);
      }, true);
      mat.needsUpdate = true;
    }).catch(function () {});
    return g;
  }
  // non-plaque pieces hang at fixed spots on their wall (x along the wall, y height)
  var PIECE = { sign: { build: buildSign, x: 0, y: 1.3 }, art: { build: buildArt, x: 3.3, y: EYE }, credits: { build: buildCredits, x: -3.3, y: EYE } };
  function hangPiece(p) {
    var spec = PIECE[p.type], W = WALLS[p.wall] || WALLS.front, g = spec.build(p);
    g.position.copy(W.pos); g.position.y = p.y != null ? p.y : spec.y; g.rotation.y = W.rot;
    g.translateX(p.x != null ? p.x : spec.x); g.translateZ(0.004);
    scene.add(g);
    var spot = new THREE.SpotLight(0xfff6e8, 20, 7, 0.36, 0.65, 1.6);
    var from = g.position.clone(), n = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), W.rot);
    spot.position.copy(from).addScaledVector(n, 1.0); spot.position.y = ROOM.h - 0.05;
    spot.target.position.copy(from); addCan(spot, from); scene.add(spot); scene.add(spot.target);
    plaques.push({ group: g, data: p, look: from.clone(), normal: n.clone() });
  }

  function hang(list, presentedTo) {
    list.filter(function (p) { return PIECE[p.type]; }).forEach(hangPiece);
    list = list.filter(function (p) { return !PIECE[p.type]; });
    var byWall = { back: [], left: [], right: [], front: [] };
    list.forEach(function (p) { (byWall[p.wall] || byWall.back).push(p); });
    Object.keys(byWall).forEach(function (wall) {
      var items = byWall[wall], W = WALLS[wall];
      items.forEach(function (p, i) {
        var g = buildPlaque(p, presentedTo);
        var span = Math.min(W.len - 2, items.length * 2.2);
        var x = items.length === 1 ? 0 : -span / 2 + span * (i / (items.length - 1));
        g.position.copy(W.pos); g.position.y = EYE + 0.05; g.rotation.y = W.rot;
        g.translateX(x); g.translateZ(0.004);
        scene.add(g);
        // gallery spot from the ceiling
        var spot = new THREE.SpotLight(0xfff6e8, 30, 7, 0.3, 0.6, 1.6);
        var from = g.position.clone(), n = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), W.rot);
        spot.position.copy(from).addScaledVector(n, 1.0); spot.position.y = ROOM.h - 0.05;
        spot.target.position.copy(from); addCan(spot, from); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.bias = -0.0004; spot.shadow.radius = 6;
        scene.add(spot); scene.add(spot.target);
        plaques.push({ group: g, data: p, look: from.clone(), normal: n.clone() });
      });
    });
  }

  /* ---------- details card ---------- */
  function row(dl, k, v) {
    if (v == null || v === '') return;
    var dt = document.createElement('dt'); dt.textContent = k;
    var dd = document.createElement('dd'); dd.textContent = v;
    dl.appendChild(dt); dl.appendChild(dd);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function showCard(p) {
    card.textContent = '';
    if (p.type === 'art') return showArtCard(p);
    if (p.type === 'credits') return showCreditsCard(p);
    if (p.type === 'sign') return;
    var h = document.createElement('h2');
    h.textContent = p.type === 'billboard' ? (p.title || 'Billboard') : (p.song || p.album || '');
    card.appendChild(h);
    var sub = document.createElement('div'); sub.className = 'sub';
    sub.textContent = p.type === 'billboard' ? (p.headline || '') : [p.artist, p.album].filter(Boolean).join(' — ');
    card.appendChild(sub);
    var dl = document.createElement('dl');
    if (p.type === 'billboard') { row(dl, 'Detail', p.detail); row(dl, 'Date', p.date); }
    else {
      var c = certInfo(p.cert);
      row(dl, 'Track', p.track ? String(p.track) : null); row(dl, 'Producers', p.producers);
      row(dl, 'Role', p.role); row(dl, 'Label', p.label); row(dl, 'Released', p.released);
      (p.charts || []).forEach(function (ch) { row(dl, 'Chart', ch.chart + ' — peak #' + ch.peak); });
      if (p.tracks && p.tracks.length) row(dl, 'Tracks', p.tracks.join('\n'));
      row(dl, 'Certified', c ? (p.certBody || 'RIAA') + ' ' + (p.certLabel || c.label) : null);
      row(dl, 'Streams', p.streams);
      if (p.billboard) row(dl, 'Billboard', p.billboard.chart + (p.billboard.peak ? ' — peak #' + p.billboard.peak : ''));
    }
    card.appendChild(dl);
    if (p.certNote) { var n = document.createElement('div'); n.className = 'note'; n.textContent = p.certNote; card.appendChild(n); }
    (p.notes || []).forEach(function (t) { card.appendChild(el('div', 'note', t)); });
    if (p.links && p.links.length) {
      var l = document.createElement('div'); l.className = 'note links';
      p.links.forEach(function (u, i) {
        var a = document.createElement('a'); a.href = u.url || u; a.textContent = u.label || 'Listen';
        a.target = '_blank'; a.rel = 'noopener'; if (i) l.appendChild(document.createTextNode(' · ')); l.appendChild(a);
      });
      card.appendChild(l);
    }
    if (p.verified === false) { var t = document.createElement('div'); t.className = 'pending'; t.textContent = 'details pending'; card.appendChild(t); }
    card.classList.add('show');
  }

  function showArtCard(p) {
    card.appendChild(el('h2', null, p.title));
    card.appendChild(el('div', 'sub', [p.artist, p.year].filter(Boolean).join(', ')));
    var dl = el('dl'); row(dl, 'Medium', p.medium); row(dl, 'Size', p.size); row(dl, 'Edition', p.edition); row(dl, 'Price', p.price);
    card.appendChild(dl);
    var buy = el('button', 'buy', 'Purchase'); buy.type = 'button';
    var notice = el('div', 'note notice', 'This piece is held in the RMLUR permanent collection and is not for sale. Go to bed — you have work tomorrow.');
    notice.hidden = true;
    buy.addEventListener('click', function () { notice.hidden = false; buy.disabled = true; buy.textContent = 'Not available'; });
    card.appendChild(buy); card.appendChild(notice);
    card.classList.add('show');
  }
  function fmtPlays(n) { return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K plays' : n + ' plays'; }
  function showCreditsCard(p) {
    var data = p._credits || { credits: [], count: 0 };
    card.appendChild(el('h2', null, 'Credits'));
    card.appendChild(el('div', 'sub', data.count + ' credits — JayRewind'));
    var sections = [
      ['Featured', function (c) { return c.priority; }],
      ['On SoundCloud', function (c) { return !c.priority && c.source === 'soundcloud'; }],
      ['Credited on Muso', function (c) { return c.source !== 'soundcloud'; }]
    ];
    var box = el('div', 'list');
    sections.forEach(function (sec) {
      var items = data.credits.filter(sec[1]); if (!items.length) return;
      box.appendChild(el('div', 'sec', sec[0] + ' (' + items.length + ')'));
      var ol = el('ol');
      items.forEach(function (c) {
        var li = el('li'), t;
        if (c.url) { t = el('a', null, c.title); t.href = c.url; t.target = '_blank'; t.rel = 'noopener'; var b = el('b'); b.appendChild(t); li.appendChild(b); }
        else li.appendChild(el('b', null, c.title));
        var bits = [c.artists.join(', ') + ' (' + c.date.slice(0, 4) + ')', c.roles.join(', ')];
        if (c.coProducers && c.coProducers.length) bits.push('with ' + c.coProducers.join(', '));
        if (c.plays) bits.push(fmtPlays(c.plays));
        li.appendChild(document.createTextNode(' — ' + bits.join(' · ')));
        ol.appendChild(li);
      });
      box.appendChild(ol);
    });
    card.appendChild(box);
    var l = el('div', 'note links'); var a = el('a', null, 'Full profile on Muso'); a.href = (data.sources && data.sources.muso) || data.source || '#'; a.target = '_blank'; a.rel = 'noopener'; l.appendChild(a);
    card.appendChild(l);
    card.classList.add('show');
  }

  /* ---------- look around + walk to a plaque ---------- */
  var yaw = 0, pitch = 0, target = null, anim = null;
  var lookDir = new THREE.Vector3();
  function applyLook() {
    pitch = Math.max(-0.5, Math.min(0.45, pitch));
    lookDir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(camera.position.clone().add(lookDir));
  }
  function anglesTo(from, to) {
    var d = to.clone().sub(from).normalize();
    return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(d.y) };
  }
  function glide(toPos, toYaw, toPitch) {
    var fromPos = camera.position.clone(), fy = yaw, fp = pitch, t0 = performance.now();
    var dy = toYaw - fy; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    anim = function (now) {
      var k = Math.min(1, (now - t0) / 900), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      camera.position.lerpVectors(fromPos, toPos, e); yaw = fy + dy * e; pitch = fp + (toPitch - fp) * e; applyLook();
      if (k >= 1) anim = null;
    };
  }
  // Stand far enough back that the whole plaque fits the screen — on a
  // portrait phone the horizontal field of view is what limits it.
  function focusPoint(pl) {
    var vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    var hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    var dist = Math.max(1.35, (0.86 * 1.12 / 2) / Math.tan(hHalf), (1.07 * (camera.aspect < 0.9 ? 2.1 : 1.15) / 2) / Math.tan(vHalf));
    var p = pl.look.clone().addScaledVector(pl.normal, dist); p.y = EYE;
    return p;
  }
  function focusOn(pl) {
    // portrait: aim below centre so the plaque sits above the details card
    var aim = pl.look.clone(); if (camera.aspect < 0.9) aim.y -= 0.3;
    target = pl; var to = focusPoint(pl), a = anglesTo(to, aim);
    glide(to, a.yaw, a.pitch); showCard(pl.data);
    backBtn.hidden = false; hud.textContent = 'esc or step back to return';
  }
  function stepBack() {
    if (!target) return;
    target = null; card.classList.remove('show'); backBtn.hidden = true;
    hud.textContent = 'drag to look around · tap a plaque, the art or the credits';
    glide(HOME, yaw, 0);
  }
  backBtn.addEventListener('click', stepBack);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') stepBack(); });

  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    var r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(plaques.map(function (p) { return p.group; }), true);
    if (!hits.length) return null;
    var o = hits[0].object;
    return plaques.find(function (p) { var n = o; while (n) { if (n === p.group) return true; n = n.parent; } return false; }) || null;
  }

  var drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) { canvas.classList.toggle('hot', !!pick(e)); return; }
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
    if (drag.moved > 4 && !anim) { canvas.classList.add('dragging'); yaw += dx * 0.004; pitch += dy * 0.003; applyLook(); }
  });
  canvas.addEventListener('pointerup', function (e) {
    var wasClick = drag && drag.moved <= 4; drag = null; canvas.classList.remove('dragging');
    if (!wasClick) return;
    var pl = pick(e);
    if (pl && pl !== target) focusOn(pl); else if (!pl) stepBack();
  });

  /* ---------- go ---------- */
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize(); applyLook();

  fetch('data/placements.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var who = data.presentedTo || 'JayRewind';
      beltSign(); wallText('', who + ' — RMLUR :: deux SEXES', 'back', 3.0, 3.0);
      hang(data.placements || [], who);
    })
    .catch(function (e) { hud.textContent = 'could not load placements'; console.error(e); });

  (function loop(now) {
    if (anim) anim(now);
    renderer.render(scene, camera);
    live.render();
    requestAnimationFrame(loop);
  })(performance.now());
  window.__museum = { scene: scene, camera: camera, plaques: plaques, focusOn: focusOn };
})();
