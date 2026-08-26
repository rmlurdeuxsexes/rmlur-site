/* RMLUR HOME — the MPC photo is the nav. See hotspots.js for the data. */
document.addEventListener('DOMContentLoaded', () => {
  const hotspotMap = window.HERO_HOTSPOTS || {};
  const pads = window.PADS || [];
  const drives = window.DRIVES || [];
  const lcdConfig = window.LCD || {};

  const heroHotspots = document.getElementById('hero-hotspots');
  const padAudio = document.getElementById('pad-audio');

  function placeEl(el, pos) {
    el.style.left = pos.left + '%';
    el.style.top = pos.top + '%';
    el.style.width = pos.width + '%';
    el.style.height = pos.height + '%';
  }
  function makeHotspotShell(extraClass, hotspotId) {
    const el = document.createElement('div');
    el.className = 'hotspot' + (extraClass ? ' ' + extraClass : '');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    if (hotspotId) el.dataset.hotspotId = hotspotId;
    return el;
  }
  function bindActivate(el, fn) {
    el.addEventListener('click', fn);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
  }

  /* ================= LCD: idle video <-> live waveform on beat playback ================= */
  let lcdIdle = true;
  let lcdVideo, lcdCanvas, wave;

  function renderLcd() {
    const pos = hotspotMap['lcd'];
    if (!pos) return;

    const container = makeHotspotShell('lcd-hotspot', 'lcd');
    placeEl(container, pos);
    container.setAttribute('aria-label', 'Shop the catalog');

    lcdVideo = document.createElement('video');
    lcdVideo.className = 'lcd-video';
    lcdVideo.src = lcdConfig.idleVideo || '';
    lcdVideo.autoplay = true;
    lcdVideo.loop = true;
    lcdVideo.muted = true;
    lcdVideo.playsInline = true;

    lcdCanvas = document.createElement('canvas');
    lcdCanvas.className = 'lcd-canvas';
    lcdCanvas.width = 240;
    lcdCanvas.height = 60;
    lcdCanvas.hidden = true;

    container.appendChild(lcdVideo);
    container.appendChild(lcdCanvas);
    heroHotspots.appendChild(container);

    // Colors matched to the Blender lcd-loop.mp4 idle screen: near-black
    // LED-matrix background with the same pink/magenta as its "RMLUR" text,
    // so the swap from idle video to live bars reads as one continuous screen.
    wave = window.createWaveform(padAudio, lcdCanvas, { bg: '#0e0b0d', barColor: '#ff6fc6' });

    bindActivate(container, () => {
      if (lcdIdle) window.location.href = 'shop.html';
    });
  }

  function showLcdWaveform() {
    lcdIdle = false;
    lcdVideo.pause();
    lcdVideo.hidden = true;
    lcdCanvas.hidden = false;
  }
  function showLcdIdle() {
    lcdIdle = true;
    wave.stopWave();
    lcdCanvas.hidden = true;
    lcdVideo.hidden = false;
    lcdVideo.play().catch(() => {});
  }

  /* ================= beat pads (top rows) ================= */
  let currentPadId = null;
  let playPromise = Promise.resolve();
  async function safeStop() {
    try { await playPromise; } catch (_) {}
    padAudio.pause();
  }
  async function safePlay(src) {
    await safeStop();
    if (src && padAudio.src !== src) padAudio.src = src;
    wave.ensureVisualizer();
    playPromise = padAudio.play();
    try { await playPromise; } catch (_) {}
    wave.startWave();
  }
  async function playBeat(pad) {
    if (!pad.audio) return; // no beat file dropped into assets/beats/ yet
    if (currentPadId === pad.id && !padAudio.paused) {
      currentPadId = null;
      await safeStop();
      showLcdIdle();
      return;
    }
    currentPadId = pad.id;
    showLcdWaveform();
    await safePlay(pad.audio);
  }
  padAudio.addEventListener('ended', () => {
    currentPadId = null;
    showLcdIdle();
  });

  /* ================= pads + drives ================= */
  // Randomly assign a fresh set of beats to the "beat" pads on every visit,
  // once window.BEAT_POOL (hotspots.js) actually has entries in it.
  function assignRandomBeats() {
    const pool = window.BEAT_POOL || [];
    if (!pool.length) return;
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const beatPads = pads.filter(p => p.type === 'beat');
    beatPads.forEach((pad, i) => { pad.audio = shuffled[i % shuffled.length] || null; });
  }

  function renderPads() {
    pads.forEach(pad => {
      const pos = hotspotMap[pad.id];
      if (!pos) return; // not measured on the current photo yet — skip gracefully

      const el = makeHotspotShell(null, pad.id);
      placeEl(el, pos);

      if (pad.type === 'beat') {
        el.setAttribute('aria-label', pad.title || 'Play beat');
        bindActivate(el, () => playBeat(pad));
      } else if (pad.type === 'social') {
        el.setAttribute('aria-label', pad.label || 'Link');
        bindActivate(el, () => {
          if (!pad.url) return;
          if (/^https?:\/\//i.test(pad.url)) window.open(pad.url, '_blank', 'noopener');
          else window.location.href = pad.url; // internal page or mailto: — same tab
        });
      }
      heroHotspots.appendChild(el);
    });
  }

  function renderStickers() {
    const stickers = window.STICKERS || {};
    Object.keys(stickers).forEach(id => {
      const s = stickers[id];
      const el = document.createElement('img');
      el.src = s.src;
      el.alt = '';
      el.className = 'sticker-decal';
      el.dataset.hotspotId = id;
      placeEl(el, s);
      heroHotspots.appendChild(el);
    });
  }

  function renderDrives() {
    drives.forEach(drive => {
      const pos = hotspotMap[drive.id];
      if (!pos) return; // not measured on the current photo yet — skip gracefully

      const el = makeHotspotShell('drive-hotspot', drive.id);
      placeEl(el, pos);
      el.setAttribute('aria-label', drive.label);
      bindActivate(el, () => { window.location.href = drive.targetPage; });
      heroHotspots.appendChild(el);
    });
  }

  renderLcd();
  assignRandomBeats();
  renderPads();
  renderDrives();
  renderStickers();
});
