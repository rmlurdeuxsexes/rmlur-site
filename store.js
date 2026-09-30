/* /store — renders the catalog as 3.5" disks with the beat info handwritten
   on the label lines. Catalog source: /api/products (Neon), falling back to
   products.js. */
(function () {
  var grid = document.getElementById('grid');
  var empty = document.getElementById('empty');
  var audio = document.getElementById('audio');
  var playingBtn = null;

  // /api/products (Neon) is authoritative. If it is unavailable, use the
  // drop-folder catalog (data/beats.catalog.json) plus the static products.js.
  function loadProducts() {
    return fetch('/api/products')
      .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); })
      .then(function (list) { if (!list.length) throw new Error('empty'); return list; })
      .catch(function () {
        return fetch('data/beats.catalog.json', { cache: 'no-cache' })
          .then(function (r) { return r.ok ? r.json() : []; })
          .catch(function () { return []; })
          .then(function (published) {
            var seen = {};
            published.forEach(function (p) { seen[p.id] = true; });
            return published.concat((window.PRODUCTS || []).filter(function (p) { return !seen[p.id]; }));
          });
      });
  }

  function money(n) { return '$' + Number(n).toFixed(2).replace(/\.00$/, ''); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function options(p) {
    var o = (p.tiers || []).slice().sort(function (a, b) { return a.price - b.price; });
    if (p.exclusive) o.push({ id: 'exclusive', label: 'EXCLUSIVE', price: p.exclusive.price, stripeLink: p.exclusive.stripeLink });
    return o;
  }

  var checkoutLive = false;
  function buy(p, tier, btn) {
    function fallback() {
      location.href = tier.stripeLink || 'mailto:jayrewindbeatz@gmail.com?subject=' + encodeURIComponent('Buy "' + p.title + '" — ' + tier.label);
    }
    if (!checkoutLive) return fallback();
    btn.textContent = '…';
    fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, tierId: tier.id }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.url) location.href = j.url; else throw new Error(j.error); })
      .catch(function () { btn.textContent = 'Buy'; fallback(); });
  }

  function card(p) {
    var opts = options(p);
    var tier = opts[0] || null;
    var c = el('article', 'card');
    var disk = el('div', 'disk');
    var img = el('img');
    img.alt = '3.5 inch floppy disk labelled ' + p.title;
    img.src = 'assets/store/floppy-3.5-blue.png';
    img.onerror = function () { img.onerror = null; img.src = 'assets/store/floppy-3.5-blue.svg'; };
    disk.appendChild(img);

    var bpmKey = [p.bpm ? p.bpm + ' bpm' : '', p.key || ''].filter(Boolean).join(' · ');
    var priceLine = el('div', 'ln', '');
    function setPrice() { priceLine.textContent = tier ? money(tier.price) + ' · ' + tier.label + ' lease' : ''; }
    setPrice();
    disk.appendChild(el('div', 'ln t', p.title ? p.title.toLowerCase().replace(/(^|\s)\S/g, function (m) { return m.toUpperCase(); }) : ''));
    disk.appendChild(el('div', 'ln', p.genre || ''));
    disk.appendChild(el('div', 'ln', bpmKey));
    disk.appendChild(priceLine);
    c.appendChild(disk);

    var ctl = el('div', 'ctl');
    var play = el('button', 'btn', 'Play');
    play.setAttribute('aria-pressed', 'false');
    play.addEventListener('click', function () { toggle(p, play); });
    ctl.appendChild(play);
    if (opts.length > 1) {
      var sel = el('select', 'btn');
      sel.setAttribute('aria-label', 'License');
      opts.forEach(function (t, i) { var op = el('option', null, t.label + ' ' + money(t.price)); op.value = i; sel.appendChild(op); });
      sel.addEventListener('change', function () { tier = opts[sel.value]; setPrice(); });
      ctl.appendChild(sel);
    }
    var buyBtn = el('button', 'btn buy', 'Buy');
    buyBtn.addEventListener('click', function () { if (tier) buy(p, tier, buyBtn); });
    ctl.appendChild(buyBtn);
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

  fetch('/api/checkout').then(function (r) { return r.json(); }).then(function (j) {
    checkoutLive = !!j.enabled;
    if (j.testMode) { var b = el('div', 'testbar', 'TEST MODE — no real charges (use card 4242 4242 4242 4242)'); document.body.insertBefore(b, document.body.firstChild); }
  }).catch(function () {});

  loadProducts().then(function (list) {
    list = list || [];
    if (!list.length) { empty.hidden = false; return; }
    list.forEach(function (p) { grid.appendChild(card(p)); });
  });
})();
