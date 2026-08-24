/* ============================================================
   HOTSPOT EDITOR — drag/resize any hotspot directly on the page.
   ============================================================
   Load index.html with ?edit=1 in the URL (e.g.
   http://localhost:8123/index.html?edit=1). Every hotspot gets a
   dashed green outline and a resize handle in its bottom-right
   corner. Click-drag the body to move it, drag the handle to
   resize it.

   Every change is saved to localStorage immediately (per hotspot id)
   and re-applied automatically the next time this page loads in edit
   mode — closing the tab, reloading, or coming back tomorrow does NOT
   lose your work.

   The panel in the top-right always shows ALL hotspots' current
   positions (not just the one you're touching) — hit "Copy All" any
   time to grab the whole block and paste it into HERO_HOTSPOTS in
   hotspots.js. "Reset saved" clears localStorage back to the values
   baked into hotspots.js.

   Does nothing at all without ?edit=1.
   ============================================================ */
(function () {
  if (!/[?&]edit=1(&|$)/.test(location.search)) return;

  const STORAGE_KEY = 'rmlur-hotspot-overrides';

  function loadOverrides() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (_) { return {}; }
  }
  function saveOverride(id, pos) {
    const all = loadOverrides();
    all[id] = pos;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  document.addEventListener('DOMContentLoaded', () => {
    const frame = document.getElementById('hero-frame');
    if (!frame) return;

    // Re-apply anything saved from a previous session before making things editable.
    const overrides = loadOverrides();
    document.querySelectorAll('#hero-hotspots [data-hotspot-id]').forEach(el => {
      const id = el.dataset.hotspotId;
      const pos = overrides[id];
      if (pos) {
        el.style.left = pos.left + '%';
        el.style.top = pos.top + '%';
        el.style.width = pos.width + '%';
        el.style.height = pos.height + '%';
      }
    });

    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed', 'top:8px', 'right:8px', 'z-index:99999',
      'background:#000', 'color:#7CFC00', 'font:11px/1.5 monospace',
      'padding:10px 12px', 'border:1px solid #7CFC00', 'white-space:pre',
      'max-width:340px', 'max-height:90vh', 'overflow:auto'
    ].join(';');
    panel.innerHTML =
      '<div style="margin-bottom:6px;opacity:.7">Drag a dashed box to move it, corner handle to resize. Autosaved.</div>' +
      '<div id="edit-readout">(nothing touched yet this session)</div>' +
      '<button id="edit-copy" style="margin-top:8px;font:11px monospace;background:#7CFC00;color:#000;border:none;padding:3px 8px;cursor:pointer">Copy All</button> ' +
      '<button id="edit-reset" style="margin-top:8px;font:11px monospace;background:#333;color:#7CFC00;border:1px solid #7CFC00;padding:3px 8px;cursor:pointer">Reset saved</button>';
    document.body.appendChild(panel);

    const readout = panel.querySelector('#edit-readout');
    const copyBtn = panel.querySelector('#edit-copy');
    const resetBtn = panel.querySelector('#edit-reset');

    function allSnippet() {
      const els = document.querySelectorAll('#hero-hotspots [data-hotspot-id]');
      const lines = Array.from(els).map(el => {
        const id = el.dataset.hotspotId;
        const left = parseFloat(el.style.left).toFixed(2);
        const top = parseFloat(el.style.top).toFixed(2);
        const width = parseFloat(el.style.width).toFixed(2);
        const height = parseFloat(el.style.height).toFixed(2);
        return `  "${id}": { left: ${left}, top: ${top}, width: ${width}, height: ${height} },`;
      });
      return lines.join('\n');
    }
    function refreshReadout() {
      readout.textContent = allSnippet();
    }
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(allSnippet()).catch(() => {});
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy All'; }, 900);
    });
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
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

      function persist() {
        saveOverride(el.dataset.hotspotId, {
          left: parseFloat(el.style.left),
          top: parseFloat(el.style.top),
          width: parseFloat(el.style.width),
          height: parseFloat(el.style.height)
        });
      }

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
        refreshReadout();
      });
      window.addEventListener('mouseup', () => {
        if (mode) persist();
        mode = null;
      });

      // Swallow the normal click-to-navigate/play behavior while in edit mode.
      el.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); }, true);
    }

    document.querySelectorAll('#hero-hotspots [data-hotspot-id]').forEach(makeEditable);
    refreshReadout();
  });
})();
