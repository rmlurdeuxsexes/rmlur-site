/* RMLUR SHOP — storefront logic (no build step, no framework) */
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('bad response');
    return await res.json();
  } catch (err) {
    console.error('[shop] failed to load /api/products:', err);
    return [];
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  let products = [];

  const emptyState = document.getElementById('empty-state');
  const audio = document.getElementById('preview-audio');
  const playerBar = document.getElementById('player-bar');
  const pbPlay = document.getElementById('pb-play');
  const pbStop = document.getElementById('pb-stop');
  const pbTitle = document.getElementById('pb-title');
  const pbBuy = document.getElementById('pb-buy');
  const pbProgress = document.getElementById('pb-progress');
  const pbWave = document.getElementById('pb-wave');
  const wave = window.createWaveform(audio, pbWave);

  let currentId = null;
  const filterState = { type: 'all', genre: 'all', search: '', sort: 'catalog' };
  let cartCount = 0;

  /* ---------- arrival from the MPC's floppy transition (app.js goToShop) —
     fade out the same #page-fade overlay it faded in before navigating ---------- */
  const pageFade = document.getElementById('page-fade');
  const arrivedFromFloppy = new URLSearchParams(location.search).get('from') === 'floppy';
  if (arrivedFromFloppy) {
    pageFade.classList.add('show', 'no-transition');
    requestAnimationFrame(() => {
      pageFade.classList.remove('no-transition');
      requestAnimationFrame(() => pageFade.classList.remove('show'));
    });
  }

  /* ---------- helpers ---------- */
  function minPrice(p) {
    const prices = (p.tiers || []).map(t => t.price);
    return prices.length ? Math.min(...prices) : 0;
  }

  /* ---------- safeStop: never interrupt play() ---------- */
  let playPromise = Promise.resolve();
  async function safeStop() {
    try { await playPromise; } catch (_) {}
    audio.pause();
  }
  async function safePlay(src) {
    await safeStop();
    if (src && audio.src !== src) audio.src = src;
    wave.ensureVisualizer();
    playPromise = audio.play();
    try { await playPromise; } catch (_) {}
    wave.startWave();
  }

  /* ================= PRODUCT DETAIL OVERLAY ================= */
  const pdp = document.getElementById('pdp-overlay');
  const pdpBack = document.getElementById('pdp-back');
  const pdpCartCount = document.getElementById('pdp-cart-count');
  const pdpCover = document.getElementById('pdp-cover');
  const pdpPlay = document.getElementById('pdp-play');
  const pdpCollapsed = document.getElementById('pdp-collapsed');
  const pdpExpanded = document.getElementById('pdp-expanded');
  const pdpTitleC = document.getElementById('pdp-title-c');
  const pdpPriceC = document.getElementById('pdp-price-c');
  const pdpExpand = document.getElementById('pdp-expand');
  const pdpStatus = document.getElementById('pdp-status');
  const pdpCloseX = document.getElementById('pdp-close-x');
  const pdpInfoQ = document.getElementById('pdp-info-q');
  const pdpPrice = document.getElementById('pdp-price');
  const pdpTiers = document.getElementById('pdp-tiers');
  const pdpExclusiveBtn = document.getElementById('pdp-exclusive');
  const pdpInfoToggle = document.getElementById('pdp-info-toggle');
  const pdpInfoPanel = document.getElementById('pdp-info-panel');

  let pdpProduct = null;
  let pdpSelectedTier = null;

  function openPDP(p, opts) {
    opts = opts || {};
    pdpProduct = p;
    pdpSelectedTier = null;
    pdpCover.src = p.cover;
    pdpCover.alt = p.title + ' cover art';
    pdpTitleC.textContent = p.title;
    pdpPriceC.textContent = 'FROM $' + minPrice(p).toFixed(2);
    pdpStatus.textContent = 'SELECT FORMAT';
    pdpStatus.classList.remove('flash');
    pdpInfoPanel.hidden = true;
    renderTiers(p);
    pdp.hidden = false;
    document.body.style.overflow = 'hidden';
    if (opts.expanded) {
      pdpCollapsed.hidden = true;
      pdpExpanded.hidden = false;
    } else {
      pdpCollapsed.hidden = false;
      pdpExpanded.hidden = true;
    }
  }
  function closePDP() {
    pdp.hidden = true;
    document.body.style.overflow = '';
    pdpProduct = null;
  }
  function renderTiers(p) {
    pdpTiers.innerHTML = '';
    (p.tiers || []).forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'pdp-tier';
      btn.dataset.tierId = t.id;
      btn.innerHTML = `${t.label}<span class="tier-price">$${t.price.toFixed(2)}</span>`;
      btn.addEventListener('click', () => selectTier(p, t));
      pdpTiers.appendChild(btn);
    });
    if (p.exclusive) {
      pdpExclusiveBtn.hidden = false;
      pdpExclusiveBtn.textContent = `EXCLUSIVE RIGHTS — $${p.exclusive.price.toFixed(2)}`;
      pdpExclusiveBtn.onclick = () => selectTier(p, { id: 'exclusive', label: 'EXCLUSIVE', price: p.exclusive.price, stripeLink: p.exclusive.stripeLink });
    } else {
      pdpExclusiveBtn.hidden = true;
    }
  }
  function selectTier(p, tier) {
    pdpSelectedTier = tier;
    document.querySelectorAll('.pdp-tier').forEach(el => {
      el.classList.toggle('selected', el.dataset.tierId === tier.id);
    });
    pdpStatus.textContent = 'ADDING';
    pdpStatus.classList.add('flash');
    setTimeout(() => {
      pdpStatus.classList.remove('flash');
      pdpStatus.textContent = tier.label + ' ADDED';
      cartCount++;
      pdpCartCount.textContent = cartCount;
      showBuyButton(p, tier);
    }, 700);
  }
  function showBuyButton(p, tier) {
    let btn = document.getElementById('pdp-buy-link');
    if (!btn) {
      btn = document.createElement('a');
      btn.id = 'pdp-buy-link';
      btn.className = 'buy-btn pdp-buy-btn';
      btn.target = '_blank';
      btn.rel = 'noopener';
      pdpInfoToggle.insertAdjacentElement('beforebegin', btn);
    }
    btn.href = tier.stripeLink;
    btn.textContent = `BUY ${tier.label} — $${tier.price.toFixed(2)}`;
  }

  pdpExpand.addEventListener('click', () => {
    pdpCollapsed.hidden = true;
    pdpExpanded.hidden = false;
  });
  pdpCloseX.addEventListener('click', () => {
    pdpExpanded.hidden = true;
    pdpCollapsed.hidden = false;
    const btn = document.getElementById('pdp-buy-link');
    if (btn) btn.remove();
  });
  pdpBack.addEventListener('click', closePDP);
  pdpInfoQ.addEventListener('click', () => toggleInfo());
  pdpInfoToggle.addEventListener('click', () => toggleInfo());
  function toggleInfo() {
    if (!pdpProduct) return;
    const willShow = pdpInfoPanel.hidden;
    pdpInfoPanel.hidden = !willShow;
    if (willShow) {
      const p = pdpProduct;
      const meta = [];
      if (p.bpm) meta.push(['BPM', p.bpm]);
      if (p.key) meta.push(['KEY', p.key]);
      if (p.bars) meta.push(['BARS', p.bars]);
      if (p.genre) meta.push(['GENRE', p.genre]);
      const metaHtml = meta.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
      pdpInfoPanel.innerHTML = `<div class="pdp-info-meta">${metaHtml}</div><p>${p.info || ''}</p>`;
    }
  }
  pdpPlay.addEventListener('click', () => { if (pdpProduct) togglePreview(pdpProduct); });

  /* ---------- 3D cassette bay — renders sleeves, hands selections back here ---------- */
  function applyFilter() {
    const q = filterState.search.trim().toLowerCase();
    const visible = products.filter((p) =>
      (filterState.type === 'all' || p.type === filterState.type) &&
      (filterState.genre === 'all' || window.cassetteBay.genreInfo(p.genre).genreKey === filterState.genre) &&
      (!q || p.title.toLowerCase().includes(q) || (p.tags || []).some((t) => t.toLowerCase().includes(q)))
    );
    emptyState.hidden = visible.length > 0;
    window.cassetteBay.setFilter(filterState);
  }
  products = await loadProducts();
  window.cassetteBay.init(products, { onSelect: (p) => openPDP(p), arrived: arrivedFromFloppy });

  /* ---------- genre pills — derived from the real catalog, never hardcoded;
     colored to match cassette-bay.js's own genre divider walls ---------- */
  const genrePillsEl = document.getElementById('genre-pills');
  const seenGenres = new Map();
  products.forEach((p) => {
    const gi = window.cassetteBay.genreInfo(p.genre);
    if (!seenGenres.has(gi.genreKey)) seenGenres.set(gi.genreKey, gi);
  });
  seenGenres.forEach((gi) => {
    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.dataset.genre = gi.genreKey;
    btn.textContent = gi.genreLabel;
    btn.addEventListener('click', () => {
      genrePillsEl.querySelectorAll('.pill').forEach((el) => { el.classList.remove('active'); el.style.background = ''; });
      btn.classList.add('active');
      btn.style.background = '#' + gi.color.toString(16).padStart(6, '0');
      filterState.genre = gi.genreKey;
      applyFilter();
    });
    genrePillsEl.appendChild(btn);
  });
  genrePillsEl.querySelector('[data-genre="all"]').addEventListener('click', (e) => {
    genrePillsEl.querySelectorAll('.pill').forEach((el) => { el.classList.remove('active'); el.style.background = ''; });
    e.currentTarget.classList.add('active');
    filterState.genre = 'all';
    applyFilter();
  });

  document.getElementById('shop-search').addEventListener('input', (e) => {
    filterState.search = e.target.value;
    applyFilter();
  });
  document.getElementById('shop-sort').addEventListener('change', (e) => {
    filterState.sort = e.target.value;
    applyFilter();
  });

  /* ---------- preview player ---------- */
  async function togglePreview(p) {
    if (currentId === p.id && !audio.paused) {
      await safeStop();
    } else {
      currentId = p.id;
      pbTitle.textContent = `${p.title} — ${p.subtitle || (p.type === 'kit' ? 'drum kit' : 'beat')}`;
      pbBuy.href = (p.tiers && p.tiers[0]) ? p.tiers[0].stripeLink : '#';
      playerBar.hidden = false;
      await safePlay(p.preview);
    }
  }

  pbPlay.addEventListener('click', async () => {
    if (!currentId) return;
    if (audio.paused) await safePlay();
    else await safeStop();
  });
  pbStop.addEventListener('click', async () => {
    await safeStop();
    audio.currentTime = 0;
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) pbProgress.style.width = (audio.currentTime / audio.duration * 100) + '%';
  });
  audio.addEventListener('ended', () => { pbProgress.style.width = '0%'; });

  /* ---------- filter tabs ---------- */
  document.querySelectorAll('.tab[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      filterState.type = btn.dataset.filter;
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter();
    });
  });

  applyFilter();
});
