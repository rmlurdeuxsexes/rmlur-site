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
   Readymag page). Re-measure all of this if the hero photo is ever
   replaced. */
window.HERO_HOTSPOTS = {
  "pad-0-0": { left: 56.51, top: 28.43, width: 5.67, height: 4.29 },
  "pad-0-1": { left: 65.01, top: 28.43, width: 5.67, height: 4.29 },
  "pad-0-2": { left: 73.51, top: 28.43, width: 5.67, height: 4.29 },
  "pad-0-3": { left: 82.01, top: 28.43, width: 5.67, height: 4.29 },

  "pad-1-0": { left: 56.51, top: 37.00, width: 5.67, height: 4.29 },
  "pad-1-1": { left: 65.01, top: 37.00, width: 5.67, height: 4.29 },
  "pad-1-2": { left: 73.51, top: 37.00, width: 5.67, height: 4.29 },
  "pad-1-3": { left: 82.01, top: 37.00, width: 5.67, height: 4.29 },

  "pad-2-0": { left: 56.51, top: 45.57, width: 5.67, height: 4.29 },
  "pad-2-1": { left: 65.01, top: 45.57, width: 5.67, height: 4.29 },
  "pad-2-2": { left: 73.51, top: 45.57, width: 5.67, height: 4.29 },
  "pad-2-3": { left: 82.01, top: 45.57, width: 5.67, height: 4.29 },

  "pad-3-0": { left: 56.51, top: 54.14, width: 5.67, height: 4.29 },
  "pad-3-1": { left: 65.01, top: 54.14, width: 5.67, height: 4.29 },
  "pad-3-2": { left: 73.51, top: 54.14, width: 5.67, height: 4.29 },
  "pad-3-3": { left: 82.01, top: 54.14, width: 5.67, height: 4.29 },

  "tape":    { left: 17.07, top: 73.29, width: 9.63, height: 14.65 },
  // LCD box now matches just the inner black display glass (not the
  // whole bezel + button row) — smaller and flush, matching how it
  // actually sits on the real Readymag page.
  "lcd":     { left: 21.96, top: 10.71, width: 20.18, height: 10.71 }
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
