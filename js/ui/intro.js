// The front door: a title card over the dimmed map. "Begin the story"
// starts directed playback from chapter one; "Explore the map" hands
// over the controls. Escape also dismisses.

export function createIntro(container, novel, onBegin, onExplore) {
  container.innerHTML = `
    <div class="intro-scrim"></div>
    <div class="intro-card" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <p class="intro-kicker">PlotLines presents</p>
      <h2 class="intro-title" id="intro-title"></h2>
      <p class="intro-byline"></p>
      <p class="intro-blurb">Every journey in the novel, drawn on a genuine
        Victorian map — played out chapter by chapter, all the characters at once.</p>
      <div class="intro-actions">
        <button type="button" class="intro-begin">Begin the story</button>
        <button type="button" class="intro-explore">Explore the map</button>
      </div>
      <p class="intro-hints">Space plays and pauses &middot; select a character to
        ride along &middot; touch any stop for the novel's own words</p>
      <a class="intro-back" href="./">&#8617; Choose another book</a>
    </div>`;

  container.querySelector('.intro-title').textContent = novel.title;
  container.querySelector('.intro-byline').textContent =
    `${novel.author}, ${novel.year}`;

  const begin = container.querySelector('.intro-begin');

  let gone = false;
  function dismiss() {
    if (gone) return; // idempotent: mode-switches may also call this
    gone = true;
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

  // Exposed so a mode switch (the masthead tabs) can clear the card too —
  // not only its own buttons.
  return { dismiss };
}
