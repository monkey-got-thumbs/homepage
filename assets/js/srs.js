/**
 * srs.js — a tiny, dependency-free spaced-repetition scheduler for Monkey Got Thumbs.
 *
 * Local-first by design: every card's state lives in the reader's OWN browser
 * (localStorage). No account, no backend, no tracking — the same "your data
 * stays yours" principle our products are built on. Powers <mgt-recall> and the
 * /learn/review/ queue. Leitner-style expanding intervals.
 */

const KEY = 'mgt:srs:v1';        // { [id]: cardState }
const DAYKEY = 'mgt:srs:days';   // ['YYYY-MM-DD', ...] days with >=1 review (for streaks)
export const DAY_MS = 86400000;
const LADDER = [1, 3, 7, 16, 35, 90]; // days granted after each successful review (level 1..6)

function loadAll() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } }
function saveAll(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {} }
function dayStr(ts) { return new Date(ts == null ? Date.now() : ts).toISOString().slice(0, 10); }
function markToday() {
    try {
        const d = JSON.parse(localStorage.getItem(DAYKEY) || '[]');
        const t = dayStr();
        if (!d.includes(t)) { d.push(t); localStorage.setItem(DAYKEY, JSON.stringify(d.slice(-400))); }
    } catch (_) {}
}

/** Register a card the reader has encountered (so site-wide totals are honest), without grading it. */
export function ensureCard(id, meta = {}) {
    const all = loadAll();
    if (!all[id]) { all[id] = { id, level: 0, reps: 0, lapses: 0, due: 0, created: Date.now(), q: meta.q || '', a: meta.a || '', page: meta.page || '' }; saveAll(all); }
    else {
        let ch = false;
        if (meta.q && all[id].q !== meta.q) { all[id].q = meta.q; ch = true; }
        if (meta.a && all[id].a !== meta.a) { all[id].a = meta.a; ch = true; }
        if (meta.page && all[id].page !== meta.page) { all[id].page = meta.page; ch = true; }
        if (ch) saveAll(all);
    }
    return all[id];
}

export function getCard(id) { return loadAll()[id] || null; }
export function allCards() { return Object.values(loadAll()); }

/** Record a self-graded review. remembered=true promotes; false relapses to level 1. */
export function recordGrade(id, remembered, meta = {}) {
    const all = loadAll();
    const now = Date.now();
    const c = all[id] || { id, level: 0, reps: 0, lapses: 0, created: now };
    if (meta.q) c.q = meta.q;
    if (meta.a) c.a = meta.a;
    if (meta.page) c.page = meta.page;
    c.reps = (c.reps || 0) + 1;
    c.last = now;
    if (remembered) {
        c.level = Math.min((c.level || 0) + 1, LADDER.length);
        c.due = now + LADDER[c.level - 1] * DAY_MS;
    } else {
        c.level = 1;
        c.lapses = (c.lapses || 0) + 1;
        c.due = now + LADDER[0] * DAY_MS;
    }
    all[id] = c; saveAll(all); markToday();
    return c;
}

/** Cards that have been reviewed at least once and are due now. */
export function dueCards(now = Date.now()) {
    return allCards().filter(c => (c.reps || 0) > 0 && (c.due || 0) <= now).sort((a, b) => (a.due || 0) - (b.due || 0));
}

export function streak() {
    let days = [];
    try { days = JSON.parse(localStorage.getItem(DAYKEY) || '[]'); } catch (_) {}
    const set = new Set(days);
    if (!set.size) return 0;
    let s = 0; const d = new Date();
    if (!set.has(dayStr(d.getTime()))) d.setDate(d.getDate() - 1); // today not done yet → don't break the streak
    while (set.has(dayStr(d.getTime()))) { s++; d.setDate(d.getDate() - 1); }
    return s;
}

export function stats(now = Date.now()) {
    const all = allCards();
    const reviewed = all.filter(c => (c.reps || 0) > 0);
    const today = dayStr(now);
    return {
        total: all.length,
        reviewed: reviewed.length,
        due: reviewed.filter(c => (c.due || 0) <= now).length,
        reviewedToday: reviewed.filter(c => c.last && dayStr(c.last) === today).length,
        streak: streak()
    };
}

/** Cards reviewed at least once on a given page path. */
export function cardsOnPage(path) { return allCards().filter(c => c.page === path && (c.reps || 0) > 0); }

export function exportCsv() {
    const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['id', 'question', 'page', 'level', 'reps', 'lapses', 'due'].join(',')];
    allCards().forEach(c => rows.push([
        esc(c.id), esc(c.q), esc(c.page), c.level || 0, c.reps || 0, c.lapses || 0,
        esc(c.due ? new Date(c.due).toISOString() : '')
    ].join(',')));
    return rows.join('\n');
}

export function downloadCsv(filename = 'mgt-cards.csv') {
    try {
        const blob = new Blob([exportCsv()], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (_) {}
}

export function reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(DAYKEY); } catch (_) {} }
