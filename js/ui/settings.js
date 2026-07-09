// The settings cog: a single button in the map's own control style, bottom
// right, that opens a parchment pane. It holds the 1890s-map slider (only
// where the story is on British ground) and the way out of a book — back to
// the shelf, and the two standing pages. The top-left masthead stays clean;
// everything optional lives here.

// A genuine toothed gear (Material's settings glyph), not the radial-spoke
// icon that reads as a brightness/sun symbol.
const COG = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"
  fill="currentColor" fill-rule="evenodd">
  <path d="M19.14 12.94a7.5 7.5 0 0 0 .05-.94 7.5 7.5 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54a7 7 0 0 0-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.7 8.87a.5.5 0 0 0 .12.61l2.03 1.58a7.5 7.5 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32a.5.5 0 0 0 .59.22l2.39-.96a7 7 0 0 0 1.62.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54a7 7 0 0 0 1.62-.94l2.39.96a.5.5 0 0 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58zM12 15.4A3.4 3.4 0 1 1 12 8.6a3.4 3.4 0 0 1 0 6.8z"/>
</svg>`;

export function createSettings(map, { overlay } = {}) {
  const hasOverlay = overlay && overlay.available;

  // ---- the pane ----
  const pane = document.createElement('div');
  pane.className = 'settings-pane';
  pane.hidden = true;
  pane.setAttribute('role', 'dialog');
  pane.setAttribute('aria-label', 'Settings');

  const sliderBlock = hasOverlay
    ? `
      <section class="settings-group settings-overlay">
        <h2 class="settings-title">The 1890s map</h2>
        <p class="settings-note">Genuine Ordnance Survey scans, surveyed 1885&ndash;1903,
          laid over Britain. Slide to fade them in and out.</p>
        <input type="range" class="settings-slider" min="0" max="100"
          value="${Math.round(overlay.defaultOpacity * 100)}"
          aria-label="1890s map strength">
        <div class="settings-scale" aria-hidden="true"><span>Off</span><span>Full</span></div>
      </section>`
    : '';

  pane.innerHTML = `
    ${sliderBlock}
    <nav class="settings-links" aria-label="PlotLines">
      <a href="./" class="settings-link">The library</a>
      <a href="about.html" class="settings-link">How it works</a>
      <a href="workshop.html" class="settings-link">How it&rsquo;s made</a>
    </nav>`;

  if (hasOverlay) {
    const slider = pane.querySelector('.settings-slider');
    const apply = () => {
      const o = slider.valueAsNumber / 100;
      overlay.setVisible(o > 0);
      if (o > 0) overlay.setOpacity(o);
    };
    slider.addEventListener('input', apply);
    // If the tiles fall over mid-session, retire the whole block quietly.
    overlay.onUnavailable(() => pane.querySelector('.settings-overlay')?.remove());
  }

  // ---- the cog ----
  // A MapLibre control *group* for identical chrome (white ground, hairline,
  // shadow, 29px) to the zoom buttons — but placed by hand rather than added
  // to the map's own bottom-right stack, which the transport bar and the
  // attribution already occupy. It sits just above the transport bar.
  const group = document.createElement('div');
  group.className = 'maplibregl-ctrl maplibregl-ctrl-group settings-fab';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'settings-cog';
  btn.setAttribute('aria-label', 'Settings and pages');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.innerHTML = COG;
  group.append(btn);

  map.getContainer().append(group);
  map.getContainer().append(pane);

  function open(show) {
    pane.hidden = !show;
    btn.setAttribute('aria-expanded', String(show));
    if (show) pane.querySelector('.settings-slider, .settings-link')?.focus();
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    open(pane.hidden);
  });
  // Click away or Escape closes it.
  document.addEventListener('click', (e) => {
    if (!pane.hidden && !pane.contains(e.target) && !group.contains(e.target)) open(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pane.hidden) {
      open(false);
      btn.focus();
    }
  });

  return { open: () => open(true), close: () => open(false) };
}
