// Shared text formatting — one source of truth for how chapters and
// movements are described in the scrubber, captions and screen readers.

const ROMAN = [
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function roman(n) {
  let out = '';
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

export function chapterHeading(novel, n) {
  const ch = novel.chapters[n - 1];
  return {
    numeral: `Chapter ${roman(n)}`,
    title: ch.title,
    dates: ch.dateInStory,
    plain: `Chapter ${n} of ${novel.chapters.length}: ${ch.title} (${ch.dateInStory})`,
  };
}

const VERBS = {
  train: ['travels by train', 'travel by train'],
  coach: ['goes by coach', 'go by coach'],
  omnibus: ['rides the omnibus', 'ride the omnibus'],
  motor: ['drives', 'drive'],
  ship: ['sails', 'sail'],
  foot: ['goes on foot', 'go on foot'],
  horse: ['rides', 'ride'],
  elephant: ['rides', 'ride'],
  sledge: ['sails the sledge', 'sail the sledge'],
  tripod: ['stride', 'stride'],
  unknown: ['moves', 'move'],
};

function nameList(characters) {
  // "The hunting party" keeps its capital only at the start of a sentence.
  const names = characters.map((c, i) =>
    i === 0 ? c.name : c.name.replace(/^The /, 'the ')
  );
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// One sentence per journey; shared journeys take a plural verb:
// "Jonathan Harker, Mina Harker and the hunting party travel by train…"
export function movementSentence(novel, movement, characters) {
  const chars = Array.isArray(characters) ? characters : [characters];
  const from = novel.locationsById[movement.from];
  const to = novel.locationsById[movement.to];
  const verb = (VERBS[movement.mode] || VERBS.unknown)[chars.length > 1 ? 1 : 0];
  return `${nameList(chars)} ${verb} from ${from.novelName} to ${to.novelName}.`;
}

export function arrivalSentence(novel, movement, characters) {
  const chars = Array.isArray(characters) ? characters : [characters];
  const to = novel.locationsById[movement.to];
  return `${nameList(chars)} ${chars.length > 1 ? 'arrive' : 'arrives'} at ${to.novelName}.`;
}

// The letter shown on a character's map marker — shared by the markers
// and anywhere that introduces them (the overture's cast chips).
// The monogram on a character's disc. Two initials — first name + last name
// — so Fitzwilliam Darcy reads FD, not a lonely F; a single-name character
// (Danglars, Haydée) keeps one letter. A leading title is dropped so the
// monogram is the person, not the honorific. A character may set an explicit
// `initials` in the data where the automatic pair reads wrong (Lady Catherine
// de Bourgh → LC, not CB). Accepts a character object or a bare name.
export function characterInitial(c) {
  if (c && typeof c === 'object' && c.initials) return c.initials;
  const name = (typeof c === 'string' ? c : (c && c.name)) || '';
  const cleaned = name.replace(/^(The|A|An|Mr|Mrs|Miss|Dr|Professor|Count|Sir|Lady)\.?\s+/i, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return (words[0] || name || '?').charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// The story clock. Time `t` is now a real day offset from the epoch, so
// this is a direct read: a real date for the dated novels (Dracula, P&P)
// that ticks as time passes, and for undated Tess the season label of the
// day's chapter plus an honest "about N years in".
// A single-day book (Mrs Dalloway) sets `timeline.hourClock: true`. Time
// then reads as the hour of the day — Big Ben's own unit — with the date
// dropped to the secondary line. `mins` is minutes past midnight.
function clockLabel(mins) {
  mins = ((Math.round(mins / 5) * 5) % 1440 + 1440) % 1440;   // nearest 5 min
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0 && h24 === 12) return 'noon';
  if (m === 0 && h24 === 0) return 'midnight';
  const h12 = ((h24 + 11) % 12) + 1;
  const ap = h24 < 12 ? 'a.m.' : 'p.m.';
  return m === 0 ? `${h12} ${ap}` : `${h12}.${String(m).padStart(2, '0')} ${ap}`;
}

export function storyTime(novel, t) {
  const tl = novel.timeline;
  if (!tl) return null;
  const day = Math.round(t);

  if (tl.calendar && tl.epoch) {
    const whole = tl.hourClock ? Math.floor(t) : day;
    const date = new Date(`${tl.epoch}T00:00:00`);
    date.setDate(date.getDate() + whole);
    const dateStr = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    if (tl.hourClock) {
      return { primary: clockLabel((t - whole) * 24 * 60), secondary: dateStr };
    }
    return { primary: dateStr, secondary: null };
  }
  // undated: the season label of the chapter whose time this is
  let cur = novel.chapters[0];
  for (const c of novel.chapters) {
    if (c.day <= day) cur = c;
    else break;
  }
  const years = day / 365;
  const rounded = Math.round(years);
  return {
    primary: cur.when || cur.dateInStory,
    secondary: years >= 0.6 ? `about ${rounded} year${rounded === 1 ? '' : 's'} in` : null,
  };
}

export const CERTAINTY_LABELS = {
  real: 'Real place',
  identified: 'Identified place',
  conjectured: 'Best guess',
};
