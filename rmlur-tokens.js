/* rmlur-tokens.js — the buyer's RMLUR Tokens card in the browser.
   The card id (rt_…) is the only thing stored here; balances always come from
   the server (/api/order?card=…), which counts them from real Stripe orders.
   window.RmlurTokens: card() · save(id) · load() → Promise<{card,balance,costs,…}|null> */
(function () {
  var KEY = 'rmlur.tokenCard', valid = function (id) { return /^rt_[A-Za-z0-9]{24}$/.test(id || ''); };
  function card() { try { var v = localStorage.getItem(KEY); return valid(v) ? v : null; } catch (e) { return null; } }
  function save(id) { if (!valid(id)) return; try { localStorage.setItem(KEY, id); } catch (e) {} }
  // a private card link (tokens.html#rt_…) also works as a way in on a new device
  var h = (location.hash || '').slice(1); if (valid(h)) save(h);
  var cache = null;
  function load() {
    var id = card(); if (!id) return Promise.resolve(null);
    return cache || (cache = fetch('/api/order?card=' + encodeURIComponent(id), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }));
  }
  window.RmlurTokens = { card: card, save: save, load: load, valid: valid };
})();
