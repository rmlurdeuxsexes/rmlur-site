/* The spinning Parental Advisory RMLUR badge, on every page (bottom-right).
   assets/spin/rmlur-pa-spin.webp is an animated WebP with a transparent
   background, cut from the producer's spin video. Visitors who ask for reduced
   motion get the first frame as a still. */
(function () {
  if (document.getElementById('rmlurSpin')) return;
  var img = document.createElement('img');
  img.id = 'rmlurSpin';
  img.src = '/assets/spin/rmlur-pa-spin.webp';
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
  (document.body ? Promise.resolve() : new Promise(function (r) { document.addEventListener('DOMContentLoaded', r); }))
    .then(function () { document.body.appendChild(img); });
})();
