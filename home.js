/* RMLUR homepage — the Readymag MPC photo is the navigation.
   - Pads: invisible links/sounds placed on the exact pad boxes measured
     from the photo (data/hero-map.json, built by scripts/build-hero-layers.py).
   - VOL fader cap + jog wheel: cut-out layers of the same photo that move in
     place. They don't control anything (by design) — they just feel real.
   - Buttons/knobs: transport + tap tempo + swing/volume drive mpc-engine.js;
     F1–F6, CURSOR/ENTER and 0–9 navigate via the LCD; PAD BANK A–D swap
     what the pads do. Content for all of it lives in hotspots.js. */
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

  // ── Pads: what a pad does depends on the active bank (A pages+kit, B kit,
  //    C beat previews, D socials). The <a> is re-pointed on bank change so
  //    links still work as real links (new tab, middle-click, etc). ──
  var banks = window.HOME_BANKS || {}, bank = 'A', padEls = {}, engine = window.MpcEngine;
  function cfgFor(n) { return (bank === 'A' ? pads : (banks[bank] || {}))[n] || {}; }
  function pointPad(n) {
    var el = padEls[n], cfg = cfgFor(n);
    el.setAttribute('aria-label', 'PAD ' + n + (cfg.label ? ' — ' + cfg.label : ''));
    if (cfg.url) {
      el.href = cfg.url; el.removeAttribute('role');
      if (/^https?:/i.test(cfg.url)) { el.target = '_blank'; el.rel = 'noopener'; } else { el.removeAttribute('target'); el.removeAttribute('rel'); }
    } else { el.href = '#'; el.setAttribute('role', 'button'); el.removeAttribute('target'); el.removeAttribute('rel'); }
  }
  function buildPads(map) {
    Object.keys(map.pads).forEach(function (key) {
      var n = Number(key.replace('pad-', ''));
      var el = document.createElement('a');
      el.className = 'mpc-pad';
      padEls[n] = el; pointPad(n);
      el.addEventListener('click', function (e) {
        var cfg = cfgFor(n);
        if (cfg.url) return;                                   // real link
        e.preventDefault();
        if (cfg.sound) { if (engine) engine.hit(cfg); else playOneShot(cfg.sound); }
        else if (cfg.preview && engine) {
          engine.preview(cfg.preview).then(function (r) {
            lcdShow(Object.assign(padState(n, cfg), { action: r === 'playing' ? 'PLAYING PREVIEW' : r === 'stopped' ? 'STOPPED' : 'PREVIEW UNAVAILABLE' }));
          });
        }
      });
      el.addEventListener('pointerenter', function () { lcdShow(padState(n, cfgFor(n))); });
      el.addEventListener('focus', function () { lcdShow(padState(n, cfgFor(n))); });
      el.addEventListener('pointerleave', lcdIdle);
      el.addEventListener('blur', lcdIdle);
      place(el, map.pads[key]);
      mpc.appendChild(el);
    });
  }
  function setBank(b) {
    bank = b;
    Object.keys(padEls).forEach(function (n) { pointPad(Number(n)); });
    ['a', 'b', 'c', 'd'].forEach(function (x) { setLed('pad-bank-' + x, x === b.toLowerCase() ? 'on' : 'off'); });
    var names = { A: 'PAGES + DRUMS', B: 'DRUM KIT 2', C: 'BEAT PREVIEWS', D: 'SOCIAL LINKS' };
    lcdShow({ kind: 'ctl', label: 'PAD BANK ' + b, info: names[b] });
    if (b === 'C' && !Object.keys(banks.C || {}).length) loadPreviewBank();
  }
  function loadPreviewBank() {
    lcdShow({ kind: 'ctl', label: 'PAD BANK C', info: 'LOADING BEATS...' });
    fetch('/api/products').then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () { return fetch('data/beats.catalog.json').then(function (r) { return r.ok ? r.json() : []; }); })
      .then(function (list) {
        var C = banks.C = banks.C || {}, i = 1;
        (list || []).forEach(function (p) { if (i <= 16 && p.preview) C[i++] = { label: p.title, preview: p.preview }; });
        if (bank === 'C') { Object.keys(padEls).forEach(function (n) { pointPad(Number(n)); });
          lcdShow({ kind: 'ctl', label: 'PAD BANK C', info: (i - 1) ? (i - 1) + ' BEATS LOADED' : 'NO PREVIEWS YET' }); }
      }).catch(function () { lcdShow({ kind: 'ctl', label: 'PAD BANK C', info: 'NO PREVIEWS YET' }); });
  }

  // ── LCD: the screen is the way into the beat store, and it names whatever
  //    pad you're on, drawn like the real MPC2000XL screen (lcd-screen.js).
  //    Box comes from data/hero-map.json, url from HOME_LCD. ──
  var lcd = window.HOME_LCD || { url: 'store.html' };
  var lcdBusy = false;
  function lcdShow(st) { if (window.MpcLcd && !lcdBusy) MpcLcd.show(st); }
  function lcdIdle() {
    var st = engine ? engine.status() : { bpm: 120 };
    lcdShow(st.playing || st.mode ? seqState(st) : { kind: 'idle', bpm: st.bpm, bank: bank });
  }
  function seqState(st, info) {
    var m = st.mode === 'rec' ? 'RECORDING (REPLACE)' : st.mode === 'overdub' ? 'OVERDUB: TAP PADS' : st.playing ? 'PLAYING' : 'STOPPED';
    return { kind: 'seq', bpm: st.bpm, now: st.now, step: st.step, playing: st.playing, events: st.events, info: info || m };
  }
  function padState(n, cfg) {
    var label = cfg.label ? cfg.label.toUpperCase() : 'PAD ' + n;
    var store = cfg.url && /store\.html/.test(cfg.url);
    var action = cfg.sound ? 'PLAY ' + label : cfg.preview ? 'PREVIEW BEAT' : store ? 'GO TO BEAT STORE' : cfg.url ? 'OPEN ' + label : 'EMPTY PAD';
    return { kind: 'pad', n: n, label: label, action: action, sound: !!cfg.sound, store: store, bank: bank };
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
    el.addEventListener('pointerenter', function () { lcdShow({ kind: 'store', bpm: engine ? engine.status().bpm : 120 }); });
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
  var leds = {};
  // mode: 'on' | 'off' | 'blink' | 'blink-slow' | 'tempo' (flashes on the beat) | null → back to its idle look
  function setLed(id, mode) {
    var l = leds[id]; if (!l) return;
    l.el.className = 'mpc-led mpc-led-' + l.color + ' led-' + (mode || l.mode || 'on');
  }
  function buildLeds(list) {
    (list || []).forEach(function (l) {
      var el = document.createElement('span');
      leds[l.id] = { el: el, color: l.color, mode: l.mode };
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
      var abs = k.angle, last = null, rest = Math.round((k.angle - k.min) / (k.max - k.min) * 100);
      function level() { return Math.round((abs - k.min) / (k.max - k.min) * 100); }
      var KNOB_NAME = { 'main-volume': 'MAIN VOLUME', 'rec-gain': 'SWING' };
      function show() { lcdShow({ kind: 'ctl', label: KNOB_NAME[k.id] || k.label, info: 'LEVEL ' + level(), level: level() / 100 }); }
      function apply() {
        ind.style.transform = 'translate(-50%, -100%) rotate(' + abs + 'deg)';
        el.setAttribute('aria-valuenow', level());
      }
      function act() {
        if (!engine) return;
        if (k.id === 'main-volume') engine.setVolume(level() / 100);
        // swing starts straight at the knob's resting position; turning it up from there adds swing
        if (k.id === 'rec-gain') engine.setSwing(Math.max(0, (level() - rest) / Math.max(1, 100 - rest)));
      }
      function turn(d) { abs = Math.max(k.min, Math.min(k.max, abs + d)); apply(); act(); show(); }
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
      apply(); act();
    });
  }

  // ── Hardware buttons: every key presses in. Transport/tempo drive the
  //    engine, F-keys + CURSOR/ENTER + 0–9 navigate, PAD BANK swaps the pads,
  //    the rest show a line from HOME_BUTTON_INFO. ──
  var fkeys = window.HOME_FKEYS || [], info = window.HOME_BUTTON_INFO || {};
  var menu = fkeys.slice(0, 5).map(function (f) { return f; });
  Object.keys(pads).forEach(function (n) { var c = pads[n]; if (c.url && !menu.some(function (m) { return m.url === c.url; })) menu.push({ label: c.label, url: c.url }); });
  var menuIdx = 0, digits = '', digitTimer = null;
  function go(url) {
    if (/^https?:/i.test(url)) window.open(url, '_blank', 'noopener'); else window.location.href = url;
  }
  function showMenu() { lcdShow({ kind: 'menu', index: menuIdx, items: menu.map(function (m) { return m.label; }) }); }
  function digit(d) {
    digits = (digits + d).slice(-2); clearTimeout(digitTimer);
    lcdShow({ kind: 'ctl', label: 'PAD NUMBER', info: 'PAD:' + digits + (digits.length < 2 ? '_' : '') });
    function resolve() {
      var n = Number(digits); digits = '';
      if (n >= 1 && n <= 16) lcdShow(padState(n, cfgFor(n))); else lcdShow({ kind: 'ctl', label: 'PAD NUMBER', info: 'NO PAD ' + n + ' (1-16)' });
    }
    if (digits.length === 2 || Number(digits) > 1) resolve(); else digitTimer = setTimeout(resolve, 900);
  }
  function syncTransport(st) {
    var beat = (60 / st.bpm) + 's';
    mpc.style.setProperty('--beat', beat);
    if (st.playing || st.mode) {
      setLed('play', st.playing ? 'on' : 'off');
      setLed('rec', st.mode === 'rec' ? 'tempo' : 'off');
      setLed('overdub', st.mode === 'overdub' ? 'tempo' : 'off');
    } else { setLed('play', null); setLed('rec', null); setLed('overdub', null); }
  }
  var lastSeqShown = 0;
  if (engine) engine.onChange(function (st) {
    syncTransport(st);
    if (Date.now() - lastSeqShown < 4000) lcdShow(seqState(st));   // keep the transport screen live while you're using it
  });
  function transport(fn, info) { if (!engine) return; fn(); lastSeqShown = Date.now(); lcdShow(seqState(engine.status(), info)); }
  function press(id, label) {
    if (/^key-\d$/.test(id)) return digit(id.slice(4));
    var f = /^f([1-6])$/.exec(id);
    if (f) { var fk = fkeys[f[1] - 1]; if (fk) { lcdShow({ kind: 'ctl', label: 'F' + f[1] + ' ' + fk.tab, info: 'OPEN ' + fk.label.toUpperCase(), tab: f[1] - 1 }); setTimeout(function () { go(fk.url); }, 250); } return; }
    var b = /^pad-bank-([a-d])$/.exec(id);
    if (b) return setBank(b[1].toUpperCase());
    switch (id) {
      case 'play':       return transport(engine && engine.play);
      case 'play-start': return transport(engine && engine.playStart, 'PLAY FROM START');
      case 'stop':       return transport(engine && engine.stop);
      case 'rec':        return transport(engine && engine.rec);
      case 'overdub':    return transport(engine && engine.overdub);
      case 'tap-tempo':  if (!engine) return; engine.tap(); lastSeqShown = Date.now(); return lcdShow(seqState(engine.status(), 'TAP TEMPO: ' + engine.status().bpm + ' BPM'));
      case 'cursor-up': case 'cursor-left':   menuIdx = (menuIdx + menu.length - 1) % menu.length; return showMenu();
      case 'cursor-down': case 'cursor-right': menuIdx = (menuIdx + 1) % menu.length; return showMenu();
      case 'enter': showMenu(); return setTimeout(function () { go(menu[menuIdx].url); }, 250);
    }
    lcdShow({ kind: 'ctl', label: label, info: info[id] || 'RMLUR :: DEUX SEXES' });
  }
  function buildButtons(list) {
    (list || []).forEach(function (b) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'mpc-btn';
      el.setAttribute('aria-label', b.label);
      place(el, b);
      mpc.appendChild(el);
      var hint = { kind: 'ctl', label: b.label, info: info[b.id] || '' };
      function down() { el.classList.add('pressed'); }
      function up() { el.classList.remove('pressed'); }
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('click', function () { press(b.id, b.label); });
      el.addEventListener('pointerleave', function () { up(); if (Date.now() - lastSeqShown > 4000) lcdIdle(); });
      el.addEventListener('pointerenter', function () { if (Date.now() - lastSeqShown > 4000) lcdShow(hint); });
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
      ['b', 'c', 'd'].forEach(function (x) { setLed('pad-bank-' + x, 'off'); }); setLed('pad-bank-a', 'on');
      buildLcd(map.lcd);
      buildPads(map);
      setupFader(map.fader);
      setupWheel(map.wheel);
    })
    .catch(function () { /* photo still shows; just no interaction */ });
})();
