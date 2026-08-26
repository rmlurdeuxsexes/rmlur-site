/* RMLUR SHOP — storefront logic (no build step, no framework) */
document.addEventListener('DOMContentLoaded', () => {
  const products = window.PRODUCTS || [];

  const tapeGrid = document.getElementById('tape-grid');
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
  let filter = 'all';
  let cartCount = 0;

  /* ---------- helpers ---------- */
  function minPrice(p) {
    const prices = (p.tiers || []).map(t => t.price);
    return prices.length ? Math.min(...prices) : 0;
  }
  /* ---------- floppy disk cover art (generated, no image assets) ---------- */
  const FLOPPY_COLORS = ['#1a1a1a', '#2d5fb3', '#c0392b', '#e0b93c', '#7e3fa3', '#3f9e94', '#9aa0a6'];
  function wrapTitle(title, maxChars) {
    const words = title.split(' ');
    const lines = [];
    let line = '';
    words.forEach(w => {
      const next = line ? line + ' ' + w : w;
      if (next.length > maxChars && line) { lines.push(line); line = w; }
      else line = next;
    });
    if (line) lines.push(line);
    return lines.slice(0, 2);
  }
  function hashOf(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h;
  }
  function floppySVG(p) {
    const h = hashOf(p.id);
    const color = FLOPPY_COLORS[h % FLOPPY_COLORS.length];
    const tapeRotate = ((h >> 8) % 7) - 3; // -3..3deg, per-beat but consistent
    const lines = wrapTitle(p.title, 14);
    const lineY = lines.length === 2 ? [53, 63] : [58];
    const text = lines.map((l, i) =>
      `<text x="50" y="${lineY[i]}" text-anchor="middle" font-family="'Kalam',cursive" font-size="9" fill="#22232b">${l}</text>`
    ).join('');
    return `
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="shutter-${p.id}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f4f5f7"/>
            <stop offset="45%" stop-color="#c7cad0"/>
            <stop offset="55%" stop-color="#aeb2b9"/>
            <stop offset="100%" stop-color="#e2e4e8"/>
          </linearGradient>
        </defs>
        <path d="M9,4 L91,4 L91,96 L4,96 L4,11 Z" fill="${color}"/>
        <path d="M13,7 L17,11 L9,11 Z" fill="rgba(0,0,0,.35)"/>
        <text x="85" y="10" text-anchor="middle" font-family="'IBM Plex Mono',monospace" font-size="4" fill="rgba(255,255,255,.35)">HD</text>

        <rect x="9" y="13" width="82" height="19" fill="url(#shutter-${p.id})" stroke="rgba(0,0,0,.25)" stroke-width=".5"/>
        <rect x="31" y="15.5" width="27" height="14" fill="#242424"/>
        <rect x="61" y="17" width="10" height="10" fill="#1a1a1a"/>

        <g transform="rotate(${tapeRotate} 50 58)">
          <rect x="15" y="46" width="70" height="24" fill="#e9e0c8" stroke="rgba(0,0,0,.08)"/>
          ${text}
        </g>

        <rect x="9" y="89" width="6" height="6" fill="rgba(0,0,0,.4)"/>
        <rect x="85" y="89" width="6" height="6" fill="#eee" stroke="rgba(0,0,0,.2)" stroke-width=".5"/>
      </svg>`;
  }

  function dataBits(p) {
    const bits = [];
    if (p.bpm) bits.push(p.bpm + ' BPM');
    if (p.key) bits.push(p.key);
    if (p.tags && p.tags.length) bits.push(p.tags[0]);
    return bits.join(' ▪ ');
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

  /* ---------- shop grid ---------- */
  function renderGrid() {
    const items = products.filter(p => filter === 'all' || p.type === filter);
    tapeGrid.innerHTML = '';
    emptyState.hidden = items.length > 0;

    items.forEach(p => {
      const card = document.createElement('article');
      card.className = 'tape-card';
      card.dataset.id = p.id;
      const bits = dataBits(p);

      card.innerHTML = `
        <div class="tc-cover">
          ${floppySVG(p)}
          <button class="tc-play" aria-label="Preview ${p.title}">►</button>
        </div>
        <div class="tc-type">${p.type === 'kit' ? 'DRUM KIT' : 'BEAT'}</div>
        <div class="tc-title sr-only">${p.title}</div>
        <div class="tc-sub">${p.subtitle || ''}</div>
        ${bits ? `<span class="tc-data">${bits}</span>` : ''}
        <div class="tc-foot">
          <span class="tc-price">FROM $${minPrice(p).toFixed(2)}</span>
          <button class="buy-btn tc-buy">BUY</button>
        </div>`;

      card.querySelector('.tc-play').addEventListener('click', () => togglePreview(p));
      card.querySelector('.tc-cover').addEventListener('click', (e) => {
        if (e.target.closest('.tc-play')) return;
        openPDP(p);
      });
      card.querySelector('.tc-title').addEventListener('click', () => openPDP(p));
      card.querySelector('.tc-buy').addEventListener('click', () => openPDP(p, { expanded: true }));
      tapeGrid.appendChild(card);
    });
    markPlaying();
  }

  function markPlaying() {
    document.querySelectorAll('.tape-card').forEach(el => {
      el.classList.toggle('playing', el.dataset.id === currentId && !audio.paused);
    });
  }

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
    markPlaying();
  }

  pbPlay.addEventListener('click', async () => {
    if (!currentId) return;
    if (audio.paused) await safePlay();
    else await safeStop();
    markPlaying();
  });
  pbStop.addEventListener('click', async () => {
    await safeStop();
    audio.currentTime = 0;
    markPlaying();
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) pbProgress.style.width = (audio.currentTime / audio.duration * 100) + '%';
  });
  audio.addEventListener('ended', () => { pbProgress.style.width = '0%'; markPlaying(); });

  /* ---------- filter tabs ---------- */
  document.querySelectorAll('.tab[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      filter = btn.dataset.filter;
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid();
    });
  });

  renderGrid();
});
