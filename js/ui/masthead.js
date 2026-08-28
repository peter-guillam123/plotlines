// The masthead: the wordmark (the way back to the shelf), the novel title,
// author and mode tabs — nothing more. Everything optional — the library
// link, the standing pages, the 1890s slider — now lives under the settings
// cog, so the top-left box stays as small as it can.

import { libraryHref } from '../links.js';

export function createMasthead(container, index, activeId, { onMode } = {}) {
  const novelMeta = index.find((n) => n.id === activeId);
  container.innerHTML = `
    <a class="masthead-kicker" href="${libraryHref()}" title="Back to the library" aria-label="Back to the library">
      <span class="kicker-arrow" aria-hidden="true">&larr;</span><span class="kicker-word">PlotLines</span>
    </a>
    <h1 class="masthead-title"></h1>
    <p class="masthead-byline"></p>
    <div class="mode-tabs" role="group" aria-label="Mode">
      <button type="button" data-mode="story" aria-pressed="true">Story</button>
      <button type="button" data-mode="explore" aria-pressed="false">Explore</button>
    </div>`;
  container.querySelector('.masthead-title').textContent = novelMeta.title;
  container.querySelector('.masthead-byline').textContent =
    `${novelMeta.author}, ${novelMeta.year}`;

  const tabs = [...container.querySelectorAll('.mode-tabs button')];
  for (const tab of tabs) {
    tab.addEventListener('click', () => onMode && onMode(tab.dataset.mode));
  }
  function setMode(mode) {
    for (const tab of tabs) {
      tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
    }
  }

  return { setMode };
}
