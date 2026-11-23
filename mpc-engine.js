/* mpc-engine.js — the homepage MPC's sound brain (no DOM).
   Web Audio one-shots (with pitch), a 1-bar/16-step sequencer with
   PLAY / STOP / REC (replace) / OVERDUB (add), tap tempo, swing, master
   volume, and a single beat-preview player for bank C.
   Content (kits, default pattern) comes from hotspots.js; home.js wires it.
   API: MpcEngine.hit(cfg, padN) · play() · stop() · playStart() · rec() · overdub()
        tap() · setVolume(0..1) · setSwing(0..1) · preview(url) · status()
        onChange(fn) — fn(status) on every transport change and every beat. */
(function () {
  var seqCfg = window.HOME_SEQ || { bpm: 120, pattern: {} };
  var padsA = window.HOME_PADS || {};
  var ctx = null, master = null, buffers = {}, loading = {};
  var bpm = seqCfg.bpm || 120, swing = 0, volume = 0.8;
  var STEPS = 16, pattern = [], playing = false, mode = null;   // mode: null | 'rec' | 'overdub'
  var startTime = 0, nextStep = 0, nextTime = 0, timer = null, skip = {}, listeners = [], curStep = 0, taps = [];
  var previewEl = null, previewUrl = null;

  for (var i = 0; i < STEPS; i++) pattern.push([]);
  Object.keys(seqCfg.pattern || {}).forEach(function (n) {
    var cfg = padsA[n]; if (!cfg || !cfg.sound) return;
    seqCfg.pattern[n].forEach(function (s) { if (s >= 0 && s < STEPS) pattern[s].push({ sound: cfg.sound, rate: 1 }); });
  });

  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = gainFor(volume); master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function gainFor(v) { return v <= 0.01 ? 0 : Math.min(1, 0.2 + v * 1.4); }   // the knob rests low on the photo, so it starts loud enough
  function load(src) {
    if (buffers[src] || loading[src]) return loading[src] || Promise.resolve(buffers[src]);
    loading[src] = fetch(src).then(function (r) { return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (ok, no) { ctx.decodeAudioData(ab, ok, no); }); })
      .then(function (b) { buffers[src] = b; return b; }).catch(function () { return null; });
    return loading[src];
  }
  function voice(sound, rate, when) {
    var b = buffers[sound];
    if (!b) { load(sound).then(function (bb) { if (bb && when <= ctx.currentTime + 0.05) voice(sound, rate, ctx.currentTime); }); return; }
    var s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate || 1; s.connect(master); s.start(Math.max(when, ctx.currentTime));
  }
  function preloadPattern() { pattern.forEach(function (st) { st.forEach(function (e) { load(e.sound); }); }); }

  function stepDur() { return 60 / bpm / 4; }
  function schedule() {
    while (nextTime < ctx.currentTime + 0.12) {
      var st = nextStep, t = nextTime + (st % 2 ? swing * stepDur() * 0.5 : 0);
      pattern[st].forEach(function (e, k) { if (skip[st + ':' + k]) { delete skip[st + ':' + k]; return; } voice(e.sound, e.rate, t); });
      (function (st2, t2) { setTimeout(function () { curStep = st2; if (st2 % 4 === 0) emit(); }, Math.max(0, (t2 - ctx.currentTime) * 1000)); })(st, t);
      nextStep = (nextStep + 1) % STEPS; nextTime += stepDur();
      if (nextStep === 0) startTime = nextTime;
    }
  }
  function start(fromTop) {
    if (!ac()) return; preloadPattern();
    if (!playing || fromTop) { startTime = ctx.currentTime + 0.05; nextTime = startTime; nextStep = 0; curStep = 0; }
    playing = true; clearInterval(timer); timer = setInterval(schedule, 25); schedule(); emit();
  }
  function emit() { var s = status(); listeners.forEach(function (fn) { fn(s); }); }
  function status() {
    var beat = Math.floor(curStep / 4) + 1;
    return { playing: playing, mode: mode, bpm: bpm, swing: swing, volume: volume, step: curStep,
      now: '001.0' + beat + '.00', events: pattern.reduce(function (a, s) { return a + s.length; }, 0) };
  }

  window.MpcEngine = {
    hit: function (cfg) {
      if (!cfg || !cfg.sound || !ac()) return;
      var rate = cfg.rate || 1;
      voice(cfg.sound, rate, ctx.currentTime);
      if (playing && mode) {                                    // record, quantised to the nearest 16th
        var pos = (ctx.currentTime - startTime) / stepDur(), st = Math.round(pos);
        var ahead = st > pos; st = ((st % STEPS) + STEPS) % STEPS;
        var dup = pattern[st].some(function (e) { return e.sound === cfg.sound && e.rate === rate; });
        if (!dup) { pattern[st].push({ sound: cfg.sound, rate: rate }); if (ahead) skip[st + ':' + (pattern[st].length - 1)] = 1; }
        emit();
      }
    },
    play: function () { start(false); },
    playStart: function () { start(true); },
    stop: function () { playing = false; mode = null; clearInterval(timer); curStep = 0; emit(); },
    rec: function () {
      mode = mode === 'rec' ? null : 'rec';
      if (mode === 'rec') { for (var i = 0; i < STEPS; i++) pattern[i] = []; }   // REC replaces the bar
      if (mode && !playing) start(true); else emit();
    },
    overdub: function () { mode = mode === 'overdub' ? null : 'overdub'; if (mode && !playing) start(true); else emit(); },
    tap: function () {
      var t = performance.now(); taps = taps.filter(function (x) { return t - x < 2500; }); taps.push(t);
      if (taps.length >= 2) {
        var d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
        bpm = Math.max(60, Math.min(200, Math.round(60000 / d * 10) / 10));
      }
      emit();
    },
    setVolume: function (v) { volume = v; if (master) master.gain.value = gainFor(v); if (previewEl) previewEl.volume = v; },
    setSwing: function (v) { swing = Math.max(0, Math.min(1, v)) * 0.6; },
    preview: function (url) {                                    // bank C: one beat at a time; same pad again stops it
      if (!previewEl) previewEl = new Audio();
      if (previewUrl === url && !previewEl.paused) { previewEl.pause(); previewUrl = null; return Promise.resolve('stopped'); }
      previewUrl = url; previewEl.src = url; previewEl.volume = volume;
      return previewEl.play().then(function () { return 'playing'; }, function () { previewUrl = null; return 'error'; });
    },
    status: status,
    onChange: function (fn) { listeners.push(fn); }
  };
})();
