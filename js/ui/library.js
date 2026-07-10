// The library: PlotLines' front door when no book is chosen. A bookcase
// of cloth-bound spines (their bindings nod to the first editions), each a
// real button; an empty slot promises more. Once there are more spines than
// sit comfortably in one row, they wrap onto further shelves — balanced rows,
// each on its own wooden board, the card scrolling down like stepping back to
// take in the whole case. Choosing a book navigates to ?novel=<id>.

// How many spines before a row feels crowded. Rows are then balanced evenly
// (13 books → 7 + 7, not 8 + 6), so the case never looks lopsided.
const MAX_PER_ROW = 8;

export function createLibrary(container, index) {
  container.innerHTML = `
    <div class="library-scrim"></div>
    <div class="library-card" role="dialog" aria-modal="true" aria-labelledby="library-title" tabindex="-1">
      <p class="intro-kicker">A shelf of journeys</p>
      <h1 class="library-title" id="library-title">PlotLines</h1>
      <p class="library-sub">The classics, mapped — every journey in the book,
        drawn on a hand-tinted period map, with the real 1890s Ordnance Survey
        wherever the story walks in Britain. Take one down.</p>
      <div class="library-shelf" role="group" aria-label="The shelf"></div>
      <p class="intro-hints">Each book opens with a choice: watch the story, or
        explore its places.</p>
    </div>`;

  const shelf = container.querySelector('.library-shelf');

  function makeBook(novel) {
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
      </span>`;
    book.querySelector('.book-title').textContent = novel.title;
    book.querySelector('.book-author').textContent = novel.author;
    book.querySelector('.book-year').textContent = novel.year;
    book.addEventListener('click', () => {
      location.search = `novel=${novel.id}`;
    });
    return book;
  }

  const slot = document.createElement('div');
  slot.className = 'library-book library-book-empty';
  slot.setAttribute('aria-hidden', 'true');
  slot.innerHTML = `<span class="book-title">more to come</span>`;

  // Every spine, plus the "more to come" slot, laid out then split into
  // balanced rows — each row a shelf of its own.
  const items = [...index.map(makeBook), slot];
  const rowCount = Math.ceil(items.length / MAX_PER_ROW);
  const perRow = Math.ceil(items.length / rowCount);
  for (let i = 0; i < items.length; i += perRow) {
    const row = document.createElement('div');
    row.className = 'shelf-row';
    for (const item of items.slice(i, i + perRow)) row.append(item);
    shelf.append(row);
  }

  // Focus the dialog, not the first book — focusing a spine would lift it
  // and read as "selected" before anyone's chosen.
  container.querySelector('.library-card').focus({ preventScroll: true });
}
