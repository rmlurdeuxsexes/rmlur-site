/* RMLUR HOME — the 3D MPC (mpc-3d.js) is the nav. See hotspots.js for pad
   data (titles/audio/social links) and mpc-3d.js for the model + raycasting.
   HERO_HOTSPOTS/DRIVES/STICKERS in hotspots.js are the old flat-photo
   positions — unused for now, kept for when drives get a 3D treatment. */
document.addEventListener('DOMContentLoaded', () => {
  const pads = window.PADS || [];
  const lcdConfig = window.LCD || {};
  const padAudio = document.getElementById('pad-audio');

  /* ================= LCD: idle video <-> LED marquee, drawn onto the
     same offscreen canvas the 3D scene reads as the screen's texture ================= */
  const lcdCanvas = document.getElementById('lcdSourceCanvas');
  const lcdVideo = document.getElementById('lcdIdleVideo');
  lcdVideo.src = lcdConfig.idleVideo || 'assets/lcd-loop.mp4';

  const lcdCtx = lcdCanvas.getContext('2d');
  let lcdIdle = true;
  const wave = window.createLedMarquee(padAudio, lcdCanvas);

  function drawIdleFrame() {
    if (!lcdIdle) return;
    if (lcdVideo.readyState >= 2) {
      lcdCtx.drawImage(lcdVideo, 0, 0, lcdCanvas.width, lcdCanvas.height);
      window.drawLcdGlass(lcdCtx, lcdCanvas.width, lcdCanvas.height);
    }
    requestAnimationFrame(drawIdleFrame);
  }
  lcdVideo.play().catch(() => {});
  drawIdleFrame();

  // IDLE = looping video; PLAYING = waveform + track title; MESSAGE = same
  // waveform renderer (it already falls back to an idle-breathing pulse when
  // audio's paused) but with a status string instead of a title — no second
  // text renderer needed for LOADING-style messages.
  let lcdState = 'IDLE';
  function setLcdState(next, opts) {
    opts = opts || {};
    lcdIdle = (next === 'IDLE');
    if (next === 'IDLE') {
      wave.stopWave();
      drawIdleFrame();
    } else {
      if (opts.label !== undefined) wave.setLabel(opts.label);
      wave.startWave();
    }
    lcdState = next;
  }

  /* ================= beat pads ================= */
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
      setLcdState('IDLE');
      return;
    }
    currentPadId = pad.id;
    setLcdState('PLAYING', { label: pad.title || '' });
    wave.flashHit('PAD ' + (pads.indexOf(pad) + 1));
    await safePlay(pad.audio);
  }
  padAudio.addEventListener('ended', () => {
    currentPadId = null;
    setLcdState('IDLE');
  });

  function assignRandomBeats() {
    const pool = window.BEAT_POOL || [];
    if (!pool.length) return;
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const beatPads = pads.filter(p => p.type === 'beat');
    beatPads.forEach((pad, i) => { pad.audio = shuffled[i % shuffled.length] || null; });
  }

  /* ================= 3D MPC ================= */
  window.mpc3d.onPadClick = (padIndex) => {
    const pad = pads[padIndex];
    if (!pad) return;
    if (pad.type === 'beat') {
      playBeat(pad);
    } else if (pad.type === 'social') {
      if (!pad.url) return;
      if (/^https?:\/\//i.test(pad.url)) window.open(pad.url, '_blank', 'noopener');
      else window.location.href = pad.url;
    }
  };
  // Floppy disk -> beat store: a short LCD status message, then a fade to
  // black before navigating, so it reads as the machine handing off to the
  // store rather than a bare page jump. Both physical entry points (the LCD
  // itself, and the floppy button) share this one path.
  const pageFade = document.getElementById('page-fade');
  function goToShop() {
    if (lcdState === 'MESSAGE') return; // already mid-transition, ignore repeat clicks
    setLcdState('MESSAGE', { label: 'LOADING BEAT STORE...' });
    setTimeout(() => {
      pageFade.classList.add('show');
      setTimeout(() => { window.location.href = 'shop.html?from=floppy'; }, 380);
    }, 900);
  }

  // Every other named part (knobs, wheel, cursor, bank/menu/soft keys) is
  // already hoverable + clickable via mpc-3d.js's raycasting and flashes on
  // click — not wired to a feature yet, by design.
  window.mpc3d.onPartClick = (name) => {
    if (name === 'MPC_LCD' || name === 'Btn_Floppy') {
      goToShop();
    } else if (name === 'Drive_Body') {
      const drive = (window.DRIVES || []).find(d => d.id === 'tape');
      if (drive && drive.targetPage) window.location.href = drive.targetPage;
    } else if (name === 'Btn_PLAY') {
      if (currentPadId && !padAudio.paused) return; // already playing — Play doesn't restart it
      const pad = pads.find(p => p.id === currentPadId) || pads.find(p => p.type === 'beat' && p.audio);
      if (pad) playBeat(pad);
    } else if (name === 'Btn_STOP') {
      if (!currentPadId) return;
      currentPadId = null;
      safeStop();
      setLcdState('IDLE');
    }
  };

  /* ================= hero-frame sizing =================
     The MPC body is a wide, flat panel (~2.6:1), not square — a square
     box leaves huge empty margins top/bottom. CSS aspect-ratio/min()
     proved unreliable depending on the surrounding flex/vh context, so
     size it directly off .hero's own (reliably-sized) box instead. */
  const heroFrame = document.getElementById('hero-frame');
  const hero = document.querySelector('.hero');
  const HERO_ASPECT = 1.35; // wide/flat like the real MPC body, not square — see note above
  function sizeHeroFrame() {
    const box = hero.getBoundingClientRect();
    const maxW = Math.min(900, box.width - 8);
    const maxH = Math.min(640, box.height - 8);
    let w = maxW, h = w / HERO_ASPECT;
    if (h > maxH) { h = maxH; w = h * HERO_ASPECT; }
    w = Math.max(160, w); h = Math.max(160 / HERO_ASPECT, h);
    heroFrame.style.width = w + 'px';
    heroFrame.style.height = h + 'px';
  }
  sizeHeroFrame();
  window.addEventListener('resize', sizeHeroFrame);
  window.addEventListener('load', sizeHeroFrame);
  setTimeout(sizeHeroFrame, 150); // background/prerendered tabs can report a 0-size box on the first synchronous layout query

  assignRandomBeats();
  window.mpc3d.init('mpc3dWrap', lcdCanvas).catch(err => {
    console.error('[mpc3d] failed to load:', err);
  });
});
