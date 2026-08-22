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
   NOTE: only the top pad row, "tape", and "lcd" have ever been measured —
   this was true before this redesign too. Rows pad-1.. / pad-2.. / pad-3..
   and the second drive ("deux-series") have no coordinates yet and are
   deliberately left out here so the renderer just skips them, same as it
   always has for unmapped pads. Re-measure all of this against the new,
   higher-res hero photo once it lands — these numbers won't carry over
   cleanly to a different source image. */
window.HERO_HOTSPOTS = {
  "pad-0-0": { left: 59.5, top: 25.3, width: 9.2, height: 9.0 },
  "pad-0-1": { left: 68.7, top: 25.3, width: 9.2, height: 9.0 },
  "pad-0-2": { left: 77.9, top: 25.3, width: 9.2, height: 9.0 },
  "pad-0-3": { left: 87.1, top: 25.3, width: 9.2, height: 9.0 },
  "tape":    { left: 20.8, top: 68.2, width: 17.6, height: 27.3 },
  "lcd":     { left: 7.0,  top: 1.2,  width: 38.4, height: 9.6 }
  // "deux-series": not measured yet — add its box here once the new photo lands
};

/* ---------- WHAT each pad does ----------
   type: "beat"   → clicking plays a local audio file and drives the LCD
                     waveform (see app.js renderLcd / waveform.js). Top two
                     rows are beats. Drop the file into assets/beats/ and
                     fill in `audio` below — same "add one entry" workflow
                     as the shop's products.js.
   type: "social" → clicking opens `url` in a new tab. Bottom two rows.
                     Only 3 platforms were named (YouTube/Instagram/TikTok);
                     remaining pads are left with url:null — fill in more
                     the same way if/when there's a real destination. */
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
  { id: "pad-2-3", type: "social", label: null,         url: null },

  { id: "pad-3-0", type: "social", label: null, url: null },
  { id: "pad-3-1", type: "social", label: null, url: null },
  { id: "pad-3-2", type: "social", label: null, url: null },
  { id: "pad-3-3", type: "social", label: null, url: null }
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

/* ---------- LCD idle state ----------
   assets/lcd-loop.mp4 does not exist yet — this is a placeholder path.
   Drop the real video (or the Blender-rendered LCD export) in at that
   path and it'll just work; nothing else needs to change. */
window.LCD = {
  idleVideo: "assets/lcd-loop.mp4"
};
