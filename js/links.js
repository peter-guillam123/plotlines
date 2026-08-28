// Links that keep the query they were clicked from.
//
// While the globe is a URL flag, `href="?novel=x"` is a trap: assigning a new
// query replaces the whole of it, so clicking from one book to the next
// silently drops ?globe=1 and lands the reader back on the flat map. That is
// not hypothetical — it is exactly what happened the first time the shelf was
// used to walk through books for a watch-through. The Lost World "seemed 2D
// still", because it was: the flag had been wiped by the click that opened it.
//
// So every navigation inside the site carries the current parameters forward.
// This outlives the experiment: ?base=blank has always had the same hole, and
// anything we add later would have inherited it.

// A book, from wherever we are now. `page` is needed from the atlas, which is
// a different document.
export function bookHref(id, { page = '' } = {}) {
  const params = new URLSearchParams(location.search);
  params.set('novel', id);
  return `${page}?${params}`;
}

// Back to the shelf, keeping everything except which book we were reading.
export function libraryHref() {
  const params = new URLSearchParams(location.search);
  params.delete('novel');
  const query = params.toString();
  return query ? `./?${query}` : './';
}

// A standing page (the atlas, how it works, how it's made), keeping the flags
// but never the book. Without this a round trip — shelf to atlas and back —
// quietly lands you on a different map from the one you left.
export function pageHref(page) {
  const params = new URLSearchParams(location.search);
  params.delete('novel');
  const query = params.toString();
  return query ? `${page}?${query}` : page;
}
