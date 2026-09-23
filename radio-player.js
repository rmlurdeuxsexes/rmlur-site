/* ============================================================
   RADIO PLAYER — site-wide floating ambient loop, separate from
   the homepage MPC's pad audio. One script tag per page injects
   its own DOM (no per-page HTML to keep in sync). Visual intent:
   transparent and embedded into the page like the watermark, not
   a boxed player widget — a brief "NOW PLAYING" card announces a
   track change (Music-Choice-ID style) then recedes into a small
   persistent reactive waveform, not a permanent now-playing bar.

   PLACEHOLDER CONTENT: TRACKS below points at the existing
   assets/beats/*.mp3 one-shots purely so the animation/timing can
   be seen and approved. Swap in real mixes/DJ sets/collab tracks
   here once they're ready — nothing else needs to change.
   ============================================================ */
(function () {
  'use strict';

  const TRACKS = [
    { title: 'Loop Sketch 01', src: 'assets/beats/eight-oh-eight-1.mp3' },
    { title: 'Loop Sketch 02', src: 'assets/beats/bass-1.mp3' },
    { title: 'Loop Sketch 03', src: 'assets/beats/kick-2.mp3' },
    { title: 'Loop Sketch 04', src: 'assets/beats/snare-1.mp3' },
  ];
  // How long each placeholder holds before advancing — deliberately
  // decoupled from the underlying clip's real length (these one-shots
  // are under a second) so the pacing already reads right once real
  // full-length mixes replace them.
  const DISPLAY_MS = 9000;

  const root = document.createElement('div');
  root.className = 'radio-player';
  root.setAttribute('role', 'button');
  root.setAttribute('aria-label', 'RMLUR radio — play/pause');
  root.innerHTML =
    '<canvas class="radio-player__wave" width="64" height="28"></canvas>' +
    '<div class="radio-player__title"></div>' +
    '<div class="radio-player__toast">' +
      '<div class="radio-player__toast-label">NOW PLAYING</div>' +
      '<div class="radio-player__toast-title"></div>' +
    '</div>';

  const audioEl = new Audio();
  audioEl.volume = 0.5;

  let trackIndex = -1;
  let playing = false;
  let audioCtx = null, analyser = null, timeData = null;
  let advanceTimer = null;

  const waveCanvas = root.querySelector('.radio-player__wave');
  const waveCtx = waveCanvas.getContext('2d');
  const titleEl = root.querySelector('.radio-player__title');
  const toastTitleEl = root.querySelector('.radio-player__toast-title');

  function ensureAudioGraph() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(audioEl);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      timeData = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch (_) { /* waveform is optional, playback still works without it */ }
  }

  function nextTrack() {
    trackIndex = (trackIndex + 1) % TRACKS.length;
    const track = TRACKS[trackIndex];
    audioEl.src = track.src;
    if (playing) audioEl.play().catch(() => {});
    titleEl.textContent = track.title;
    toastTitleEl.textContent = track.title;
    root.classList.remove('radio-player--toast');
    void root.offsetWidth; // restart the CSS animation on repeat tracks
    root.classList.add('radio-player--toast');
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(nextTrack, DISPLAY_MS);
  }

  function toggle() {
    playing = !playing;
    root.classList.toggle('radio-player--playing', playing);
    if (playing) {
      ensureAudioGraph();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      if (!audioEl.src) nextTrack();
      else audioEl.play().catch(() => {});
    } else {
      audioEl.pause();
    }
  }

  function drawWave() {
    requestAnimationFrame(drawWave);
    const w = waveCanvas.width, h = waveCanvas.height, mid = h / 2;
    waveCtx.clearRect(0, 0, w, h);
    waveCtx.lineWidth = 1.5;
    waveCtx.strokeStyle = 'rgba(95,163,156,0.9)'; // --teal
    waveCtx.shadowColor = 'rgba(95,163,156,0.8)';
    waveCtx.shadowBlur = playing ? 6 : 0;
    waveCtx.beginPath();
    if (analyser && playing && !audioEl.paused) {
      analyser.getByteTimeDomainData(timeData);
      const n = timeData.length;
      for (let i = 0; i < n; i++) {
        const v = (timeData[i] - 128) / 128;
        const x = (i / (n - 1)) * w;
        const y = mid - v * mid * 0.85;
        if (i === 0) waveCtx.moveTo(x, y); else waveCtx.lineTo(x, y);
      }
    } else {
      // Idle breathing line — reads as alive/embedded even at rest,
      // not a dead placeholder waiting to be clicked.
      const t = performance.now() * 0.0015;
      for (let x = 0; x <= w; x += 4) {
        const y = mid + Math.sin(x * 0.09 + t) * 2.5;
        if (x === 0) waveCtx.moveTo(x, y); else waveCtx.lineTo(x, y);
      }
    }
    waveCtx.stroke();
  }

  audioEl.addEventListener('ended', nextTrack);
  root.addEventListener('click', toggle);

  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(root);
    drawWave();
  });
})();
