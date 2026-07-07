// The library: PlotLines' front door when no book is chosen. A shelf
// of cloth-bound spines (their bindings nod to the first editions),
// each a real button; an empty slot promises more. Choosing a book
// navigates to ?novel=<id>, which loads it cleanly.

export function createLibrary(container, index) {
  container.innerHTML = `
    <div class="library-scrim"></div>
    <div class="library-card" role="dialog" aria-modal="true" aria-labelledby="library-title" tabindex="-1">
      <p class="intro-kicker">A shelf of journeys</p>
      <h1 class="library-title" id="library-title">PlotLines</h1>
      <p class="library-sub">Classic novels, mapped — every journey in the book,
        drawn on a hand-tinted period map, with the real 1890s Ordnance Survey
        wherever the story walks in Britain. Take one down.</p>
      <div class="library-shelf" role="list"></div>
      <p class="intro-hints">Each book opens with a choice: watch the story, or
        explore its places.</p>
    </div>`;

  const shelf = container.querySelector('.library-shelf');

  for (const novel of index) {
    const book = document.createElement('button');
    book.type = 'button';
    book.className = 'library-book';
    book.setAttribute('role', 'listitem');
    book.setAttribute('aria-label', `Read ${novel.title} by ${novel.author}`);
    if (novel.blurb) book.title = novel.blurb;
    book.style.setProperty('--cloth', novel.spine?.cloth || '#4d5661');
    book.style.setProperty('--lettering', novel.spine?.text || '#e6d59a');
    book.innerHTML = `
      <span class="book-title"></span>
      <span class="book-author"></span>`;
    book.querySelector('.book-title').textContent = novel.title;
    book.querySelector('.book-author').textContent = novel.author;
    book.addEventListener('click', () => {
      location.search = `novel=${novel.id}`;
    });
    shelf.append(book);
  }

  const slot = document.createElement('div');
  slot.className = 'library-book library-book-empty';
  slot.setAttribute('aria-hidden', 'true');
  slot.innerHTML = `<span class="book-title">more to come</span>`;
  shelf.append(slot);

  // Focus the dialog, not the first book — focusing a spine would lift it
  // and read as "selected" before anyone's chosen.
  container.querySelector('.library-card').focus({ preventScroll: true });
}
