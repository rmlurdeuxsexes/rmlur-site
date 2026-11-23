/* lcd-screen.js — draws the homepage LCD like the real MPC2000XL screen:
   blue backlight, white 5x7 dot-matrix text, inverted header + F-key tabs,
   a boxed track area, and a faint grid of unlit pixels.
   API: MpcLcd.mount(glassEl) then MpcLcd.show(state), state = {
     kind: 'idle' | 'pad' | 'store' | 'loading', n, label, action }.
   5x7 glyphs: LCD_FONT from luma.core (MIT), ASCII 32-126, 5 column bytes each,
   bit 0 = top row. */
(function () {
  var F = '000000000000005f00000003000300147f147f14242a7f2a12231308646236495522500005030000001c2241000041221c0014083e081408083e080800503000000808080808006060000020100804023e5149453e00427f400042615149462141454b311814127f1027454545393c4a49493001710905033649494936064949291e003636000000563600000814224100141414141400412214080201510906324979413e7e1111117e7f494949363e414141227f4141221c7f494949417f090909013e4149497a7f0808087f00417f41002040413f017f081422417f404040407f020c027f7f0408107f3e4141413e7f090909063e4151215e7f09192946464949493101017f01013f4040403f1f2040201f3f4038403f631408146307087008076151494543007f41410002040810200041417f0004020102044040404040000102040020545454787f484444383844444420384444487f3854545418087e0901020c5252523e7f0804047800447d40002040443d007f1028440000417f40007c041804787c0804047838444444387c14141408081414187c7c080404084854545420043f4440203c4040207c1c2040201c3c4030403c44281028440c5050503c4464544c44000836410000007f000000413608001008081008';
  var COLS = 33, ROWS = 6, CW = 6, CH = 8;          // 33x6 chars of 6x8 dot cells
  var DW = COLS * CW + 2, DH = ROWS * CH;          // 200 x 48 dots, ~ the glass's 4.15:1
  var TABS = ['PADS', 'SHOP', 'BEAT', 'PLAY', 'LINK', 'INFO'];
  var canvas, ctx, dots, state = { kind: 'idle' }, blink = true;

  function glyph(ch) {
    var c = ch.charCodeAt(0);
    if (c === 0x25BA) return [0x7f, 0x3e, 0x1c, 0x08, 0x00];   // ► (not in the ASCII table)
    if (c < 32 || c > 126) c = 63;                              // '?'
    var o = (c - 32) * 10, g = [];
    for (var i = 0; i < 5; i++) g.push(parseInt(F.substr(o + i * 2, 2), 16));
    return g;
  }
  function clear() { dots = new Uint8Array(DW * DH); }
  function set(x, y, v) { if (x >= 0 && y >= 0 && x < DW && y < DH) dots[y * DW + x] = v; }
  function fill(x, y, w, h, v) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) set(x + i, y + j, v); }
  // text at dot position (x,y); inv = draw dark glyphs on a lit block
  function text(s, x, y, inv) {
    s = String(s);
    if (inv) fill(x - 1, y - 1, s.length * CW + 1, CH, 1);
    for (var k = 0; k < s.length; k++) {
      var g = glyph(s[k]);
      for (var i = 0; i < 5; i++) for (var r = 0; r < 7; r++)
        if (g[i] >> r & 1) set(x + k * CW + i, y + r, inv ? 2 : 1);   // 2 = dark dot cut out of a lit block
    }
  }
  function row(s, line, inv) { text(s, 1, line * CH + 1, inv); }
  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s.slice(0, n); }
  function two(n) { return n < 10 ? '0' + n : '' + n; }
  function box(y0, y1) { fill(0, y0, DW, 1, 1); fill(0, y1, DW, 1, 1); fill(0, y0, 1, y1 - y0 + 1, 1); fill(DW - 1, y0, 1, y1 - y0 + 1, 1); }
  function tabs(active) {
    var w = Math.floor(DW / 6);
    for (var i = 0; i < 6; i++) {
      var x = i * w + 1, t = TABS[i];
      fill(x, 5 * CH, w - 2, CH, 1);
      text(t, x + Math.floor((w - 2 - t.length * CW) / 2) + 1, 5 * CH + 1, true);
      if (i === active) fill(x, 5 * CH + CH - 1, w - 2, 1, 0);   // notch under the active tab
    }
  }

  function compose() {
    clear();
    var s = state;
    row(pad('Sq:01-RMLUR::DEUX SEXES', COLS), 0, true);
    if (s.kind === 'pad') {
      row('Pad:' + two(s.n) + '  Velo:127   Bank:A  On:YES', 1);
      box(2 * CH + 1, 5 * CH - 2);
      text(pad('Tr:' + two(s.n) + '-(' + s.label + ')', 31), 3, 2 * CH + 4);
      text(pad((blink ? '►' : ' ') + ' ' + s.action, 31), 3, 3 * CH + 6);
      tabs(s.sound ? 3 : (s.store ? 1 : 4));
    } else if (s.kind === 'ctl') {
      row('Key:' + s.label, 1);
      box(2 * CH + 1, 5 * CH - 2);
      text(pad('(' + s.label + ')', 31), 3, 2 * CH + 4);
      if (typeof s.level === 'number') {                         // knob: level bar like a real meter
        text('LVL', 3, 3 * CH + 6);
        var bw = DW - 4 * CW - 8; fill(3 + 4 * CW, 3 * CH + 7, bw, 1, 1); fill(3 + 4 * CW, 3 * CH + 11, bw, 1, 1);
        fill(3 + 4 * CW, 3 * CH + 8, Math.round(bw * s.level), 3, 1);
      } else text(pad(s.info || '', 31), 3, 3 * CH + 6);
      tabs(4);
    } else if (s.kind === 'store' || s.kind === 'loading') {
      row(' J:120.0(SEQ)      Now:001.01.00', 1);
      box(2 * CH + 1, 5 * CH - 2);
      text('Tr:00-(BEAT STORE)', 3, 2 * CH + 4);
      if (s.kind === 'store') text((blink ? '►' : ' ') + ' CLICK TO OPEN STORE', 3, 3 * CH + 6);
      else { text('LOADING', 3, 3 * CH + 6); fill(3 + 8 * CW, 3 * CH + 7, Math.round((DW - 9 * CW - 4) * (s.progress || 0)), 5, 1); }
      tabs(1);
    } else {
      row(' J:120.0(SEQ)      Now:001.01.00', 1);
      box(2 * CH + 1, 5 * CH - 2);
      text('Tr:--(TAP A PAD)      Tsig: 4/4', 3, 2 * CH + 4);
      text((blink ? '►' : ' ') + ' BEAT STORE: CLICK HERE', 3, 3 * CH + 6);
      tabs(1);
    }
    paint();
  }

  function paint() {
    if (!canvas) return;
    var r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    var px = W / DW, py = H / DH, gap = Math.max(0.15, px * 0.16);
    // backlight: brighter in the middle, falling off toward the bezel like a real EL panel
    var bg = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.2, W * 0.5, H * 0.5, W * 0.62);
    bg.addColorStop(0, '#3846ff'); bg.addColorStop(0.65, '#2433e6'); bg.addColorStop(1, '#1622b4');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.045)';                    // unlit pixels, just visible
    for (var y = 0; y < DH; y++) for (var x = 0; x < DW; x++)
      if (!dots[y * DW + x]) ctx.fillRect(x * px, y * py, px - gap, py - gap);
    ctx.fillStyle = '#eef1ff';
    ctx.shadowColor = 'rgba(210,220,255,0.55)'; ctx.shadowBlur = px * 0.9;
    for (y = 0; y < DH; y++) for (x = 0; x < DW; x++)
      if (dots[y * DW + x] === 1) ctx.fillRect(x * px, y * py, px - gap, py - gap);
    ctx.shadowBlur = 0;
    // letters inside inverted blocks: solid backlight blue, no glow, so they read crisply
    ctx.fillStyle = '#1c29c9';
    for (y = 0; y < DH; y++) for (x = 0; x < DW; x++)
      if (dots[y * DW + x] === 2) ctx.fillRect(x * px - gap * 0.5, y * py - gap * 0.5, px + gap * 0.2, py + gap * 0.2);
  }

  var loadTimer = null;
  window.MpcLcd = {
    mount: function (glass) {
      canvas = document.createElement('canvas');
      canvas.className = 'mpc-lcd-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      glass.appendChild(canvas);
      ctx = canvas.getContext('2d');
      compose();
      window.addEventListener('resize', paint);
      if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches))
        setInterval(function () { blink = !blink; compose(); }, 530);
    },
    show: function (s) {
      clearInterval(loadTimer);
      state = s || { kind: 'idle' };
      if (state.kind === 'loading') {
        state.progress = 0;
        loadTimer = setInterval(function () { state.progress = Math.min(1, state.progress + 0.12); compose(); }, 45);
      }
      compose();
    }
  };
})();
