/* basics-lock.js — a gentle guided order for the Basics hub. Each concept card
 * carries data-requires="<recall-id>" naming the recall card on the PREVIOUS
 * read; until that recall has been answered (its srs.js entry has reps > 0) the
 * card is greyed. Purely visual — locked cards stay fully clickable; the first
 * card has no data-requires, so it's always open. Re-checks when the reader
 * returns to the hub (bfcache restore / tab focus). CSP-safe ES module; inert
 * anywhere the hub markup is absent. Local-first: reads only the reader's own
 * browser state, no backend.
 */
import { getCard } from '/assets/js/srs.js';

const answered = (id) => { const c = getCard(id); return !!(c && (c.reps || 0) > 0); };

function refresh() {
  document.querySelectorAll('.bx-card[data-requires]').forEach((card) => {
    const req = card.getAttribute('data-requires');
    card.classList.toggle('is-locked', !!req && !answered(req));
  });
}

function init() {
  if (!document.querySelector('.bx-card[data-requires]')) return;
  refresh();
  window.addEventListener('pageshow', refresh);                 // back button / bfcache
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  document.addEventListener('recall-graded', refresh);          // harmless if graded elsewhere
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
