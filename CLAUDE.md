# CLAUDE.md — rmlur.com

Project instructions for Claude sessions working in this repo (the rmlur.com
static site — separate repo from GlamPushAPP/JayRewind Studio, deployed via
Vercel, no build step).

## Standing directive: MPC nav is one instrument, not stacked HTML

The homepage nav (`mpc-3d.js` + `index.html`) is a Three.js 3D MPC2000XL
model with raycasting-based pad clicks. The direction going forward:

**Do not add independent HTML/CSS buttons layered on top of the MPC
render.** The MPC must be treated as one cohesive interactive instrument,
not a photo with a website's worth of controls pasted over it.

- The Blender/3D MPC is the visual source of truth. Every interactive
  control must correspond exactly to the physical control visible on the
  MPC model — no duplicate visual buttons over existing ones, no
  independently positioned controls using viewport-based absolute offsets.
- Establish one master MPC coordinate system. Position all interactive
  components — controls, hit areas, hover states, pressed states,
  responsive scaling — relative to that coordinate system so everything
  stays aligned together instead of drifting independently.
- Every pad/control should use a reusable component, not one-off styled
  elements. Target structure:
  - `MPC`
    - `MPCBody`
    - `LCD`
    - `PadGrid` → `MPCPad` × 16
    - `TransportControls` → `ControlButton`
    - `Knob`
    - `NavigationControls`
- The 16 drum pads: perfectly aligned 4×4 grid, identical geometry,
  material, color system, shadows, highlights, hover state, and pressed
  animation across all 16 — no per-pad snowflake styling.
- REC, OVERDUB, STOP, PLAY, PLAY START must map exactly to the existing
  physical controls on the MPC render. Remove any duplicate or misaligned
  overlay versions of these if found.
- Interactive controls must match the MPC's existing perspective, lighting,
  depth, bevels, shadows, and materials — they should read as embedded in
  the MPC, not pasted onto it.
- The LCD should be an independent interactive surface integrated into the
  Blender/WebGL model (not baked into a static render), supporting
  animated branding, scrolling text, status messages, and nav feedback.
  Example states: `RMLUR`, `BUY BEATS HERE`, `INSTAGRAM`, `TIKTOK`,
  `YOUTUBE`, `BEAT STORE`, `LOADING...`.
- Interactions should give physical-looking feedback: buttons depress, pads
  respond, knobs rotate, the LCD updates.
- Content/actions must live in a single data configuration, separate from
  visual implementation (this repo already has this pattern in
  `hotspots.js`'s `PADS`/`DRIVES` arrays — extend that, don't fork a
  second source of truth). Example: `PAD_01 → Instagram`,
  `PAD_02 → TikTok`, `PAD_03 → YouTube`.
- Keep three layers separate:
  - **Visual layer** — Blender/WebGL MPC
  - **Interaction layer** — precise hit zones / 3D objects
  - **Content layer** — links, social destinations, beat store, portfolio
    content
- The end result should look like a real MPC transformed into the RMLUR
  website — not a website laid over an MPC photograph.
- **Before adding any new design elements**, fix existing coordinate
  misalignment, duplicate controls, missing controls, inconsistent colors,
  and responsive scaling on what's already built.

## Related direction: the MPC should be the hero, not an object in a page

The current homepage has the MPC sitting in a large white browser-like
void — a lot of empty space fighting the "immersive centerpiece" concept.
Direction to move toward: make the MPC the hero object and let the rest of
the site recede into the experience around it — the machine becomes the
navigation, not a decoration on top of a conventional page layout. Rough
shape of the intent:

```
          RMLUR

       ┌───────────────┐
       │               │
       │   MPC 2000XL  │
       │               │
       └───────────────┘

     "TAP THE MACHINE"
```

Conceptual shift: don't design a portfolio *around* the MPC. Design the
portfolio *as* the MPC.

## Future feature (not started): the radio station

Described 2026-09-19, explicitly deferred — do not build without being
asked, but keep it in mind when touching the 3D scene or hero layout:

A collective radio/mix station for the site — a continuous loop of RMLUR's
own music plus collaborators' (friends Q and Xavier make music as
"Rambler", part of a collective called "the hiking team" — e.g.
"Rambler X hiking team"), so visitors stay in the loop on what's going on
in RMLUR's world, similar in spirit to a community SoundCloud.

- The resulting mix/loop should be exportable/uploadable to SoundCloud as
  a proper DJ-style mix.
- Wants the same voice-tag/watermarking treatment as the GlamPush app's
  "Watermark Studio" feature — DJ-style tags (Rambler / hiking-team tags)
  dropped in over song transitions.
- UI concept: a floating, near-transparent, audio-reactive player — the
  waveform reads as embedded into the page (visible "through" it) rather
  than boxed into a normal player widget, and it fades in/out for
  sleekness instead of staying permanently on screen.
- Song info should behave like Music Choice's on-screen ID or 2K's
  in-game song pop-up: appears briefly when a track starts, then fades —
  not a persistent now-playing bar.
- Must match the site's existing (MPC-hero) visual language, not read as
  a bolted-on generic player.
- The `iPod` object hidden in `assets/mpc-scene/mpc.glb` (see `ENV_RE` in
  `mpc-3d.js`) was a placeholder mockup prop for this idea — confirmed it
  should stay hidden for now, it is not final art for this feature. When
  this gets scoped for real, treat it as its own architectural brainstorm
  (playlist/mix engine + SoundCloud export + voice-tag mixing + floating
  reactive UI), not something to bolt onto the existing hidden prop.

## Notes for whoever picks this up

- This is a direction/spec, not a description of current state — read
  `mpc-3d.js`, `index.html`, and `style.css` first to see how far current
  code is from this before planning changes.
- `hotspots.js`'s `PADS`/`DRIVES` arrays are already the live data source
  consumed by both `app.js` and `mpc-3d.js` — reuse/extend that rather than
  inventing a second config format. Its `HERO_HOTSPOTS` export, by
  contrast, is dead/unused (kept for a possible future 2D-drive treatment)
  — don't build on that one.
- See `HANDOFF.md` in this repo for the UI/UX audit history and what's
  already been fixed vs. still open on this site.
