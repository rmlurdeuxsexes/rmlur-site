/* Gallery — art posted from /admin (GET /api/posts?kind=art, newest first),
   then the pieces already in the repo so the wall is never empty. Click a
   piece for the full-bleed view (same overlay as the portfolio page). */
(function () {
  var SEED = [
    { image: 'assets/sticker-girl.png', title: 'Pink boa' },
    { image: 'assets/sticker-buy-beats-here.png', title: 'Buyyy beats @ HERE!' },
    { image: 'assets/sticker-rmlur-logo.png', title: 'rmlur deux :: sexes' },
    { image: 'assets/sticker-rmlur-demo.png', title: 'RMLUR demo' },
    { image: 'assets/sticker-beats-text.png', title: 'beats' },
    { image: 'assets/midnight-pager.jpg', title: 'Midnight Pager' },
    { image: 'assets/getty-tape.jpg', title: 'Getty tape' },
    { image: 'assets/deux-sexes-drums-v1.jpg', title: 'Deux Sexes Drums V1' },
    { image: 'assets/mpc-hero.jpg', title: 'MPC 2000XL' }
  ].concat((window.JASON_PHOTOS || []).map(function (p) { return { image: p.src, title: p.alt }; }));

  var wall = document.getElementById('gallery');
  var overlay = document.getElementById('lightbox-overlay');
  var big = document.getElementById('lightbox-img');
  var cap = document.getElementById('lightbox-cap');

  function open(p) {
    big.src = p.image; big.alt = p.title || '';
    cap.textContent = p.title || '';
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function close() { overlay.hidden = true; document.body.style.overflow = ''; }
  document.getElementById('lightbox-back').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) close(); });

  function hang(list) {
    list.forEach(function (p) {
      var fig = document.createElement('figure');
      fig.className = 'gallery-piece';
      var im = document.createElement('img');
      im.src = p.image; im.alt = p.title || ''; im.loading = 'lazy';
      fig.appendChild(im);
      if (p.title) { var c = document.createElement('figcaption'); c.className = 'gallery-cap'; c.textContent = p.title; fig.appendChild(c); }
      fig.addEventListener('click', function () { open(p); });
      wall.appendChild(fig);
    });
  }

  fetch('/api/posts?kind=art')
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(function (posted) { hang((Array.isArray(posted) ? posted : []).concat(SEED)); });
})();
