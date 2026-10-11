/* Blog feed — rants posted from /admin (GET /api/posts?kind=rant), newest
   first. Text is always set with textContent, so whatever gets pasted shows
   exactly as typed and can never run as HTML. Category links filter by hash. */
(function () {
  var feed = document.getElementById('feed');
  var empty = document.getElementById('feed-empty');
  var cats = document.querySelectorAll('.blog-cats a');
  var posts = [];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function when(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function render() {
    var cat = (location.hash || '#all').slice(1);
    cats.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + cat); });
    var list = cat === 'all' ? posts : posts.filter(function (p) { return p.category === cat; });
    feed.textContent = '';
    empty.hidden = list.length > 0;
    list.forEach(function (p) {
      var art = el('article', 'post');
      var meta = el('div', 'post-meta');
      meta.appendChild(el('b', null, 'JayRewind'));
      meta.appendChild(el('span', null, when(p.createdAt)));
      if (p.category) meta.appendChild(el('span', null, '#' + p.category));
      art.appendChild(meta);
      if (p.title) art.appendChild(el('div', 'post-title', p.title));
      if (p.body) art.appendChild(el('div', 'post-body', p.body));
      if (p.image) { var im = el('img', 'post-img'); im.src = p.image; im.alt = p.title || ''; im.loading = 'lazy'; art.appendChild(im); }
      feed.appendChild(art);
    });
  }

  window.addEventListener('hashchange', render);
  fetch('/api/posts?kind=rant')
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(function (list) { posts = Array.isArray(list) ? list : []; render(); });
})();
