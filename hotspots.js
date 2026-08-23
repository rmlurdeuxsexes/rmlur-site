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
   Full 4x4 pad grid measured directly against the current photo
   (760x690px). Columns were already accurate from the top row;
   rows 1-3 use that same column spacing with a consistent ~10.14%
   row-to-row gap. Re-measure all of this if the hero photo is ever
   replaced — these numbers are tied to this exact image. */
window.HERO_HOTSPOTS = {
  "pad-0-0": { left: 59.5, top: 25.30, width: 9.2, height: 9.0 },
  "pad-0-1": { left: 68.7, top: 25.30, width: 9.2, height: 9.0 },
  "pad-0-2": { left: 77.9, top: 25.30, width: 9.2, height: 9.0 },
  "pad-0-3": { left: 87.1, top: 25.30, width: 9.2, height: 9.0 },

  "pad-1-0": { left: 59.5, top: 35.44, width: 9.2, height: 9.0 },
  "pad-1-1": { left: 68.7, top: 35.44, width: 9.2, height: 9.0 },
  "pad-1-2": { left: 77.9, top: 35.44, width: 9.2, height: 9.0 },
  "pad-1-3": { left: 87.1, top: 35.44, width: 9.2, height: 9.0 },

  "pad-2-0": { left: 59.5, top: 45.58, width: 9.2, height: 9.0 },
  "pad-2-1": { left: 68.7, top: 45.58, width: 9.2, height: 9.0 },
  "pad-2-2": { left: 77.9, top: 45.58, width: 9.2, height: 9.0 },
  "pad-2-3": { left: 87.1, top: 45.58, width: 9.2, height: 9.0 },

  "pad-3-0": { left: 59.5, top: 55.72, width: 9.2, height: 9.0 },
  "pad-3-1": { left: 68.7, top: 55.72, width: 9.2, height: 9.0 },
  "pad-3-2": { left: 77.9, top: 55.72, width: 9.2, height: 9.0 },
  "pad-3-3": { left: 87.1, top: 55.72, width: 9.2, height: 9.0 },

  "tape":    { left: 20.8, top: 68.2, width: 17.6, height: 27.3 },
  // LCD box now matches the full dark-bezel screen module (not just the
  // inner black text display), flush edge-to-edge, so the idle video
  // covers the whole screen with no bezel-color gap showing around it.
  "lcd":     { left: 7.9,  top: 0.7,  width: 38.2, height: 13.0 }
  // "deux-series": not measured yet — add its box here once the new photo lands
};

/* ---------- WHAT each pad does ----------
   type: "beat"   → clicking plays a local audio file and drives the LCD
                     waveform (see app.js renderLcd / waveform.js). Top two
                     rows are beats. Drop the file into assets/beats/ and
                     fill in `audio` below — same "add one entry" workflow
                     as the shop's products.js.
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
