/* ============================================================
   LED DOT-MATRIX MARQUEE — ported from JayRewind Studio's
   drawLedMarquee/buildLedMask (src/renderer.js), so the website's
   LCD reacts with the exact same pixels as the Blender LED DEMO
   mockup instead of a plain bar-graph waveform. Same public shape
   as createWaveform() (ensureVisualizer/startWave/stopWave) so it
   drops into app.js's LCD swap unchanged, plus setLabel() to show
   which beat is playing.
   ============================================================ */
// Shared glass/scanline pass for the LCD canvas — called after whatever
// drew the actual content (idle video frame in app.js, or drawWave below)
// so both states get the same "real hardware screen" treatment instead of
// a flat rectangle. Kept separate from content drawing since two different
// call sites feed the same canvas.
window.drawLcdGlass = function drawLcdGlass(ctx, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  ctx.restore();

  const vignette = ctx.createRadialGradient(w * 0.35, h * 0.28, 0, w * 0.5, h * 0.5, w * 0.72);
  vignette.addColorStop(0, 'rgba(255,255,255,0.04)');
  vignette.addColorStop(0.45, 'rgba(255,255,255,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  const sheen = ctx.createLinearGradient(0, 0, 0, h * 0.42);
  sheen.addColorStop(0, 'rgba(255,255,255,0.07)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h * 0.42);
};

window.createLedMarquee = function createLedMarquee(audioEl, canvasEl, opts) {
  const ctx = canvasEl ? canvasEl.getContext('2d') : null;
  const FONT = '"IBM Plex Mono","Share Tech Mono","Courier New",monospace';
  // Amber analog-hardware tone (Elektron Machinedrum-style reflective LCD),
  // not the old green LED-sign green — ported look, not the ported pixels.
  const LED_ON = '255,150,58';
  const LED_ROWS = 5;
  const LED_GAP_RATIO = 0.6;
  const BRAND = (opts && opts.brand) || 'RMLUR DEUX SEXES';
  const HIT_FLASH_MS = 650; // how long a pad-hit readout holds before the marquee resumes, same beat as the reference hardware's trig-flash

  let audioCtx = null, analyser = null, freqData = null, timeData = null, rafId = null;
  let label = '';
  let mask = null, maskTextCols = 0, maskTotalCols = 0, maskText = null;
  let scrollCells = 0, lastTs = 0;
  let hitLabel = '', hitUntil = 0;

  function ensureVisualizer() {
    if (audioCtx || !ctx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(audioEl);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256; // enough samples for a readable scope line, still cheap
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch (_) { /* visualizer is optional, playback still works without it */ }
  }

  function setLabel(text) {
    label = text || '';
  }

  // Momentary pad-hit readout — mirrors how a real Elektron trig press
  // flashes a parameter/level readout before the display returns to
  // whatever it was showing, instead of the pad click having no visible
  // effect on the screen at all.
  function flashHit(text) {
    hitLabel = text || '';
    hitUntil = performance.now() + HIT_FLASH_MS;
  }

  // Live oscilloscope line — MiniMeters-style thin glowing waveform, not a
  // canned animation: real samples off the analyser, redrawn every frame.
  // Flatlines (still glowing, not dead) when nothing's actually playing.
  function drawScope(x, y, w, h) {
    const midY = y + h / 2;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    if (!analyser || audioEl.paused) {
      ctx.strokeStyle = 'rgba(' + LED_ON + ',0.32)';
      ctx.beginPath();
      ctx.moveTo(x, midY);
      ctx.lineTo(x + w, midY);
      ctx.stroke();
      ctx.restore();
      return;
    }
    analyser.getByteTimeDomainData(timeData);
    ctx.strokeStyle = 'rgb(' + LED_ON + ')';
    ctx.shadowColor = 'rgb(' + LED_ON + ')';
    ctx.shadowBlur = 9;
    ctx.beginPath();
    const n = timeData.length;
    for (let i = 0; i < n; i++) {
      const v = (timeData[i] - 128) / 128; // -1..1
      const px = x + (i / (n - 1)) * w;
      const py = midY - v * (h / 2) * 0.88;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawHitScreen(x, y, w, h) {
    const pad = h * 0.16;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgb(' + LED_ON + ')';
    ctx.shadowColor = 'rgb(' + LED_ON + ')';
    ctx.shadowBlur = 6;
    ctx.font = 'bold ' + Math.round(h * 0.5) + 'px ' + FONT;
    ctx.fillText(hitLabel.toUpperCase(), x + pad, y + h * 0.68);
    ctx.shadowBlur = 0;
    ctx.font = Math.round(h * 0.18) + 'px ' + FONT;
    ctx.fillStyle = 'rgba(' + LED_ON + ',0.7)';
    ctx.fillText('TRIG', x + pad, y + h * 0.92);
  }

  function buildMask(text, pitchPx) {
    const SUPER = 4;
    const measure = document.createElement('canvas');
    const mctx = measure.getContext('2d');
    const fontPx = LED_ROWS * SUPER * 0.82;
    mctx.font = 'bold ' + fontPx + 'px ' + FONT;
    const textW = Math.max(1, Math.ceil(mctx.measureText(text).width));

    const superCanvas = document.createElement('canvas');
    superCanvas.width = textW;
    superCanvas.height = LED_ROWS * SUPER;
    const sctx = superCanvas.getContext('2d');
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, superCanvas.width, superCanvas.height);
    sctx.fillStyle = '#fff';
    sctx.font = 'bold ' + fontPx + 'px ' + FONT;
    sctx.textAlign = 'left'; sctx.textBaseline = 'middle';
    sctx.fillText(text, 0, superCanvas.height / 2);

    const textCols = Math.max(1, Math.round(textW / (pitchPx * SUPER)));
    const gapCols = Math.max(1, Math.round(textCols * LED_GAP_RATIO));
    const totalCols = textCols + gapCols;

    const px = sctx.getImageData(0, 0, superCanvas.width, superCanvas.height).data;
    const rows = [];
    for (let r = 0; r < LED_ROWS; r++) {
      const row = new Float32Array(totalCols);
      for (let cCol = 0; cCol < textCols; cCol++) {
        let sum = 0, n = 0;
        const x0 = Math.floor(cCol / textCols * superCanvas.width);
        const x1 = Math.floor((cCol + 1) / textCols * superCanvas.width);
        const y0 = r * SUPER, y1 = y0 + SUPER;
        for (let y = y0; y < y1; y++) {
          for (let x = Math.max(0, x0); x < Math.min(superCanvas.width, Math.max(x0 + 1, x1)); x++) {
            sum += px[(y * superCanvas.width + x) * 4]; // red channel (white text on black)
            n++;
          }
        }
        row[cCol] = n ? (sum / n) / 255 : 0;
      }
      rows.push(row);
    }
    mask = rows;
    maskTextCols = textCols;
    maskTotalCols = totalCols;
    maskText = text;
  }

  function audioLevel() {
    if (analyser && !audioEl.paused) {
      analyser.getByteFrequencyData(freqData);
      let sum = 0;
      for (let i = 0; i < freqData.length; i++) sum += freqData[i];
      return (sum / freqData.length) / 255;
    }
    return 0.22 + 0.1 * Math.sin(performance.now() * 0.0015); // idle breathing pulse
  }

  function drawWave() {
    if (!ctx) return;
    const w = canvasEl.width, h = canvasEl.height;
    // Top band: always-live scope line. Bottom band: marquee dots, or the
    // brief pad-hit readout — "alive" for as long as something's playing,
    // not just a momentary flash.
    const scopeH = Math.round(h * 0.4);
    const lowerY = scopeH, lowerH = h - scopeH;
    const pitch = lowerH / LED_ROWS;
    const cols = Math.max(1, Math.round(w / pitch));

    const text = BRAND + (label ? '   •   ' + label.toUpperCase() : '') + '   ★';
    if (text !== maskText) buildMask(text, pitch);

    const now = performance.now();
    if (lastTs) {
      const dtSec = Math.min(0.25, (now - lastTs) / 1000);
      const CELLS_PER_SEC = 9;
      scrollCells = (scrollCells + dtSec * CELLS_PER_SEC) % maskTotalCols;
    }
    lastTs = now;

    const level = audioLevel();
    const floor = 0.22;
    const boost = floor + (1 - floor) * level;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0e0b0d';
    ctx.fillRect(0, 0, w, h);

    drawScope(0, 0, w, scopeH);

    if (now < hitUntil) {
      drawHitScreen(0, lowerY, w, lowerH);
      window.drawLcdGlass(ctx, w, h);
      rafId = requestAnimationFrame(drawWave);
      return;
    }

    ctx.shadowColor = 'rgb(' + LED_ON + ')';
    ctx.shadowBlur = 3;

    if (mask) {
      for (let col = 0; col < cols; col++) {
        const maskCol = Math.floor((col + scrollCells) % maskTotalCols);
        const cx = col * pitch + pitch / 2;
        for (let row = 0; row < LED_ROWS; row++) {
          const cy = lowerY + row * pitch + pitch / 2;
          const cov = mask[row][maskCol] || 0;
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.beginPath(); ctx.arc(cx, cy, pitch * 0.32, 0, Math.PI * 2); ctx.fill();
          if (cov > 0.06) {
            ctx.fillStyle = 'rgba(' + LED_ON + ',' + Math.min(1, cov * boost).toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(cx, cy, pitch * 0.38, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }
    ctx.shadowBlur = 0;
    window.drawLcdGlass(ctx, w, h);

    rafId = requestAnimationFrame(drawWave);
  }

  function startWave() {
    ensureVisualizer();
    lastTs = 0;
    if (!rafId) drawWave();
  }
  function stopWave() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  return { ensureVisualizer, startWave, stopWave, setLabel, flashHit };
};
