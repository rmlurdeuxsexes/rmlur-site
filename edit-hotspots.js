/* ============================================================
   HOTSPOT EDITOR — drag/resize any hotspot directly on the page.
   ============================================================
   Load index.html with ?edit=1 in the URL (e.g.
   http://localhost:8123/index.html?edit=1). Every hotspot gets a
   dashed green outline and a resize handle in its bottom-right
   corner. Click-drag the body to move it, drag the handle to
   resize it. A readout in the top-right shows the live left/top/
   width/height % for whichever one you're touching — click "Copy"
   to grab the exact object to paste into HERO_HOTSPOTS in
   hotspots.js. Does nothing at all without ?edit=1.
   ============================================================ */
(function () {
  if (!/[?&]edit=1(&|$)/.test(location.search)) return;

  document.addEventListener('DOMContentLoaded', () => {
    const frame = document.getElementById('hero-frame');
    if (!frame) return;

    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed', 'top:8px', 'right:8px', 'z-index:99999',
      'background:#000', 'color:#7CFC00', 'font:11px/1.5 monospace',
      'padding:10px 12px', 'border:1px solid #7CFC00', 'white-space:pre',
      'max-width:320px'
    ].join(';');
    panel.innerHTML = '<div id="edit-readout">Drag a dashed box to edit it.</div>' +
      '<button id="edit-copy" style="margin-top:6px;font:11px monospace;background:#7CFC00;color:#000;border:none;padding:3px 8px;cursor:pointer">Copy</button>';
    document.body.appendChild(panel);

    const readout = panel.querySelector('#edit-readout');
    const copyBtn = panel.querySelector('#edit-copy');
    let lastSnippet = '';

    function snippetFor(el) {
      const id = el.dataset.hotspotId || '?';
      const left = parseFloat(el.style.left).toFixed(2);
      const top = parseFloat(el.style.top).toFixed(2);
      const width = parseFloat(el.style.width).toFixed(2);
      const height = parseFloat(el.style.height).toFixed(2);
      return `"${id}": { left: ${left}, top: ${top}, width: ${width}, height: ${height} }`;
    }
    function updateReadout(el) {
      lastSnippet = snippetFor(el);
      readout.textContent = lastSnippet;
    }
    copyBtn.addEventListener('click', () => {
      if (!lastSnippet) return;
      navigator.clipboard.writeText(lastSnippet).catch(() => {});
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 900);
    });

    function makeEditable(el) {
      el.style.cursor = 'move';
      el.style.outline = '2px dashed #7CFC00';
      el.style.background = 'rgba(124,252,0,0.18)';

      const handle = document.createElement('div');
      handle.style.cssText = [
        'position:absolute', 'right:-6px', 'bottom:-6px',
        'width:14px', 'height:14px', 'background:#7CFC00',
        'cursor:nwse-resize', 'z-index:10', 'border:1px solid #000'
      ].join(';');
      el.appendChild(handle);

      let mode = null; // 'drag' | 'resize'
      let startX = 0, startY = 0, startLeft = 0, startTop = 0, startW = 0, startH = 0;

      el.addEventListener('mousedown', e => {
        if (e.target === handle) return;
        e.preventDefault();
        mode = 'drag';
        startX = e.clientX; startY = e.clientY;
        startLeft = parseFloat(el.style.left);
        startTop = parseFloat(el.style.top);
      });
      handle.addEventListener('mousedown', e => {
        e.preventDefault(); e.stopPropagation();
        mode = 'resize';
        startX = e.clientX; startY = e.clientY;
        startW = parseFloat(el.style.width);
        startH = parseFloat(el.style.height);
      });
      window.addEventListener('mousemove', e => {
        if (!mode) return;
        const r = frame.getBoundingClientRect();
        const dxPct = (e.clientX - startX) / r.width * 100;
        const dyPct = (e.clientY - startY) / r.height * 100;
        if (mode === 'drag') {
          el.style.left = (startLeft + dxPct).toFixed(2) + '%';
          el.style.top = (startTop + dyPct).toFixed(2) + '%';
        } else {
          el.style.width = Math.max(0.5, startW + dxPct).toFixed(2) + '%';
          el.style.height = Math.max(0.5, startH + dyPct).toFixed(2) + '%';
        }
        updateReadout(el);
      });
      window.addEventListener('mouseup', () => { mode = null; });

      // Swallow the normal click-to-navigate/play behavior while in edit mode.
      el.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); }, true);
    }

    document.querySelectorAll('#hero-hotspots [data-hotspot-id]').forEach(makeEditable);
  });
})();
