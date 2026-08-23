/* ============================================================
   RMLUR HOME PAGE — HOTSPOT DATA
   ============================================================
   The MPC photo IS the site's navigation. This file describes
   every clickable region on it: WHERE it sits (HERO_HOTSPOTS,
   in % so it scales responsively) and WHAT it does (PADS,
   DRIVES, LCD).

   To add a new pad behavior: edit its entry in PADS below.
   To add a new hard-drive destination (once you have a new
   drive graphic to photograph in):
     1. Measure its box on the photo, add an id + {left,top,
        width,height} to HERO_HOTSPOTS below.
     2. Add one entry to DRIVES with that same id.
     3. Copy jasons-portfolio.html as the template for the new
        collaborator's page.
     4. Push — done.
   ============================================================ */

/* ---------- WHERE things sit on assets/mpc-hero.jpg (percentages) ----------
   Measured against the current photo (1412x1420px — the real,
   undamaged Readymag source photo + the tape/drive props composited
   on below it). Re-measure all of this if the hero photo is ever
   replaced. */
window.HERO_HOTSPOTS = {
  "pad-0-0": { left: 56.51, top: 28.03, width: 5.67, height: 4.23 },
  "pad-0-1": { left: 65.01, top: 28.03, width: 5.67, height: 4.23 },
  "pad-0-2": { left: 73.51, top: 28.03, width: 5.67, height: 4.23 },
  "pad-0-3": { left: 82.01, top: 28.03, width: 5.67, height: 4.23 },

  "pad-1-0": { left: 56.51, top: 36.48, width: 5.67, height: 4.23 },
  "pad-1-1": { left: 65.01, top: 36.48, width: 5.67, height: 4.23 },
  "pad-1-2": { left: 73.51, top: 36.48, width: 5.67, height: 4.23 },
  "pad-1-3": { left: 82.01, top: 36.48, width: 5.67, height: 4.23 },

  "pad-2-0": { left: 56.51, top: 44.93, width: 5.67, height: 4.23 },
  "pad-2-1": { left: 65.01, top: 44.93, width: 5.67, height: 4.23 },
  "pad-2-2": { left: 73.51, top: 44.93, width: 5.67, height: 4.23 },
  "pad-2-3": { left: 82.01, top: 44.93, width: 5.67, height: 4.23 },

  "pad-3-0": { left: 56.51, top: 53.38, width: 5.67, height: 4.23 },
  "pad-3-1": { left: 65.01, top: 53.38, width: 5.67, height: 4.23 },
  "pad-3-2": { left: 73.51, top: 53.38, width: 5.67, height: 4.23 },
  "pad-3-3": { left: 82.01, top: 53.38, width: 5.67, height: 4.23 },

  "tape":    { left: 13.46, top: 68.31, width: 24.08, height: 12.32 },
  "deux-series": { left: 67.99, top: 66.90, width: 19.83, height: 19.72 },
  // LCD box matches the full dark-bezel screen module, flush edge-to-edge,
  // so the idle video covers the whole screen with no bezel-color gap.
  "lcd":     { left: 6.02, top: 3.66, width: 42.85, height: 11.69 }
};

/* ---------- WHAT each pad does ----------
   type: "beat"   → clicking plays a local audio file and drives the LCD
                     waveform (see app.js renderLcd / waveform.js). Top two
                     rows are beats — each page load, app.js randomly
                     assigns 8 one-shots from BEAT_POOL below to these 8
                     pads (see assignRandomBeats). Drop more confirmed-yours
                     one-shots into assets/beats/ and add their paths to
                     BEAT_POOL to grow the pool — do NOT point this at
                     someone else's leaked kit; several "@LEAKEDSOUND"- and
                     "stolen"-named folders on this Mac are NOT safe to
                     publish without clear rights.
   type: "social" → clicking navigates to `url`. Bottom two rows. An
                     absolute http(s) URL opens in a new tab (external);
                     anything else (a relative page like "about.html", or
                     a mailto: link) navigates in the same tab — this is
                     also how the old corner-nav's About/Blog/Design/Contact
                     links now work, straight from the pads instead of a
                     persistent nav bar. Fill in more the same way if/when
                     there's a new destination. */
window.PADS = [
  { id: "pad-0-0", type: "beat", title: "Recent beat 1", audio: null },
  { id: "pad-0-1", type: "beat", title: "Recent beat 2", audio: null },
  { id: "pad-0-2", type: "beat", title: "Recent beat 3", audio: null },
  { id: "pad-0-3", type: "beat", title: "Recent beat 4", audio: null },

  { id: "pad-1-0", type: "beat", title: "Recent beat 5", audio: null },
  { id: "pad-1-1", type: "beat", title: "Recent beat 6", audio: null },
  { id: "pad-1-2", type: "beat", title: "Recent beat 7", audio: null },
  { id: "pad-1-3", type: "beat", title: "Recent beat 8", audio: null },

  { id: "pad-2-0", type: "social", label: "YouTube",   url: "https://www.youtube.com/" },
  { id: "pad-2-1", type: "social", label: "Instagram", url: "https://www.instagram.com/kennethglamour/" },
  { id: "pad-2-2", type: "social", label: "TikTok",     url: null },
  { id: "pad-2-3", type: "social", label: "About",      url: "about.html" },

  { id: "pad-3-0", type: "social", label: "Blog",    url: "blog.html" },
  { id: "pad-3-1", type: "social", label: "Design",  url: "design.html" },
  { id: "pad-3-2", type: "social", label: "Contact", url: "mailto:jayrewindbeatz@gmail.com" },
  { id: "pad-3-3", type: "social", label: null,      url: null }
];

/* ---------- Random beat pool (top two rows) ----------
   8 one-shots from the user's own "mini-stolen-drums-kit" (confirmed
   their own kit, name notwithstanding). app.js randomly assigns 8 of
   these to the 8 "beat" pads on every page load — add more entries the
   same way to grow the pool. */
window.BEAT_POOL = [
  "assets/beats/kick-1.mp3",
  "assets/beats/kick-2.mp3",
  "assets/beats/kick-3.mp3",
  "assets/beats/snare-1.mp3",
  "assets/beats/snare-clap-1.mp3",
  "assets/beats/snare-clap-2.mp3",
  "assets/beats/bass-1.mp3",
  "assets/beats/eight-oh-eight-1.mp3"
];

/* ---------- WHAT each hard-drive does ----------
   Each drive is its own portfolio pathway. */
window.DRIVES = [
  { id: "tape", label: "MidKnight Jason", targetPage: "jasons-portfolio.html" },
  // "RMLUR :: Deux Series" used to link out to a Gumroad drum-kit page —
  // that kit now sells through the shop, so point it there instead of a
  // dead-end stub. Repoint to a real collaborator page later if needed.
  { id: "deux-series", label: "RMLUR :: Deux Series", targetPage: "shop.html" }
];

/* ---------- LCD idle state ---------- */
window.LCD = {
  idleVideo: "assets/lcd-loop.mp4"
};
