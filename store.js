/* /store — renders the catalog as 3.5" disks with the beat info handwritten
   on the label lines. Catalog source: /api/products (Neon), falling back to
   products.js. */
(function () {
  var grid = document.getElementById('grid');
  var empty = document.getElementById('empty');
  var audio = document.getElementById('audio');
  var playingBtn = null;

  function loadProducts() {
    return fetch('/api/products')
      .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); })
      .catch(function () { return window.PRODUCTS || []; });
  }

  function money(n) { return '$' + Number(n).toFixed(2).replace(/\.00$/, ''); }
  function cheapest(p) {
    var t = (p.tiers || []).slice().sort(function (a, b) { return a.price - b.price; });
    return t[0] || null;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function card(p) {
    var tier = cheapest(p);
    var c = el('article', 'card');
    var disk = el('div', 'disk');
    var img = el('img');
    img.alt = '3.5 inch floppy disk labelled ' + p.title;
    img.src = 'assets/store/floppy-3.5-blue.png';
    img.onerror = function () { img.onerror = null; img.src = 'assets/store/floppy-3.5-blue.svg'; };
    disk.appendChild(img);

    var bpmKey = [p.bpm ? p.bpm + ' bpm' : '', p.key || ''].filter(Boolean).join(' · ');
    var lines = [
      [p.title ? p.title.toLowerCase().replace(/(^|\s)\S/g, function (m) { return m.toUpperCase(); }) : '', 't'],
      [p.genre || '', ''],
      [bpmKey, ''],
      [tier ? money(tier.price) + ' · ' + tier.label + ' lease' : '', '']
    ];
    lines.forEach(function (l) { disk.appendChild(el('div', 'ln ' + l[1], l[0])); });
    c.appendChild(disk);

    var ctl = el('div', 'ctl');
    var play = el('button', 'btn', 'Play');
    play.setAttribute('aria-pressed', 'false');
    play.addEventListener('click', function () { toggle(p, play); });
    ctl.appendChild(play);
    var buy = el('a', 'btn buy', 'Buy');
    if (tier && tier.stripeLink) { buy.href = tier.stripeLink; buy.target = '_blank'; buy.rel = 'noopener'; }
    else { buy.href = 'mailto:jayrewindbeatz@gmail.com?subject=' + encodeURIComponent('Buy "' + p.title + '"'); }
    ctl.appendChild(buy);
    c.appendChild(ctl);
    return c;
  }

  function reset() { if (playingBtn) { playingBtn.textContent = 'Play'; playingBtn.setAttribute('aria-pressed', 'false'); playingBtn = null; } }
  function toggle(p, btn) {
    if (playingBtn === btn) { audio.pause(); reset(); return; }
    reset();
    audio.src = p.preview || '';
    playingBtn = btn;
    btn.textContent = 'Pause';
    btn.setAttribute('aria-pressed', 'true');
    audio.play().catch(function () { btn.textContent = 'Unavailable'; playingBtn = null; });
  }
  audio.addEventListener('ended', reset);

  loadProducts().then(function (list) {
    list = list || [];
    if (!list.length) { empty.hidden = false; return; }
    list.forEach(function (p) { grid.appendChild(card(p)); });
  });
})();
