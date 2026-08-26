/* ============================================================
   SHARED PIXEL-LCD WAVEFORM — Web Audio analyser driving a canvas.
   Used by both the home page (LCD, on beat-pad playback) and the
   shop page (player bar). Extracted so both places share one
   implementation instead of duplicating it.
   ============================================================ */
window.createWaveform = function createWaveform(audioEl, canvasEl, opts) {
  const waveCtx = canvasEl ? canvasEl.getContext('2d') : null;
  let audioCtx = null, analyser = null, waveData = null, waveRAF = null;
  const bg = (opts && opts.bg) || null;
  const barColor = (opts && opts.barColor) || '#8fe0d2';

  function ensureVisualizer() {
    if (audioCtx || !waveCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(audioEl);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      waveData = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch (_) { /* visualizer is optional, playback still works without it */ }
  }

  function drawWave() {
    if (!waveCtx) return;
    const w = canvasEl.width, h = canvasEl.height;
    if (bg) { waveCtx.fillStyle = bg; waveCtx.fillRect(0, 0, w, h); }
    else waveCtx.clearRect(0, 0, w, h);
    let hasSignal = false;
    if (analyser) {
      analyser.getByteFrequencyData(waveData);
      for (let i = 0; i < waveData.length; i++) { if (waveData[i] > 2) { hasSignal = true; break; } }
    }
    const bars = 16;
    const gap = 2;
    const barW = Math.floor((w - gap * (bars - 1)) / bars);
    const t = performance.now() / 400;
    for (let i = 0; i < bars; i++) {
      let v;
      if (hasSignal) {
        const idx = Math.floor((i / bars) * waveData.length);
        v = Math.max(3, Math.round((waveData[idx] / 255) * h));
      } else {
        v = Math.max(3, Math.round(5 + Math.sin(t + i * 0.6) * 4));
      }
      const x = i * (barW + gap);
      const y = h - v;
      waveCtx.fillStyle = barColor;
      waveCtx.fillRect(x, y, barW, v);
    }
    waveRAF = requestAnimationFrame(drawWave);
  }

  function startWave() {
    ensureVisualizer();
    if (!waveRAF) drawWave();
  }
  function stopWave() {
    if (waveRAF) { cancelAnimationFrame(waveRAF); waveRAF = null; }
    if (waveCtx) waveCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  return { ensureVisualizer, startWave, stopWave };
};
