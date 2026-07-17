// The library: PlotLines' front door when no book is chosen. A bookcase
// of cloth-bound spines (their bindings nod to the first editions), each a
// real button; an empty slot promises more. Once there are more spines than
// sit comfortably in one row, they wrap onto further shelves - balanced rows,
// each on its own wooden board, the card scrolling down like stepping back to
// take in the whole case. Choosing a book navigates to ?novel=<id>.
//
// At the foot, the two standing pages - the only route to them from the front
// door, which otherwise kept the diary behind a book you had to open first.
//
// Under the dek, a thin toggle re-orders the whole case: by author, by title,
// by distance travelled, by time span, or by date. The last two are stats
// baked into the index (see tools/build-shelf-stats.mjs); when either is the
// order, each spine shows its value at the foot in place of the date, so the
// reshuffle reads as something and not a mystery.

// How many spines before a row feels crowded. Rows are then balanced evenly
// (13 books -> 7 + 7, not 8 + 6), so the case never looks lopsided.
const MAX_PER_ROW = 8;

const surname = (a) => a.trim().split(/\s+/).pop().toLowerCase();
const stripArticle = (t) => t.replace(/^(the|a|an)\s+/i, '');
const byTitle = (a, b) => stripArticle(a.title).localeCompare(stripArticle(b.title));

// Each order is a comparator. Distance and span run biggest-first (the epics
// lead); books missing a stat fall to the end rather than breaking the sort.
const ORDERS = {
  author: (a, b) =>
    surname(a.author).localeCompare(surname(b.author)) || a.year - b.year || byTitle(a, b),
  title: byTitle,
  distance: (a, b) => (b.distanceKm ?? -1) - (a.distanceKm ?? -1) || byTitle(a, b),
  span: (a, b) => (b.spanDays ?? -1) - (a.spanDays ?? -1) || byTitle(a, b),
  date: (a, b) => a.year - b.year || byTitle(a, b),
};

const SORT_BUTTONS = [
  { key: 'author', label: 'Author' },
  { key: 'title', label: 'Title' },
  { key: 'distance', label: 'Distance' },
  { key: 'span', label: 'Time span' },
  { key: 'date', label: 'Date' },
];

// Foot text for the two stat orders: distance in rounded miles, span as its
// hand-written label. Returns '' when the order has no per-spine metric.
function metricText(novel, order) {
  if (order === 'distance' && novel.distanceKm != null) {
    const mi = novel.distanceKm * 0.621371;
    const r = mi >= 2000 ? Math.round(mi / 100) * 100 : Math.round(mi);
    return `${r.toLocaleString('en-GB')} mi`;
  }
  if (order === 'span' && novel.spanLabel) return novel.spanLabel;
  return '';
}

export function createLibrary(container, index) {
  container.innerHTML = `
    <div class="library-scrim"></div>
    <div class="library-card" role="dialog" aria-modal="true" aria-labelledby="library-title" tabindex="-1">
      <p class="intro-kicker">A shelf of journeys</p>
      <h1 class="library-title" id="library-title">PlotLines</h1>
      <nav class="view-toggle library-toggle" aria-label="Views">
        <span aria-current="page">The shelf</span>
        <a href="atlas.html">The atlas</a>
      </nav>
      <p class="library-sub">The classics, mapped - every journey in the book,
        drawn on a hand-tinted period map, with the real 1890s Ordnance Survey
        wherever the story walks in Britain. Take one down.</p>
      <div class="shelf-sort" role="group" aria-label="Order the shelf"></div>
      <div class="library-shelf" role="group" aria-label="The shelf"></div>
      <p class="intro-hints">Each book opens with a choice: watch the story, or
        explore its places.</p>
      <nav class="library-links" aria-label="About PlotLines">
        <a href="about.html">How it works</a>
        <a href="workshop.html">How it&rsquo;s made</a>
      </nav>
    </div>`;

  const shelf = container.querySelector('.library-shelf');
  const sortBar = container.querySelector('.shelf-sort');

  function makeBook(novel, order) {
    const book = document.createElement('button');
    book.type = 'button';
    book.className = 'library-book';
    book.setAttribute('aria-label', `Read ${novel.title} by ${novel.author}`);
    if (novel.blurb) book.title = novel.blurb;
    book.style.setProperty('--cloth', novel.spine?.cloth || '#4d5661');
    book.style.setProperty('--lettering', novel.spine?.text || '#e6d59a');
    book.innerHTML = `
      <span class="book-title"></span>
      <span class="book-foot">
        <span class="book-author"></span>
        <span class="book-year"></span>
        <span class="book-metric"></span>
      </span>`;
    book.querySelector('.book-title').textContent = novel.title;
    book.querySelector('.book-author').textContent = novel.author;
    book.querySelector('.book-year').textContent = novel.year;
    book.querySelector('.book-metric').textContent = metricText(novel, order);
    book.addEventListener('click', () => {
      location.search = `novel=${novel.id}`;
    });
    return book;
  }

  const slot = document.createElement('div');
  slot.className = 'library-book library-book-empty';
  slot.setAttribute('aria-hidden', 'true');
  slot.innerHTML = `<span class="book-title">more to come</span>`;

  // Lay the case out in the given order: spines in balanced rows, each row a
  // shelf of its own; the "more to come" slot always trails at the end.
  function render(order) {
    const ordered = [...index].sort(ORDERS[order] || ORDERS.author);
    // a data-hook the CSS uses to show the metric (and hide the date) when the
    // order is distance or time span.
    shelf.dataset.metric = order === 'distance' || order === 'span' ? order : '';
    shelf.replaceChildren();
    const items = [...ordered.map((n) => makeBook(n, order)), slot];
    const rowCount = Math.ceil(items.length / MAX_PER_ROW);
    const perRow = Math.ceil(items.length / rowCount);
    for (let i = 0; i < items.length; i += perRow) {
      const row = document.createElement('div');
      row.className = 'shelf-row';
      for (const item of items.slice(i, i + perRow)) row.append(item);
      shelf.append(row);
    }
  }

  // The order control: a thin segmented toggle. Distance and Time span are only
  // offered when the stats that drive them actually loaded.
  const haveStats = index.some((n) => n.distanceKm != null);
  const buttons = SORT_BUTTONS.filter(
    (b) => haveStats || (b.key !== 'distance' && b.key !== 'span'),
  );
  let current = 'author';
  for (const { key, label } of buttons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.setAttribute('aria-pressed', String(key === current));
    btn.addEventListener('click', () => {
      if (key === current) return;
      current = key;
      for (const b of sortBar.children) b.setAttribute('aria-pressed', String(b === btn));
      render(current);
    });
    sortBar.append(btn);
  }

  render(current);

  // Focus the dialog, not the first book - focusing a spine would lift it
  // and read as "selected" before anyone's chosen.
  container.querySelector('.library-card').focus({ preventScroll: true });
}
