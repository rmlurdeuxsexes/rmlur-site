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
      var name = cfg.label ? cfg.label.toUpperCase() : 'PAD ' + n;
      el.addEventListener('pointerenter', function () { lcdShow(name); });
      el.addEventListener('focus', function () { lcdShow(name); });
      el.addEventListener('pointerleave', lcdIdle);
      el.addEventListener('blur', lcdIdle);
      place(el, map.pads[key]);
      mpc.appendChild(el);
    });
  }

  // ── LCD: the screen is the way into the beat store, and it names whatever
  //    pad you're on. Box comes from data/hero-map.json, text/url from HOME_LCD. ──
  var lcd = window.HOME_LCD || { idle: 'BEAT STORE', url: 'store.html' };
  var lcdText = null, lcdBusy = false;
  function lcdShow(t) { if (lcdText && !lcdBusy) { lcdText.textContent = t; lcdText.classList.remove('idle'); } }
  function lcdIdle() { if (lcdText && !lcdBusy) { lcdText.textContent = lcd.idle + ' \u25BA'; lcdText.classList.add('idle'); } }

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
    lcdText = document.createElement('span');
    lcdText.className = 'mpc-lcd-text';
    glass.appendChild(lcdText);
    el.appendChild(glass);
    el.addEventListener('pointerenter', function () { lcdShow('OPEN BEAT STORE \u25BA'); });
    el.addEventListener('pointerleave', lcdIdle);
    el.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return; // let new-tab clicks through
      e.preventDefault();
      if (lcdBusy) return;
      lcdShow('LOADING...');
      lcdBusy = true;
      setTimeout(function () { window.location.href = lcd.url; }, 450);
    });
    // coming Back from the store (bfcache) must not leave the screen stuck on LOADING
    window.addEventListener('pageshow', function () { lcdBusy = false; lcdIdle(); });
    place(el, box);
    mpc.appendChild(el);
    lcdIdle();
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
      buildLcd(map.lcd);
      buildPads(map);
      setupFader(map.fader);
      setupWheel(map.wheel);
    })
    .catch(function () { /* photo still shows; just no interaction */ });
})();
