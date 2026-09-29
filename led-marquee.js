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

  let audioCtx = null, analyser = null, freqData = null, rafId = null;
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
      analyser.fftSize = 256; // enough bins for 16 meter bars, still cheap
      freqData = new Uint8Array(analyser.frequencyBinCount);
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

  // Pad-reactive meter bank — MiniMeters/hardware-VU style dot-matrix bars
  // (same amber LED cell technique as the marquee below, not a smooth scope
  // line) driven by real frequency data off the analyser, not a canned
  // animation. Each bar gets a peak-hold cap that snaps up instantly and
  // decays slowly, matching real hardware meter behavior. Idle state is a
  // slow shared breathing pulse with a per-bar phase offset, echoing the
  // marquee's own idle-breathing level rather than going dead.
  const METER_BARS = 16;
  const METER_ROWS = 7;
  const meterPeaks = new Float32Array(METER_BARS);
  const meterPeakHold = new Float32Array(METER_BARS);
  let meterLastTs = 0;
  function drawMeters(x, y, w, h) {
    const now = performance.now();
    const dt = meterLastTs ? Math.min(0.25, (now - meterLastTs) / 1000) : 0;
    meterLastTs = now;

    let levels;
    if (analyser && !audioEl.paused) {
      analyser.getByteFrequencyData(freqData);
      const perBar = Math.floor(freqData.length / METER_BARS) || 1;
      levels = new Array(METER_BARS);
      for (let b = 0; b < METER_BARS; b++) {
        let sum = 0;
        const start = b * perBar;
        for (let i = 0; i < perBar; i++) sum += freqData[start + i] || 0;
        levels[b] = (sum / perBar) / 255;
      }
    } else {
      const t = now * 0.0012;
      levels = new Array(METER_BARS);
      for (let b = 0; b < METER_BARS; b++) levels[b] = 0.16 + 0.06 * Math.sin(t + b * 0.5);
    }

    const gap = 2;
    const barW = (w - gap * (METER_BARS - 1)) / METER_BARS;
    const pitch = h / METER_ROWS;
    const dotR = Math.min(barW, pitch) * 0.4;

    ctx.save();
    ctx.shadowColor = 'rgb(' + LED_ON + ')';
    ctx.shadowBlur = 4;
    for (let b = 0; b < METER_BARS; b++) {
      const lvl = levels[b];
      if (lvl >= meterPeaks[b]) { meterPeaks[b] = lvl; meterPeakHold[b] = 550; }
      else if (meterPeakHold[b] > 0) { meterPeakHold[b] -= dt * 1000; }
      else { meterPeaks[b] = Math.max(lvl, meterPeaks[b] - dt * 0.9); }

      const litRows = Math.round(lvl * METER_ROWS);
      const peakRow = Math.min(METER_ROWS - 1, Math.round(meterPeaks[b] * METER_ROWS));
      const bx = x + b * (barW + gap) + barW / 2;

      for (let r = 0; r < METER_ROWS; r++) {
        const by = y + h - r * pitch - pitch / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath(); ctx.arc(bx, by, dotR * 0.86, 0, Math.PI * 2); ctx.fill();
        if (r < litRows) {
          const alpha = Math.min(1, 0.45 + 0.55 * ((r + 1) / Math.max(1, litRows)));
          ctx.fillStyle = 'rgba(' + LED_ON + ',' + alpha.toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(bx, by, dotR, 0, Math.PI * 2); ctx.fill();
        }
        if (r === peakRow && meterPeakHold[b] > 0) {
          ctx.fillStyle = 'rgb(255,235,210)';
          ctx.beginPath(); ctx.arc(bx, by, dotR, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
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

    drawMeters(0, 0, w, scopeH);

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
    meterLastTs = 0;
    if (!rafId) drawWave();
  }
  function stopWave() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  return { ensureVisualizer, startWave, stopWave, setLabel, flashHit };
};
