/* The spinning Parental Advisory RMLUR badge, on every page (bottom-right).
   assets/spin/rmlur-pa-spin.webp is an animated WebP with a transparent
   background, cut from the producer's spin video. Visitors who ask for reduced
   motion get the first frame as a still. */
(function () {
  if (document.getElementById('rmlurSpin')) return;
  var img = document.createElement('img');
  img.id = 'rmlurSpin';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.decoding = 'async';
  var small = window.matchMedia && matchMedia('(max-width: 640px)').matches;
  img.style.cssText = 'position:fixed;right:' + (small ? 10 : 16) + 'px;bottom:' + (small ? 10 : 14) + 'px;width:' + (small ? 74 : 112) +
    'px;height:auto;z-index:2;pointer-events:none;user-select:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,.18))';
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // freeze on the first frame
    img.addEventListener('load', function once() {
      img.removeEventListener('load', once);
      try { var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); img.src = c.toDataURL('image/png'); } catch (e) {}
    });
  }
  // decoration only: wait until the page itself has finished loading, then add it when the browser is idle
  function add() { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(function () {
    img.src = '/assets/spin/rmlur-pa-spin-sm.webp';   // badge-sized copy (~180 KB vs 900 KB full-size), fetched only now
    document.body.appendChild(img);
  }); }
  if (document.readyState === 'complete') add(); else window.addEventListener('load', add);
})();
