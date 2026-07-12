// The atlas: every place across the whole shelf on one map. A separate door
// from the bookcase — its own map, its own data — so nothing here can slow or
// break a book's own view. Pins are coloured by their book's spine; dense
// spots (London holds pins from a dozen books) collapse into clusters that
// expand on zoom. Images are NOT loaded up front — a pin's picture only loads
// when its card is opened, one at a time; 64MB of them at once would be a bomb.

import { createMap } from './map.js';
import { placeFigureHtml, fillPlaceFigure } from './ui/placefig.js';

const map = createMap(document.getElementById('map'));
window.atlasMap = map; // debug handle, mirrors window.plotlinesMap

// The heart of the collection is Britain and near-Europe; the far outliers
// (the Klondike, Japan, the Arctic, Australia) are a zoom-out away.
const HOME = [[-11, 36], [20, 60]];

const cardEl = document.getElementById('atlas-card');
const booksEl = document.getElementById('atlas-books');

fetch('data/atlas.json')
  .then((r) => r.json())
  .then((atlas) => {
    const booksById = Object.fromEntries(atlas.books.map((b) => [b.id, b]));
    const countEl = document.getElementById('atlas-count');
    if (countEl) countEl.textContent =
      `${atlas.count} places across ${atlas.books.length} books`;

    // Every pin carries the index back into atlas.pins, so a click can reach
    // the full record (image, story) without bloating the map source.
    const features = atlas.pins.map((p, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: p.coords },
      properties: {
        pin: i,
        book: p.book,
        cloth: p.cloth,
        conjectured: p.certainty === 'conjectured',
      },
    }));

    let activeBook = null; // null = all books shown

    const ready = () => {
      map.addSource('atlas', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 8,
      });

      // Clusters: a neutral paper disc sized by how many pins it holds, with a
      // count. Deliberately not book-coloured — a cluster is many books at once.
      map.addLayer({
        id: 'atlas-clusters', type: 'circle', source: 'atlas',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#f3ead7',
          'circle-stroke-color': '#2e2417',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.95,
          'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 26],
        },
      });
      map.addLayer({
        id: 'atlas-cluster-count', type: 'symbol', source: 'atlas',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Italic'], 'text-size': 13,
        },
        paint: { 'text-color': '#2e2417' },
      });

      // Single pins: a solid ink-ringed dot in the book's spine colour; a
      // conjectured place reads hollow, as it does inside its own book.
      map.addLayer({
        id: 'atlas-pins', type: 'circle', source: 'atlas',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 5.5,
          // conjectured places read hollow (a bright centre + a bolder ring in
          // the book's colour) — the same "best guess" signal the books use.
          'circle-color': ['case', ['get', 'conjectured'], '#fbf6ea', ['get', 'cloth']],
          'circle-stroke-color': ['get', 'cloth'],
          'circle-stroke-width': ['case', ['get', 'conjectured'], 2.6, 2],
        },
      });

      map.on('click', 'atlas-clusters', (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['atlas-clusters'] })[0];
        map.getSource('atlas').getClusterExpansionZoom(f.properties.cluster_id).then((zoom) => {
          map.easeTo({ center: f.geometry.coordinates, zoom });
        });
      });

      map.on('click', 'atlas-pins', (e) => openCard(atlas.pins[e.features[0].properties.pin]));
      map.on('click', (e) => {
        // a click on empty map (no pin/cluster under it) dismisses the card
        const hit = map.queryRenderedFeatures(e.point, { layers: ['atlas-pins', 'atlas-clusters'] });
        if (!hit.length) closeCard();
      });

      map.on('mouseenter', 'atlas-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'atlas-clusters', () => { map.getCanvas().style.cursor = ''; });

      // Hovering a pin names it and its book - just enough, like explore's
      // hover, to decide whether the place is worth a click into the card.
      let hover = null;
      const dropHover = () => { hover?.remove(); hover = null; };
      map.on('mouseenter', 'atlas-pins', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const p = atlas.pins[e.features[0].properties.pin];
        const book = booksById[p.book] || {};
        dropHover();
        hover = new maplibregl.Popup({
          closeButton: false, closeOnClick: false, offset: 12,
          className: 'loc-card atlas-hover-card',
        })
          .setLngLat(p.coords)
          .setHTML('<p class="atlas-hover-place"></p><p class="atlas-hover-book"></p>')
          .addTo(map);
        const el = hover.getElement();
        el.querySelector('.atlas-hover-place').textContent = p.name;
        el.querySelector('.atlas-hover-book').textContent = book.title || p.book;
      });
      map.on('mouseleave', 'atlas-pins', () => { map.getCanvas().style.cursor = ''; dropHover(); });
      map.on('movestart', dropHover);

      map.fitBounds(HOME, { padding: 40, duration: 0 });
    };

    // ---- the pin card ----
    // The same left-docked panel explore uses (see cards.js / placefig.js): the
    // picture in true proportions with a click to enlarge, a spine-cloth edge in
    // the book's colour, and a way through into the book itself.
    function openCard(pin) {
      const book = booksById[pin.book] || {};
      const badge = pin.certainty === 'conjectured' ? 'Best guess'
        : pin.certainty === 'identified' ? 'Identified place' : 'Real place';
      cardEl.className = 'place-panel';
      cardEl.style.setProperty('--cloth', pin.cloth || '#4d5661');
      cardEl.innerHTML = `
        <button type="button" class="place-panel-close" aria-label="Close">&times;</button>
        <div class="place-panel-content">
          ${placeFigureHtml(pin.image)}
          <p class="atlas-card-place">${pin.name}</p>
          <p class="atlas-card-book">
            <span class="atlas-card-swatch" style="background:${pin.cloth}"></span>
            <span>${book.title || pin.book}${book.author ? ` &middot; ${book.author}` : ''}</span>
          </p>
          ${pin.story ? `<p class="atlas-card-story">${pin.story}</p>` : ''}
          <p class="atlas-card-badge">${badge}</p>
          <a class="atlas-card-open" href="index.html?novel=${pin.book}">Open in the book &rarr;</a>
        </div>`;
      fillPlaceFigure(cardEl, pin.image);
      cardEl.querySelector('.place-panel-close').addEventListener('click', closeCard);
      cardEl.hidden = false;
    }
    function closeCard() { cardEl.hidden = true; cardEl.innerHTML = ''; }

    // ---- the book legend, which doubles as a filter ----
    // Framing a book's pins - the same move its own overture makes: everywhere
    // the story reaches, held in one wide view. maxZoom keeps a book that sits
    // in one town (Mrs Dalloway's London) from diving to street level.
    const boundsOf = (feats) => {
      const b = new maplibregl.LngLatBounds();
      for (const f of feats) b.extend(f.geometry.coordinates);
      return b;
    };
    function setFilter(bookId) {
      activeBook = bookId;
      const shown = bookId ? features.filter((f) => f.properties.book === bookId) : features;
      map.getSource('atlas').setData({ type: 'FeatureCollection', features: shown });
      for (const row of booksEl.querySelectorAll('.atlas-book')) {
        row.setAttribute('aria-pressed', String(row.dataset.book === (bookId || 'all')));
      }
      closeCard();
      // Recentre: onto the chosen book's own ground, or back to the whole
      // collection's home when the filter is cleared.
      if (bookId && shown.length) {
        map.fitBounds(boundsOf(shown), { padding: 80, maxZoom: 9, duration: 900 });
      } else {
        map.fitBounds(HOME, { padding: 40, duration: 900 });
      }
    }
    function buildLegend() {
      const rows = [`<button type="button" class="atlas-book" data-book="all" aria-pressed="true">
        <span class="atlas-book-swatch atlas-book-all"></span><span>All books</span></button>`];
      for (const b of atlas.books) {
        rows.push(`<button type="button" class="atlas-book" data-book="${b.id}" aria-pressed="false">
          <span class="atlas-book-swatch" style="background:${b.cloth}"></span><span>${b.title}</span></button>`);
      }
      booksEl.innerHTML = rows.join('');
      for (const row of booksEl.querySelectorAll('.atlas-book')) {
        row.addEventListener('click', () => {
          const id = row.dataset.book;
          setFilter(id === 'all' || id === activeBook ? null : id);
        });
      }
    }
    buildLegend();

    if (map.isStyleLoaded()) ready();
    else map.on('load', ready);
  })
  .catch((err) => { console.error('atlas failed to load', err); });
