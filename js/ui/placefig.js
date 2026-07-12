// One place picture, built the same way for explore and the atlas: the image
// in its true proportions (never cropped to a frame), an "indicative" flag
// where a period painting stands in for an imagined place, and a click to
// open it large. Caption and credit ride underneath. See lightbox.js.

import { openLightbox } from './lightbox.js';

const EXPAND = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2H2v4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function placeFigureHtml(image) {
  if (!image) return '';
  const indic = image.indicative
    ? '<span class="place-fig-indicative">Indicative</span>' : '';
  return `
    <figure class="place-fig">
      <button type="button" class="place-fig-zoom" aria-label="See this picture larger">
        <img class="place-fig-img" alt="" loading="lazy" decoding="async">
        ${indic}
        <span class="place-fig-hint" aria-hidden="true">${EXPAND}</span>
      </button>
      <figcaption class="place-fig-cap">
        <span class="place-fig-caption"></span>
        <span class="place-fig-credit"></span>
      </figcaption>
    </figure>`;
}

// Fill a rendered figure with its image and wire the click-to-enlarge. Call
// once per open, after the figure HTML is in the DOM.
export function fillPlaceFigure(root, image) {
  if (!image) return;
  const img = root.querySelector('.place-fig-img');
  img.src = image.file;
  img.alt = image.caption || '';
  const cap = root.querySelector('.place-fig-caption');
  const credit = root.querySelector('.place-fig-credit');
  if (cap) cap.textContent = image.caption || '';
  if (credit) credit.textContent = image.credit || '';
  root.querySelector('.place-fig-zoom').addEventListener('click', () => openLightbox(image));
}
