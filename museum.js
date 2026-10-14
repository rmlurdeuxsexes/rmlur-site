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
      ['1. ' + (p.song || ''), 'Produced by JayRewind'].forEach(function (t, i) {
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
      var lines = c
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
      if (c) {
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

  function buildPlaque(p, presentedTo) {
    var g = new THREE.Group();
    // Proportions measured off the reference award (outer frame 0.82 : 1.02)
    var W = 0.86, H = 1.07, BAND = 0.03, D = 0.045;
    var isBoard = p.type === 'billboard';

    var back = new THREE.Mesh(new THREE.BoxGeometry(W - 0.01, H - 0.01, 0.02), backing);
    back.position.z = 0.01; back.castShadow = true; g.add(back);
    var frame = giltFrame(W, H, BAND, D - 0.016); frame.position.z = 0.0; g.add(frame);

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
        g.translateX(x); g.translateZ(0.004);
        scene.add(g);
        // gallery spot from the ceiling
        var spot = new THREE.SpotLight(0xfff6e8, 22, 7, 0.32, 0.65, 1.6);
        var from = g.position.clone(), n = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), W.rot);
        spot.position.copy(from).addScaledVector(n, 1.0); spot.position.y = ROOM.h - 0.05;
        spot.target.position.copy(from); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024);
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
