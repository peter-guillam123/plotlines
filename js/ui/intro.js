// The front door: a title card over the dimmed map. "Begin the story"
// starts directed playback from chapter one; "Explore the map" hands
// over the controls. Escape also dismisses.

export function createIntro(container, novel, onBegin, onExplore) {
  container.innerHTML = `
    <div class="intro-scrim"></div>
    <div class="intro-card" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <p class="intro-kicker">Novelmaps presents</p>
      <h2 class="intro-title" id="intro-title"></h2>
      <p class="intro-byline"></p>
      <p class="intro-blurb">Every journey in the novel, drawn on the maps of its
        own decade — played out chapter by chapter, all the characters at once.</p>
      <div class="intro-actions">
        <button type="button" class="intro-begin">Begin the story</button>
        <button type="button" class="intro-explore">Explore the map</button>
      </div>
      <p class="intro-hints">Space plays and pauses &middot; select a character to
        ride along &middot; touch any stop for the novel's own words</p>
    </div>`;

  container.querySelector('.intro-title').textContent = novel.title;
  container.querySelector('.intro-byline').textContent =
    `${novel.author}, ${novel.year}`;

  const begin = container.querySelector('.intro-begin');

  function dismiss() {
    container.classList.add('is-leaving');
    setTimeout(() => {
      container.hidden = true;
      container.innerHTML = '';
    }, 450);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') dismiss();
  }

  begin.addEventListener('click', () => {
    dismiss();
    onBegin();
  });
  container.querySelector('.intro-explore').addEventListener('click', () => {
    dismiss();
    if (onExplore) onExplore();
  });
  container.querySelector('.intro-scrim').addEventListener('click', dismiss);
  document.addEventListener('keydown', onKey);

  begin.focus({ preventScroll: true });
}
