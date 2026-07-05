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
  ship: ['sails', 'sail'],
  foot: ['goes on foot', 'go on foot'],
  horse: ['rides', 'ride'],
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
  const verb = VERBS[movement.mode][chars.length > 1 ? 1 : 0];
  return `${nameList(chars)} ${verb} from ${from.novelName} to ${to.novelName}.`;
}

export function arrivalSentence(novel, movement, characters) {
  const chars = Array.isArray(characters) ? characters : [characters];
  const to = novel.locationsById[movement.to];
  return `${nameList(chars)} ${chars.length > 1 ? 'arrive' : 'arrives'} at ${to.novelName}.`;
}

// The letter shown on a character's map marker — shared by the markers
// and anywhere that introduces them (the overture's cast chips).
export function characterInitial(name) {
  return name.replace(/^(The|Professor|Count|Dr\.?)\s+/i, '')[0].toUpperCase();
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// The story clock at continuous position t. For dated novels (Dracula,
// P&P) it interpolates the day between chapters and returns a real date
// that ticks as you scrub; for Tess, which Hardy left undated, it returns
// the season label and an honest "about N years in".
export function storyTime(novel, t) {
  const tl = novel.timeline;
  if (!tl) return null;
  const chs = novel.chapters;
  const n = chs.length;
  const i = Math.min(Math.max(Math.floor(t), 1), n); // 1-based current chapter
  const cur = chs[i - 1];
  const frac = Math.min(Math.max(t - i, 0), 1);
  const d0 = cur.day;
  const d1 = i < n ? chs[i].day : cur.day; // next chapter's day
  const day = Math.round(d0 + (d1 - d0) * frac);

  if (tl.calendar && tl.epoch) {
    const date = new Date(`${tl.epoch}T00:00:00`);
    date.setDate(date.getDate() + day);
    return {
      primary: `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
      secondary: null,
    };
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
