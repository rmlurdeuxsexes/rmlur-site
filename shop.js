/* RMLUR SHOP — storefront logic (no build step, no framework) */
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('bad response');
    return await res.json();
  } catch (err) {
    console.error('[shop] failed to load /api/products:', err);
  }
  console.warn('[shop] falling back to local products.js catalog');
  return window.PRODUCTS || [];
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
      pdpInfoPanel.innerHTML = `<div class="pdp-info-meta">${metaHtml}</div><p>${p.info || ''}</p><p class="pdp-license"><a href="/licenses.html" target="_blank" rel="noopener">License terms for this purchase &rarr;</a></p>`;
    }
  }
  pdpPlay.addEventListener('click', () => { if (pdpProduct) togglePreview(pdpProduct); });

  /* ---------- 3D cassette bay — the bay IS the navigator/store now: type
     tabs, genre pills, search and sort all live as physical controls on
     the case itself (see cassette-bay.js). shop.js just loads the catalog,
     hands it to the bay, and owns the PDP/preview-player/purchase flow the
     bay's onSelect callback triggers. ---------- */
  products = await loadProducts();
  window.cassetteBay.init(products, {
    onSelect: (p) => openPDP(p),
    onPreview: (p) => { if (p && p.preview) safePlay(p.preview); },
    arrived: arrivedFromFloppy,
    emptyStateEl: emptyState,
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
});
