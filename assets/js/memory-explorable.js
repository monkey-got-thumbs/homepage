/* memory-explorable.js — turns the reader's OWN spaced-repetition data into a
 * teaching artifact about memory: their forgetting curve + Leitner ladder, set
 * beside how an LLM "remembers". Local-first; reads the existing srs.js engine,
 * adds no storage. CSP-safe (external module). Tokens-only styling lives in the
 * page; all teaching PROSE lives in the page's a11y-content JSON (reading-level
 * managed + i18n-ready). This file holds only structure + the few short labels
 * below (one forkable table = the i18n seam). Renders nothing if its hooks are
 * absent, so it's inert anywhere but /basics/memory/.
 */
import { allCards, stats, streak } from '/assets/js/srs.js';

// LADDER mirrors srs.js (it isn't exported there): days granted after each
// successful review, for levels 1..6. Level 0 = encountered but never recalled.
const LADDER = [1, 3, 7, 16, 35, 90];
const MAXLVL = LADDER.length; // 6

// Forkable label table — the ONLY copy in this file (i18n seam). Everything the
// reader is taught lives in basics-memory.json via data-a11y.
const T = {
  unseen: 'Unseen', level: 'Level', day: 'day', days: 'days',
  card: 'card', cards: 'cards', here: 'on this rung',
  retrieved: 'retrieved on demand', stored: 'stored item', flat: 'no rung, no strengthening',
};

// A clearly-illustrative demo so a cold visitor still sees the shape. Flagged,
// never passed off as theirs; replaced the instant they answer a real card.
const DEMO = [
  { level: 6, lapses: 1 }, { level: 5, lapses: 0 }, { level: 4, lapses: 1 },
  { level: 3, lapses: 0 }, { level: 3, lapses: 1 }, { level: 2, lapses: 0 },
  { level: 2, lapses: 1 }, { level: 1, lapses: 0 }, { level: 1, lapses: 2 },
  { level: 0, lapses: 0 }, { level: 0, lapses: 0 }, { level: 4, lapses: 0 },
];

let mode = 'you';
const $ = (id) => document.getElementById(id);
const plur = (n, s, p) => (n === 1 ? s : p);
const intervalDays = (lvl) => (lvl <= 0 ? 0 : LADDER[Math.min(lvl, MAXLVL) - 1]);

function dataset() {
  const reviewed = allCards().filter((c) => (c.reps || 0) > 0);
  if (reviewed.length) return { cards: allCards(), demo: false };
  return { cards: DEMO, demo: true };
}

function byLevel(cards) {
  const counts = new Array(MAXLVL + 1).fill(0); // index 0..6
  let lapses = 0;
  cards.forEach((c) => { counts[Math.min(c.level || 0, MAXLVL)]++; lapses += c.lapses || 0; });
  return { counts, lapses, total: cards.length };
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function renderStats(demo) {
  const host = $('mem-stats');
  if (!host) return;
  const s = demo
    ? { total: DEMO.length, reviewed: DEMO.filter((c) => (c.level || 0) > 0).length, due: 0, streak: 0 }
    : { ...stats(), streak: streak() };
  const boxes = [
    [s.reviewed, 'cards learned'],
    [s.total, 'cards seen'],
    [s.due, 'due to revisit'],
    [s.streak, plur(s.streak, 'day streak', 'day streak')],
  ];
  host.replaceChildren();
  boxes.forEach(([n, label]) => {
    const b = el('div', 'mem-stat');
    b.append(el('b', null, String(n)), el('span', null, label));
    host.append(b);
  });
}

function renderLadder(cards) {
  const host = $('mem-ladder');
  if (!host) return;
  host.replaceChildren();
  host.dataset.mode = mode;

  if (mode === 'llm') {
    // Flat key→value store: same cards, no rung, no strengthening, no decay.
    const list = el('div', 'mem-store');
    const n = cards.filter((c) => (c.level || 0) > 0).length || cards.length;
    for (let i = 0; i < Math.min(n, 12); i++) {
      const row = el('div', 'mem-store-row');
      row.append(el('span', 'mem-store-key', `${T.stored} #${i + 1}`),
                 el('span', 'mem-store-val', T.retrieved));
      list.append(row);
    }
    host.append(list);
    const cap = el('p', 'mem-flatnote', T.flat);
    host.append(cap);
    return;
  }

  // "You" mode: the Leitner ladder, level 6 (top) down to Unseen (bottom).
  const { counts } = byLevel(cards);
  const max = Math.max(1, ...counts);
  for (let lvl = MAXLVL; lvl >= 0; lvl--) {
    const count = counts[lvl];
    const days = intervalDays(lvl);
    const row = el('div', 'mem-rung' + (count ? '' : ' is-empty'));
    const label = lvl === 0
      ? T.unseen
      : `${T.level} ${lvl} · ${days} ${plur(days, T.day, T.days)}`;
    row.append(el('span', 'mem-rung-label', label));
    const track = el('span', 'mem-rung-track');
    const fill = el('span', 'mem-rung-fill');
    fill.style.inlineSize = (count ? Math.max(6, (count / max) * 100) : 0) + '%';
    track.append(fill);
    row.append(track);
    row.append(el('span', 'mem-rung-count', count ? `${count} ${plur(count, T.card, T.cards)}` : ''));
    host.append(row);
  }
}

function setMode(next) {
  mode = next === 'llm' ? 'llm' : 'you';
  document.querySelectorAll('.mem-mode-btn').forEach((btn) => {
    const on = btn.dataset.mode === mode;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.querySelectorAll('.mem-explain').forEach((blk) => {
    blk.hidden = blk.dataset.mode !== mode;
  });
  const { cards } = dataset();
  renderLadder(cards);
}

function render() {
  const { cards, demo } = dataset();
  const flag = $('mem-demo-flag');
  if (flag) flag.hidden = !demo;
  renderStats(demo);
  renderLadder(cards);
}

function init() {
  if (!$('mem-ladder') || !$('mem-stats')) return; // not this page
  document.querySelectorAll('.mem-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });
  // start in "you" mode with explanations matched
  document.querySelectorAll('.mem-explain').forEach((blk) => { blk.hidden = blk.dataset.mode !== 'you'; });
  document.querySelectorAll('.mem-mode-btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.dataset.mode === 'you' ? 'true' : 'false');
  });
  render();
  // live update when a recall card on this (or any) page is graded
  document.addEventListener('recall-graded', render);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
