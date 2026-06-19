/* Review queue runner for /learn/review/. External module (CSP `script-src 'self'`). */
import * as srs from '/assets/js/srs.js';

const runner = document.getElementById('runner');
const statsEl = document.getElementById('stats');
const tools = document.getElementById('tools');
if (runner && statsEl) {
    let queue = [], done = 0;

    const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

    function renderStats() {
        const s = srs.stats();
        statsEl.hidden = false;
        statsEl.innerHTML =
            `<div class="rv-stat"><b>${s.due}</b><span>Due now</span></div>` +
            `<div class="rv-stat"><b>${s.reviewed}</b><span>Cards learned</span></div>` +
            `<div class="rv-stat"><b>${s.streak}</b><span>Day streak</span></div>`;
        if (tools) tools.hidden = s.total === 0;
    }

    function nextDueLabel() {
        const up = srs.allCards().filter(c => (c.reps || 0) > 0 && (c.due || 0) > Date.now()).sort((a, b) => a.due - b.due)[0];
        if (!up) return '';
        const d = Math.max(1, Math.round((up.due - Date.now()) / srs.DAY_MS));
        return `Your next card is due in ${d} day${d === 1 ? '' : 's'}.`;
    }

    function start() {
        renderStats();
        const due = srs.dueCards();
        queue = due.map(c => c.id); done = 0;
        if (!queue.length) return renderEmpty();
        renderCard();
    }

    function renderEmpty() {
        const s = srs.stats();
        runner.innerHTML = s.reviewed
            ? `<div class="rv-done"><h2>All caught up 🎉</h2><p>Nothing is due right now${done ? ` — you reviewed ${done} card${done === 1 ? '' : 's'} just now` : ''}. ${esc(nextDueLabel())}</p><p><a class="btn" href="/learn/">Keep learning</a></p></div>`
            : `<div class="rv-done"><h2>No cards yet</h2><p>Read a lesson and answer its recall cards — they'll appear here, scheduled just before you'd forget. Start with <a href="/learn/frameworks/memory-systems.html">Memory Systems</a>.</p></div>`;
    }

    function renderCard() {
        const c = srs.getCard(queue[0]);
        if (!c) { queue.shift(); return queue.length ? renderCard() : renderEmpty(); }
        runner.innerHTML =
            `<div class="rv-card">
                <div class="rv-progress">${done + queue.length} to review · ${done} done</div>
                <div class="rv-q">${esc(c.q || c.id)}</div>
                <div class="rv-a" id="rvA" hidden>${c.a || '<p>(no answer saved)</p>'}</div>
                <div class="rv-actions" id="rvReveal"><button class="btn" id="rvShow">Show answer</button></div>
                <div class="rv-grade" id="rvGrade" hidden>
                    <button class="btn" id="rvYes">I remembered</button>
                    <button class="btn btn--secondary" id="rvNo">I forgot</button>
                </div>
                <p class="rv-hint">You grade yourself — honestly. ${c.page ? `From <a href="${esc(c.page)}">${esc(c.page)}</a>.` : ''}</p>
            </div>`;
        document.getElementById('rvShow').addEventListener('click', () => {
            document.getElementById('rvA').hidden = false;
            document.getElementById('rvReveal').hidden = true;
            document.getElementById('rvGrade').hidden = false;
            document.getElementById('rvYes').focus();
        });
        document.getElementById('rvYes').addEventListener('click', () => grade(true));
        document.getElementById('rvNo').addEventListener('click', () => grade(false));
    }

    function grade(ok) {
        const id = queue.shift();
        srs.recordGrade(id, ok);
        try { window.MGT_TRACKING && window.MGT_TRACKING.trackEvent('card_reviewed', { id, page: '/learn/review/', grade: ok ? 'remembered' : 'forgot' }); } catch (_) {}
        done++;
        if (!ok) queue.push(id); // relearn this session
        renderStats();
        queue.length ? renderCard() : renderEmpty();
    }

    const exp = document.getElementById('export');
    if (exp) exp.addEventListener('click', () => srs.downloadCsv());
    const reset = document.getElementById('reset');
    if (reset) reset.addEventListener('click', () => {
        if (confirm('Reset all your recall cards and streak on this device? This cannot be undone.')) { srs.reset(); start(); }
    });

    start();
}
