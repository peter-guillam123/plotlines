// A dialog that says aria-modal="true" must mean it: Tab cycles inside the
// dialog and never wanders into the map's zoom buttons behind the scrim.
// Returns a release function; call it when the dialog closes.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function trapFocus(container) {
  function onKey(e) {
    if (e.key !== 'Tab') return;
    const items = [...container.querySelectorAll(FOCUSABLE)]
      .filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!container.contains(active)) {
      // Focus has strayed (or sits on the page behind): pull it back in.
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    const idx = items.indexOf(active);
    if (e.shiftKey && idx <= 0) {
      // First item — or the dialog container itself (idx -1, focused on
      // open): backwards must wrap to the end, not escape to the map.
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && idx === items.length - 1) {
      e.preventDefault();
      first.focus();
    }
  }
  document.addEventListener('keydown', onKey, true);
  return () => document.removeEventListener('keydown', onKey, true);
}
