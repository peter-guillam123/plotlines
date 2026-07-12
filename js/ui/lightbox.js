// The picture, large. A place panel keeps its image compact and honest; a
// click on that image opens it here at the size the reader actually wants,
// caption and credit kept with it. Shared by explore (cards.js) and the
// atlas, so a picture opens the same way wherever you meet it. Builds its
// own overlay in <body> once, on first use.

let overlay = null;
let lastFocus = null;

function build() {
  overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="lightbox-scrim"></div>
    <figure class="lightbox-figure" role="dialog" aria-modal="true" aria-label="Enlarged picture" tabindex="-1">
      <button type="button" class="lightbox-close" aria-label="Close picture">&times;</button>
      <img class="lightbox-img" alt="" decoding="async">
      <figcaption class="lightbox-cap">
        <span class="lightbox-caption"></span>
        <span class="lightbox-credit"></span>
      </figcaption>
    </figure>`;
  document.body.append(overlay);
  overlay.querySelector('.lightbox-scrim').addEventListener('click', close);
  overlay.querySelector('.lightbox-close').addEventListener('click', close);
  // Capture phase, so Escape shuts the picture first and the click never
  // reaches the panel's own Escape handler underneath it.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) {
      e.stopPropagation();
      close();
    }
  }, true);
}

export function openLightbox(image) {
  if (!image || !image.file) return;
  if (!overlay) build();
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const img = overlay.querySelector('.lightbox-img');
  img.src = image.file;
  img.alt = image.caption || '';
  overlay.querySelector('.lightbox-caption').textContent = image.caption || '';
  overlay.querySelector('.lightbox-credit').textContent = image.credit || '';
  overlay.hidden = false;
  overlay.querySelector('.lightbox-figure').focus({ preventScroll: true });
}

function close() {
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  overlay.querySelector('.lightbox-img').src = '';
  if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
  lastFocus = null;
}
