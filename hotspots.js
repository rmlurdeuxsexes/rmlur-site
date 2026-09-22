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
   Measured against the current photo (1412x1400px — the real,
   undamaged Readymag source photo + Jason's tape composited on below
   it, correctly rotated to match how it actually reads on the real
   Readymag page). Every value below was dragged into place by hand
   with the ?edit=1 hotspot editor (edit-hotspots.js), not measured
   from a screenshot. Re-measure all of this if the hero photo is
   ever replaced. */
window.HERO_HOTSPOTS = {
  "lcd":     { left: 17.36, top: 7.85,  width: 23.22, height: 5.93 },

  "pad-0-0": { left: 58.71, top: 29.14, width: 7.09, height: 6.93 },
  "pad-0-1": { left: 67.49, top: 28.79, width: 7.16, height: 7.08 },
  "pad-0-2": { left: 76.41, top: 28.79, width: 7.30, height: 7.22 },
  "pad-0-3": { left: 85.34, top: 28.64, width: 7.37, height: 7.15 },

  "pad-1-0": { left: 58.63, top: 37.71, width: 7.37, height: 7.08 },
  "pad-1-1": { left: 67.56, top: 37.57, width: 7.44, height: 7.22 },
  "pad-1-2": { left: 76.48, top: 37.21, width: 7.44, height: 7.43 },
  "pad-1-3": { left: 85.62, top: 37.36, width: 7.23, height: 7.08 },

  "pad-2-0": { left: 58.71, top: 46.00, width: 7.23, height: 7.29 },
  "pad-2-1": { left: 67.77, top: 46.07, width: 7.16, height: 7.29 },
  "pad-2-2": { left: 76.77, top: 46.14, width: 7.16, height: 7.00 },
  "pad-2-3": { left: 85.76, top: 45.78, width: 7.09, height: 7.15 },

  "pad-3-0": { left: 58.63, top: 54.71, width: 7.58, height: 7.36 },
  "pad-3-1": { left: 67.77, top: 54.85, width: 7.44, height: 7.08 },
  "pad-3-2": { left: 76.91, top: 54.78, width: 7.16, height: 7.00 },
  "pad-3-3": { left: 85.76, top: 54.85, width: 7.30, height: 7.00 },

  "tape":    { left: 17.07, top: 73.29, width: 9.63, height: 14.65 }
};

/* ---------- Decorative stickers layered on top of the photo ----------
   Same % system as HERO_HOTSPOTS, but purely visual — no click behavior,
   not part of PADS/DRIVES. Renders as an <img> so it's a real PNG layer
   (see assets/sticker-*.png) instead of baked into mpc-hero.jpg, which
   means repositioning is just editing these numbers (or dragging it with
   ?edit=1 — it shows up in that editor too) instead of re-touching the
   photo. */
window.STICKERS = {
  "sticker-demo-badge": { src: "assets/sticker-rmlur-demo.png", left: 56.16, top: 4.25, width: 10.48, height: 6.50 }
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
  { id: "pad-2-2", type: "social", label: "TikTok",     url: "https://www.tiktok.com/@jayrewindbeatz" },
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
   Each drive is its own portfolio pathway. Only Jason's for now — the
   second drive ("RMLUR :: Deux Series") has been removed from the photo
   and from here; add a new drive back the same way (measure its box,
   add a HERO_HOTSPOTS entry + one DRIVES entry) whenever there's a next
   collaborator. */
window.DRIVES = [
  { id: "tape", label: "MidKnight Jason", targetPage: "jasons-portfolio.html" }
];

/* ---------- LCD idle state ---------- */
window.LCD = {
  idleVideo: "assets/lcd-loop.mp4"
};
