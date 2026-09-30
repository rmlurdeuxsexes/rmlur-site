// Shared by scripts/beat-drop-watch.mjs and scripts/publish-beats.mjs so there is
// ONE filename parser and ONE genre classifier (mirrors GlamPushAPP's
// src/beatNameParser.js convention).
const AUDIO_EXT = /\.(wav|aiff?|flac|mp3)$/i;

export function parseBeatFilename(filename) {
  let name = filename.replace(AUDIO_EXT, '').replace(/\.flp$/i, '');
  name = name.replace(/^untitled\.?\s*/i, '');
  name = name.replace(/_/g, ' ');

  const bpmMatches = [...name.matchAll(/(\d+)\s*bpm/gi)];
  const bpm = bpmMatches.length ? parseInt(bpmMatches[bpmMatches.length - 1][1], 10) : null;

  const handles = [...new Set((name.match(/@[\w.]+/g) || []).map(h => h.toLowerCase()))];
  const collaborators = handles.filter(h => h !== '@jayrewind');

  let title = name
    .replace(/\d+\s*bpm/gi, '')
    .replace(/@[\w.]+/g, '')
    .replace(/type\s*beat/gi, '')
    .replace(/\+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[-.\s]+|[-.\s]+$/g, '');

  if (!title) title = `untitled beat ${Date.now()}`;

  const displayTitle = title.toUpperCase();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `beat-${Date.now()}`;

  return { title: displayTitle, slug, bpm, collaborators };
}

export const GENRE_RULES = [
  [/jersey/i, 'Jersey Club / Trap'],
  [/soul|rnb|r&b/i, 'Soul / R&B'],
  [/jazz/i, 'Jazz / Neo-Soul'],
  [/edm|dance|club/i, 'EDM / Dance'],
  [/dancehall|afro/i, 'Dancehall / Afrobeat'],
  [/rock|guitar|indie/i, 'Rock'],
  [/drill/i, 'Drill'],
];
export function inferGenre(title) {
  for (const [re, genre] of GENRE_RULES) if (re.test(title)) return genre;
  return 'Trap / Hip-Hop';
}

