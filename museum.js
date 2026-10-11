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
  var EYE = 1.6, HOME = new THREE.Vector3(0, EYE, -0.3);

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f3f0);
  var camera = new THREE.PerspectiveCamera(58, 1, 0.05, 60);
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
  var floorTex = canvasTex(1024, 1024, function (ctx, w, h) {
    ctx.fillStyle = '#d9d6cf'; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, 18);
    ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 2;
    for (var x = 0; x <= w; x += w / 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 2.5);
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.0 }));
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
    var m = new THREE.Mesh(new THREE.PlaneGeometry(W.len, ROOM.h), wallMat);
    m.position.copy(W.pos); m.rotation.y = W.rot; m.receiveShadow = true; scene.add(m);
    var base = new THREE.Mesh(new THREE.BoxGeometry(W.len, 0.09, 0.015), baseMat);
    base.position.copy(W.pos); base.position.y = 0.045; base.rotation.y = W.rot;
    base.translateZ(0.008); scene.add(base);
  });

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

  /* ---------- light ---------- */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe4e0d8, 1.5));
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
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
      var m = new THREE.Mesh(new THREE.PlaneGeometry(i < 3 ? 5 : 6, i < 3 ? 2 : 3), panel);
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
    silver:   { color: 0xc9cccf, label: 'MULTI-PLATINUM' }
  };
  function certInfo(cert) {
    if (!cert || cert === 'none') return null;
    var m = /^multi-platinum:(\d+)$/.exec(cert);
    if (m) return { color: CERT.silver.color, label: m[1] + '× PLATINUM' };
    return CERT[cert] || null;
  }

  function grooveTex() {
    return canvasTex(1024, 1024, function (ctx, w, h) {
      ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
      for (var r = 140; r < 505; r += 3) {
        ctx.strokeStyle = 'rgba(' + (r % 9 < 3 ? '40,40,40' : '200,200,200') + ',.35)';
        ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke();
      }
    }, false);
  }
  var GROOVES = grooveTex();

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

  // engraved brass plate text (RIAA-style when certified, plain placement otherwise)
  function plateTex(p, presentedTo) {
    var c = certInfo(p.cert);
    return canvasTex(1024, 360, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#c9b37a'); g.addColorStop(.5, '#e4d29c'); g.addColorStop(1, '#b89e5f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, 8);
      ctx.fillStyle = '#2c2416'; ctx.textAlign = 'center';
      var serif = 'Georgia, "Times New Roman", serif', y = 62;
      var lines = c
        ? [['PRESENTED TO', 22, '400'], [presentedTo.toUpperCase(), 40, '700'],
           ['TO COMMEMORATE THE ' + (p.certBody || 'RIAA') + ' ' + c.label + ' CERTIFICATION OF', 20, '400'],
           ['“' + (p.album || p.song || '') + '”', 34, '700'], [(p.artist || '') + (p.label ? '  •  ' + p.label : ''), 20, '400']]
        : [['PLACEMENT', 22, '400'], ['“' + (p.song || '') + '”', 34, '700'],
           [(p.artist || '') + (p.album ? '  —  ' + p.album : ''), 22, '400'],
           [(p.role || 'Produced') + ' — ' + presentedTo, 22, '400']];
      lines.forEach(function (l) { fitText(ctx, l[0], w / 2, y, w - 80, l[1], l[2], serif); y += l[1] + 22; });
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
  var lacquer = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.28, metalness: 0.1 });
  var whiteFrame = new THREE.MeshStandardMaterial({ color: 0xf6f5f2, roughness: 0.4 });

  function buildPlaque(p, presentedTo) {
    var g = new THREE.Group();
    var W = 0.96, H = 1.22, D = 0.06;
    var isBoard = p.type === 'billboard';
    var frame = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), isBoard ? whiteFrame : lacquer);
    frame.castShadow = true; g.add(frame);

    if (isBoard) {
      var face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.12, H - 0.12), new THREE.MeshStandardMaterial({ map: billboardTex(p), roughness: 0.7 }));
      face.position.z = D / 2 + 0.001; g.add(face);
      return g;
    }

    var c = certInfo(p.cert);
    // matte: black velvet behind a certified disc, warm white for a placement
    var matte = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, H - 0.1),
      new THREE.MeshStandardMaterial({ color: c ? 0x0e0e0f : 0xf3f1ea, roughness: 0.95 }));
    matte.position.z = D / 2 + 0.001; g.add(matte);

    var discMat = c
      ? new THREE.MeshStandardMaterial({ color: c.color, metalness: 1, roughness: 0.2, bumpMap: GROOVES, bumpScale: 0.6 })
      : new THREE.MeshStandardMaterial({ color: 0x101010, metalness: 0.2, roughness: 0.32, bumpMap: GROOVES, bumpScale: 0.6 });
    var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.006, 96), discMat);
    disc.rotation.x = Math.PI / 2; disc.position.set(0, 0.2, D / 2 + 0.012); disc.castShadow = true; g.add(disc);
    var label = new THREE.Mesh(new THREE.CircleGeometry(0.09, 64), new THREE.MeshStandardMaterial({ map: coverTex(p), roughness: 0.6 }));
    label.position.set(0, 0.2, D / 2 + 0.0155); g.add(label);

    var cover = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshStandardMaterial({ map: coverTex(p), roughness: 0.6 }));
    cover.position.set(-W / 2 + 0.2, -0.35, D / 2 + 0.006); g.add(cover);

    var plate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.006),
      [null, null, null, null, new THREE.MeshStandardMaterial({ map: plateTex(p, presentedTo), metalness: 0.55, roughness: 0.35 }), null]
        .map(function (m) { return m || new THREE.MeshStandardMaterial({ color: 0xb89e5f, metalness: 0.6, roughness: 0.4 }); }));
    plate.position.set(0.12, -0.35, D / 2 + 0.006); g.add(plate);
    return g;
  }

  function hang(list, presentedTo) {
    var byWall = { back: [], left: [], right: [], front: [] };
    list.forEach(function (p) { (byWall[p.wall] || byWall.back).push(p); });
    Object.keys(byWall).forEach(function (wall) {
      var items = byWall[wall], W = WALLS[wall];
      items.forEach(function (p, i) {
        var g = buildPlaque(p, presentedTo);
        var span = Math.min(W.len - 2, items.length * 2.2);
        var x = items.length === 1 ? 0 : -span / 2 + span * (i / (items.length - 1));
        g.position.copy(W.pos); g.position.y = EYE + 0.05; g.rotation.y = W.rot;
        g.translateX(x); g.translateZ(0.035);
        scene.add(g);
        // gallery spot from the ceiling
        var spot = new THREE.SpotLight(0xfff6e8, 22, 7, 0.32, 0.65, 1.6);
        var from = g.position.clone(), n = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), W.rot);
        spot.position.copy(from).addScaledVector(n, 1.0); spot.position.y = ROOM.h - 0.05;
        spot.target.position.copy(from); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.bias = -0.0004; spot.shadow.radius = 6;
        scene.add(spot); scene.add(spot.target);
        var focus = from.clone().addScaledVector(n, 1.35); focus.y = EYE;
        plaques.push({ group: g, data: p, focus: focus, look: from.clone() });
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
  function showCard(p) {
    card.textContent = '';
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
      row(dl, 'Role', p.role); row(dl, 'Label', p.label); row(dl, 'Released', p.released);
      row(dl, 'Certified', c ? (p.certBody || 'RIAA') + ' ' + c.label : null);
      row(dl, 'Streams', p.streams);
      if (p.billboard) row(dl, 'Billboard', p.billboard.chart + (p.billboard.peak ? ' — peak #' + p.billboard.peak : ''));
    }
    card.appendChild(dl);
    if (p.certNote) { var n = document.createElement('div'); n.className = 'note'; n.textContent = p.certNote; card.appendChild(n); }
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
  function focusOn(pl) {
    target = pl; var a = anglesTo(pl.focus, pl.look);
    glide(pl.focus, a.yaw, a.pitch); showCard(pl.data);
    backBtn.hidden = false; hud.textContent = 'esc or step back to return';
  }
  function stepBack() {
    if (!target) return;
    target = null; card.classList.remove('show'); backBtn.hidden = true;
    hud.textContent = 'drag to look around · tap a plaque';
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
      wallText('PLACEMENTS', who + ' — RMLUR :: deux SEXES', 'back', 3.35, 4.2);
      wallText('RMLUR', 'museum of placements', 'front', 2.2, 3.2);
      hang(data.placements || [], who);
    })
    .catch(function (e) { hud.textContent = 'could not load placements'; console.error(e); });

  (function loop(now) {
    if (anim) anim(now);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })(performance.now());
  window.__museum = { scene: scene, camera: camera, plaques: plaques, focusOn: focusOn };
})();
