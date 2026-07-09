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

  // The key, in two rows — each pairs the line and the pin so the visual
  // language reads at a glance: solid + filled = known, dashed + hollow = a
  // guess.
  const key = document.createElement('div');
  key.className = 'map-key';
  key.setAttribute('aria-label', 'Map key');
  key.innerHTML = `
    <span class="key-item"><svg viewBox="0 0 30 10" width="30" height="10" aria-hidden="true"><path d="M0 5h17" stroke="currentColor" stroke-width="2"/><circle cx="24.5" cy="5" r="3.7" fill="currentColor"/></svg> a real place</span>
    <span class="key-item"><svg viewBox="0 0 30 10" width="30" height="10" aria-hidden="true"><path d="M0 5h17" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/><circle cx="24.5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg> a best guess</span>`;
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
