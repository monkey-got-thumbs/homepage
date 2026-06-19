/* Learning Hub "N cards due" nudge. External module (CSP `script-src 'self'`). */
import * as srs from '/assets/js/srs.js';

const el = document.getElementById('review-nudge');
if (el) {
    const s = srs.stats();
    if (s.reviewed > 0) {
        if (s.due > 0) {
            el.textContent = `🧠 Review ${s.due} card${s.due === 1 ? '' : 's'} due`;
        } else {
            const up = srs.allCards().filter(c => (c.reps || 0) > 0 && (c.due || 0) > Date.now()).sort((a, b) => a.due - b.due)[0];
            const d = up ? Math.max(1, Math.round((up.due - Date.now()) / srs.DAY_MS)) : 0;
            el.textContent = d ? `🧠 Your review · next due in ${d} day${d === 1 ? '' : 's'}` : '🧠 Your review';
        }
        el.hidden = false;
    }
}
