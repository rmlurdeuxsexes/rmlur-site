/* RMLUR homepage — the Readymag MPC photo is the navigation.
   - Pads: invisible links/sounds placed on the exact pad boxes measured
     from the photo (data/hero-map.json, built by scripts/build-hero-layers.py).
   - VOL fader cap + jog wheel: cut-out layers of the same photo that move in
     place. They don't control anything (by design) — they just feel real. */
(function () {
  var mpc = document.getElementById('mpc');
  var fader = document.getElementById('mpcFader');
  var wheel = document.getElementById('mpcWheel');
  var pads = window.HOME_PADS || {};

  function place(el, box) {
    el.style.left = box.left + '%';
    el.style.top = box.top + '%';
    el.style.width = box.width + '%';
    el.style.height = box.height + '%';
    el.style.visibility = 'visible';
  }

  function playOneShot(src) {
    var a = new Audio(src);           // new element per hit so fast taps overlap like a real pad
    a.play().catch(function () {});
  }

  function buildPads(map) {
    Object.keys(map.pads).forEach(function (key) {
      var n = Number(key.replace('pad-', ''));
      var cfg = pads[n] || {};
      var el = document.createElement('a');
      el.className = 'mpc-pad';
      el.setAttribute('aria-label', 'PAD ' + n + (cfg.label ? ' — ' + cfg.label : ''));
      if (cfg.url) {
        el.href = cfg.url;
        if (/^https?:/i.test(cfg.url)) { el.target = '_blank'; el.rel = 'noopener'; }
      } else {
        el.href = '#';
        el.setAttribute('role', 'button');
        el.addEventListener('click', function (e) {
          e.preventDefault();
          if (cfg.sound) playOneShot(cfg.sound);
        });
      }
      var st = padState(n, cfg);
      el.addEventListener('pointerenter', function () { lcdShow(st); });
      el.addEventListener('focus', function () { lcdShow(st); });
      el.addEventListener('pointerleave', lcdIdle);
      el.addEventListener('blur', lcdIdle);
      place(el, map.pads[key]);
      mpc.appendChild(el);
    });
  }

  // ── LCD: the screen is the way into the beat store, and it names whatever
  //    pad you're on, drawn like the real MPC2000XL screen (lcd-screen.js).
  //    Box comes from data/hero-map.json, url from HOME_LCD. ──
  var lcd = window.HOME_LCD || { url: 'store.html' };
  var lcdBusy = false;
  function lcdShow(st) { if (window.MpcLcd && !lcdBusy) MpcLcd.show(st); }
  function lcdIdle() { lcdShow({ kind: 'idle' }); }
  function padState(n, cfg) {
    var label = cfg.label ? cfg.label.toUpperCase() : 'PAD ' + n;
    var store = cfg.url && /store\.html/.test(cfg.url);
    var action = cfg.sound ? 'PLAY ' + label : store ? 'GO TO BEAT STORE' : cfg.url ? 'OPEN ' + label : 'EMPTY PAD';
    return { kind: 'pad', n: n, label: label, action: action, sound: !!cfg.sound, store: store };
  }

  function buildLcd(box) {
    if (!box) return;
    var el = document.createElement('a');
    el.className = 'mpc-lcd';
    el.href = lcd.url;
    el.setAttribute('aria-label', 'LCD screen — open the beat store');
    var glass = document.createElement('span');
    glass.className = 'mpc-lcd-glass';
    var g = box.glass;
    glass.style.left = g.left + '%'; glass.style.top = g.top + '%';
    glass.style.width = g.width + '%'; glass.style.height = g.height + '%';
    el.appendChild(glass);
    place(el, box);
    mpc.appendChild(el);
    if (window.MpcLcd) MpcLcd.mount(glass);
    el.addEventListener('pointerenter', function () { lcdShow({ kind: 'store' }); });
    el.addEventListener('pointerleave', lcdIdle);
    el.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return; // let new-tab clicks through
      e.preventDefault();
      if (lcdBusy) return;
      lcdShow({ kind: 'loading' });
      lcdBusy = true;
      setTimeout(function () { window.location.href = lcd.url; }, 600);
    });
    // coming Back from the store (bfcache) must not leave the screen stuck on LOADING
    window.addEventListener('pageshow', function () { lcdBusy = false; lcdIdle(); });
  }

  // ── LEDs: the real indicator dots on the photo, lit the way a 2000XL looks
  //    while overdubbing a playing sequence: some steady, REC / NEXT SEQ flashing
  //    on the 120 BPM the LCD shows. Positions + mode live in hero-map.json. ──
  function buildLeds(list) {
    (list || []).forEach(function (l) {
      var el = document.createElement('span');
      el.className = 'mpc-led mpc-led-' + l.color + ' led-' + (l.mode || 'on');   // on | off | blink | blink-slow
      el.style.left = l.x + '%';
      el.style.top = l.y + '%';
      el.setAttribute('aria-hidden', 'true');
      mpc.appendChild(el);
    });
  }

  // ── Knobs (REC GAIN, MAIN VOLUME): like a real pot, only the indicator line
  //    turns. The photo's printed line was erased (build-control-layers.py),
  //    so the cap, its lighting and the skirt never move. Stops at MIN/MAX.
  //    No job yet (roles get assigned later). Data: hero-map.json "knobs". ──
  function buildKnobs(list) {
    (list || []).forEach(function (k) {
      var ind = document.createElement('span');                 // the indicator line
      ind.className = 'mpc-knob-ind';
      ind.style.left = k.cx + '%'; ind.style.top = k.cy + '%';
      ind.style.width = k.thick + '%'; ind.style.height = k.len + '%';
      ind.style.setProperty('--ind', k.color);
      ind.setAttribute('aria-hidden', 'true');
      var el = document.createElement('span');                  // round hit area over the whole knob
      el.className = 'mpc-knob';
      el.setAttribute('role', 'slider');
      el.setAttribute('aria-label', k.label);
      el.setAttribute('aria-valuemin', k.min); el.setAttribute('aria-valuemax', k.max);
      el.tabIndex = 0;
      place(el, k);
      mpc.appendChild(ind);
      mpc.appendChild(el);
      var abs = k.angle, last = null;
      function level() { return Math.round((abs - k.min) / (k.max - k.min) * 100); }
      function show() { lcdShow({ kind: 'ctl', label: k.label, info: 'LEVEL ' + level(), level: level() / 100 }); }
      function apply() {
        ind.style.transform = 'translate(-50%, -100%) rotate(' + abs + 'deg)';
        el.setAttribute('aria-valuenow', level());
      }
      function turn(d) { abs = Math.max(k.min, Math.min(k.max, abs + d)); apply(); show(); }
      function pointerAngle(e) {
        var r = el.getBoundingClientRect();
        return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
      }
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('dragging'); last = pointerAngle(e);
      });
      el.addEventListener('pointermove', function (e) {
        if (!el.hasPointerCapture(e.pointerId)) return;
        var a = pointerAngle(e), d = a - last;
        if (d > 180) d -= 360; else if (d < -180) d += 360;
        last = a; turn(d);
      });
      function end(e) { if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); el.classList.remove('dragging'); }
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('wheel', function (e) { e.preventDefault(); turn(e.deltaY > 0 ? -8 : 8); }, { passive: false });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); turn(8); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); turn(-8); }
      });
      el.addEventListener('pointerenter', show);
      el.addEventListener('focus', show);
      el.addEventListener('pointerleave', function () { if (!el.classList.contains('dragging')) lcdIdle(); });
      el.addEventListener('blur', lcdIdle);
      apply();
    });
  }

  // ── Hardware buttons: every other key on the machine presses in like the
  //    pads and names itself on the LCD. No job yet (roles later). ──
  function buildButtons(list) {
    (list || []).forEach(function (b) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'mpc-btn';
      el.setAttribute('aria-label', b.label);
      place(el, b);
      mpc.appendChild(el);
      var st = { kind: 'ctl', label: b.label, info: 'NOT ASSIGNED YET' };
      function down() { el.classList.add('pressed'); lcdShow(st); }
      function up() { el.classList.remove('pressed'); }
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', function () { up(); lcdIdle(); });
      el.addEventListener('pointerenter', function () { lcdShow(st); });
      el.addEventListener('focus', function () { lcdShow(st); });
      el.addEventListener('blur', lcdIdle);
      el.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') down(); });
      el.addEventListener('keyup', up);
    });
  }

  // ── VOL fader: drag the cap along its slot ──
  function setupFader(f) {
    place(fader, f.cap);
    var top = f.cap.top, grabOffset = 0;
    fader.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      fader.setPointerCapture(e.pointerId);
      fader.classList.add('dragging');
      var r = mpc.getBoundingClientRect();
      grabOffset = (e.clientY - r.top) / r.height * 100 - top;
    });
    fader.addEventListener('pointermove', function (e) {
      if (!fader.hasPointerCapture(e.pointerId)) return;
      var r = mpc.getBoundingClientRect();
      var y = (e.clientY - r.top) / r.height * 100 - grabOffset;
      top = Math.min(f.travelBottom, Math.max(f.travelTop, y));
      fader.style.top = top + '%';
    });
    function end(e) {
      if (fader.hasPointerCapture(e.pointerId)) fader.releasePointerCapture(e.pointerId);
      fader.classList.remove('dragging');
    }
    fader.addEventListener('pointerup', end);
    fader.addEventListener('pointercancel', end);
  }

  // ── Jog wheel: turn it by dragging around its center, or with the scroll wheel ──
  function setupWheel(w) {
    place(wheel, w);
    var angle = 0, last = null;
    function pointerAngle(e) {
      var r = wheel.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    }
    function apply() { wheel.style.transform = 'rotate(' + angle + 'deg)'; }
    wheel.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      wheel.setPointerCapture(e.pointerId);
      wheel.classList.add('dragging');
      last = pointerAngle(e);
    });
    wheel.addEventListener('pointermove', function (e) {
      if (!wheel.hasPointerCapture(e.pointerId)) return;
      var a = pointerAngle(e), d = a - last;
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      angle += d; last = a; apply();
    });
    function end(e) {
      if (wheel.hasPointerCapture(e.pointerId)) wheel.releasePointerCapture(e.pointerId);
      wheel.classList.remove('dragging');
    }
    wheel.addEventListener('pointerup', end);
    wheel.addEventListener('pointercancel', end);
    wheel.addEventListener('wheel', function (e) {
      e.preventDefault();
      angle += e.deltaY > 0 ? 12 : -12; apply();
    }, { passive: false });
  }

  fetch('data/hero-map.json')
    .then(function (r) { return r.json(); })
    .then(function (map) {
      buildButtons(map.buttons);
      buildKnobs(map.knobs);
      buildLeds(map.leds);
      buildLcd(map.lcd);
      buildPads(map);
      setupFader(map.fader);
      setupWheel(map.wheel);
    })
    .catch(function () { /* photo still shows; just no interaction */ });
})();
