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

export const CERTAINTY_LABELS = {
  real: 'Real place',
  identified: 'Identified place',
  conjectured: 'Best guess',
};
