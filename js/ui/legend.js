// Character legend: one real <button> per character (≥40px targets),
// click or Enter to follow them, click again to release.

import { CHARACTER_COLOURS } from '../constants.js';

export function createLegend(container, novel, onSelect) {
  container.innerHTML = '';
  const buttons = {};

  for (const c of novel.characters) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'legend-item';
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `
      <span class="legend-swatch" aria-hidden="true"></span>
      <span class="legend-text">
        <span class="legend-name"></span>
        <span class="legend-role"></span>
      </span>`;
    btn.querySelector('.legend-swatch').style.background = CHARACTER_COLOURS[c.colour];
    btn.querySelector('.legend-name').textContent = c.name;
    btn.querySelector('.legend-role').textContent = c.role;
    btn.title = c.role;
    btn.addEventListener('click', () => onSelect(c.id));
    container.append(btn);
    buttons[c.id] = btn;
  }

  // The key: what solid vs dashed and filled vs hollow actually mean.
  const key = document.createElement('div');
  key.className = 'map-key';
  key.setAttribute('aria-label', 'Map key');
  key.innerHTML = `
    <span class="key-item"><svg viewBox="0 0 26 8" width="26" height="8" aria-hidden="true"><path d="M1 4h24" stroke="currentColor" stroke-width="2"/></svg> the novel's route</span>
    <span class="key-item"><svg viewBox="0 0 26 8" width="26" height="8" aria-hidden="true"><path d="M1 4h24" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/></svg> to a guessed place</span>
    <span class="key-item"><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="currentColor"/></svg> real place</span>
    <span class="key-item"><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg> best guess</span>`;
  container.append(key);

  return {
    setSelected(id) {
      for (const [cid, btn] of Object.entries(buttons)) {
        btn.setAttribute('aria-pressed', String(cid === id));
      }
      container.classList.toggle('has-selection', Boolean(id));
    },
  };
}
