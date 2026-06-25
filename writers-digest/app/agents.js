/* agents.js — the writers' room as a drag-to-build TRANSFORM PIPELINE.
 *
 * Two surfaces:
 *   • the ROOM (right column) — the agents YOU put there. It runs top-to-bottom
 *     on each finished paragraph: a pinned START "Copy & Admin" (mechanical
 *     proofread), then your middle agents each REWRITE the block to conform to
 *     their lens (chained), then a pinned END "Continuity" reconciles the
 *     surrounding narrative within a blast radius.
 *   • the LIBRARY (Agents tab) — every agent NOT currently in the room. Drag one
 *     into the room, or create your own. The room starts almost empty (just the
 *     two anchors + one preset, Voice Coach) — nothing is in it unless you add it.
 *
 * Exports:
 *   loadAgents()                          — load agents.json (seed + persist if absent)
 *   runRoom(block, ctx)                   — run the room → { rewritten, changed, trail, continuity }
 *   renderAgentsUI(roomEl, libraryEl)     — render both surfaces + wire drag-in / reorder / CRUD
 *
 * Agent def: { id, kind, name, description, systemPrompt, enabled, order, builtin, pinned?, radius?, inRoom }
 * ====================================================================== */
import { Z, loadJSON, saveJSONSoon, slugify, estTokens } from './core.js';
import { llmJSON, llmText } from './llm.js';

let LESSONS = [];
try { ({ LESSONS = [] } = await import('./rag.js')); } catch { LESSONS = []; }
let bibleContext = async () => '';
try { const m = await import('./storybible.js'); if (typeof m.bibleContext === 'function') bibleContext = m.bibleContext; } catch {}

const AGENTS_PATH = 'agents.json';
const KINDS = ['genre', 'voice', 'topic', 'pov', 'lesson', 'custom'];
const RADII = [
  { value: 'off', label: 'Off' },
  { value: 'sentence', label: '1 sentence back' },
  { value: 'paragraph', label: '1 paragraph back' },
  { value: 'p3', label: '3 paragraphs back' },
  { value: 'p10', label: '10 paragraphs back' },
];

let AGENTS = [];

/* ---- seeding --------------------------------------------------------- */
function uid(prefix = 'a') { return prefix + '_' + Math.random().toString(36).slice(2, 9); }

function anchorStart() {
  return {
    id: 'copy_admin', kind: 'copyedit', name: 'Copy & Admin', pinned: 'start', inRoom: true,
    enabled: true, builtin: true, order: -1,
    description: 'The default first pass: spelling, grammar, punctuation and formatting — never voice or style. Runs before every other agent.',
    systemPrompt: 'You are a meticulous copy editor doing a light mechanical proofread. You fix spelling, grammar, punctuation and capitalization only — you never restyle prose, change wording, or touch voice.',
  };
}
function anchorEnd() {
  return {
    id: 'continuity', kind: 'continuity', name: 'Continuity', pinned: 'end', inRoom: true,
    enabled: true, builtin: true, order: 1e6, radius: 'paragraph',
    description: 'The default last pass: makes sure the surrounding narrative still fits the change you just made. Proposes edits to nearby paragraphs within its blast radius — you approve each one.',
    systemPrompt: "You are the continuity editor in a writers' room. You reconcile the surrounding narrative to the writer's latest change. You propose edits to PRIOR text only; you never rewrite the change itself.",
  };
}

function seedDefaults() {
  const defs = [];
  let order = 0;
  // preset middle agents — all start in the LIBRARY except Voice Coach (pre-added)
  const push = (d) => defs.push({ enabled: true, builtin: true, inRoom: false, order: order++, ...d });

  push({
    id: 'voice', kind: 'voice', name: 'Voice Coach', inRoom: true,
    description: 'Tunes rhythm, diction and tone toward the author\'s chosen voice / inspiration.',
    systemPrompt:
      'You are the Voice Coach. Use the story\'s VOICE setting (an author or style named in the settings) as your north star. ' +
      'Move rhythm and diction toward that voice where the prose reads flat or off-key. Preserve meaning; never flatten intent.',
  });
  push({
    id: 'genre', kind: 'genre', name: 'Genre Keeper',
    description: 'Keeps the prose true to the chosen genre — its tropes, pacing, and reader expectations.',
    systemPrompt:
      'You are the Genre Keeper in a writers\' room. Read the paragraph through the lens of the story\'s GENRE. ' +
      'Pull register, pacing and convention toward that genre (no anachronism, no deflated stakes). ' +
      'Do NOT change the writer\'s ideas or events — sharpen them toward the genre.',
  });
  push({
    id: 'topic', kind: 'topic', name: 'Theme & Resonance',
    description: 'Watches for the story\'s themes and surfaces chances to deepen them.',
    systemPrompt:
      'You are the Theme & Resonance editor. Hold the story\'s premise/blurb and recurring themes in mind. ' +
      'Where a line could carry more thematic weight or subtext, sharpen the image. Be subtle — themes land best implied.',
  });
  push({
    id: 'pov', kind: 'pov', name: 'POV & Tense Enforcer',
    description: 'Catches point-of-view slips and tense drift against the story setup.',
    systemPrompt:
      'You are the POV & Tense Enforcer. The story declares a POINT OF VIEW and a TENSE. ' +
      'Fix any sentence that violates the declared POV (head-hopping, knowledge the POV character cannot have) or drifts in tense. ' +
      'Change only what genuinely violates POV/tense; leave everything else exactly as written.',
  });

  const lessons = Array.isArray(LESSONS) ? LESSONS : [];
  for (const L of lessons) {
    const title = (L && (L.title || L.name || L.id)) || 'Craft Lesson';
    const advice = (L && (L.advice || L.text || L.body || L.summary || L.rule || L.description)) || title;
    const lid = (L && L.id) ? String(L.id) : slugify(title);
    push({
      id: 'lesson_' + lid, kind: 'lesson', name: title,
      description: 'Craft lesson: ' + String(advice).replace(/\s+/g, ' ').slice(0, 120),
      systemPrompt:
        'You are a craft mentor enforcing ONE specific writing lesson on this paragraph.\n\n' +
        'LESSON — "' + title + '":\n' + advice + '\n\n' +
        'Apply this lesson with the smallest change that honours it. If it already honours the lesson, leave it unchanged. Keep the writer\'s meaning.',
    });
  }

  return [anchorStart(), ...defs, anchorEnd()];
}

/* ---- load / accessors ------------------------------------------------ */
export async function loadAgents() {
  const stored = await loadJSON(AGENTS_PATH, null);
  if (Array.isArray(stored) && stored.length) {
    AGENTS = stored.map((a, i) => normalizeAgent(a, i));
    ensureAnchors();
  } else {
    AGENTS = seedDefaults();
    saveJSONSoon(AGENTS_PATH, AGENTS);
  }
  resort();
  return AGENTS;
}

function ensureAnchors() {
  if (!AGENTS.some(a => a.pinned === 'start')) AGENTS.unshift(anchorStart());
  if (!AGENTS.some(a => a.pinned === 'end')) AGENTS.push(anchorEnd());
}

function normalizeAgent(a, i) {
  const pinned = (a.pinned === 'start' || a.pinned === 'end') ? a.pinned : undefined;
  // migration: stored agents without an inRoom field — anchors + Voice + customs
  // start in the room; other built-in presets start in the library.
  const inRoom = pinned ? true
    : (typeof a.inRoom === 'boolean' ? a.inRoom
      : (a.id === 'voice' ? true : (a.builtin ? false : true)));
  return {
    id: a.id || uid(),
    kind: pinned ? (a.kind || (pinned === 'start' ? 'copyedit' : 'continuity')) : (KINDS.includes(a.kind) ? a.kind : 'custom'),
    name: a.name || 'Untitled agent',
    description: a.description || '',
    systemPrompt: a.systemPrompt || '',
    enabled: a.enabled !== false,
    order: Number.isFinite(a.order) ? a.order : i,
    builtin: !!a.builtin,
    pinned,
    radius: a.radius || (pinned === 'end' ? 'paragraph' : undefined),
    inRoom,
  };
}

function resort() {
  const mids = AGENTS.filter(a => !a.pinned).sort((x, y) => x.order - y.order);
  mids.forEach((a, i) => { a.order = i; });
}

// The room, in run order: start anchor, in-room middles by order, end anchor.
function roomOrder() {
  const start = AGENTS.filter(a => a.pinned === 'start');
  const end = AGENTS.filter(a => a.pinned === 'end');
  const mids = AGENTS.filter(a => !a.pinned && a.inRoom).sort((a, b) => a.order - b.order);
  return [...start, ...mids, ...end];
}
function libraryAgents() {
  return AGENTS.filter(a => !a.pinned && !a.inRoom).sort((a, b) => (a.builtin === b.builtin ? a.name.localeCompare(b.name) : a.builtin ? -1 : 1));
}

function persist() { resort(); saveJSONSoon(AGENTS_PATH, AGENTS); }

/* ---- prose helpers --------------------------------------------------- */
function settingsSummary(s = {}) {
  return [
    `POV: ${s.pov || '(unspecified)'}`,
    `Tense: ${s.tense || '(unspecified)'}`,
    `Genre: ${s.genre || '(unspecified)'}${s.subgenre ? ' / ' + s.subgenre : ''}`,
    `Voice / inspiration: ${s.voice || '(unspecified)'}`,
    `Premise / blurb: ${s.blurb || s.premise || '(unspecified)'}`,
  ].join('\n');
}
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
function cleanProse(s, fallback) {
  let t = String(s || '').trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('“') && t.endsWith('”'))) t = t.slice(1, -1).trim();
  t = t.replace(/^"""\s*/, '').replace(/\s*"""$/, '').trim();
  t = t.replace(/^(rewritten|revised|edited|corrected)( paragraph)?:\s*/i, '').trim();
  return t || fallback;
}
const tokenCap = (text, mult = 4, floor = 220, ceil = 1600) =>
  Math.max(floor, Math.min(ceil, estTokens(text) * mult + 120));

/* ---- transform passes ------------------------------------------------ */
async function copyEditPass(text) {
  const out = await llmText(
    `Correct ONLY spelling, grammar, punctuation, capitalization and obvious typos in this paragraph. ` +
    `Do NOT change wording, voice, style, sentence structure, or meaning. If it is already clean, return it exactly as-is. ` +
    `Return ONLY the corrected paragraph — no quotes, no commentary.\n\n"""${text}"""`,
    { system: 'You are a meticulous copy editor doing a light mechanical proofread. You never restyle prose.',
      decode: { temperature: 0, max_tokens: tokenCap(text, 3) } }
  );
  return cleanProse(out, text);
}
async function transformPass(agent, text, { settings, bible }) {
  const sys = (agent.systemPrompt || ('You are ' + agent.name + ', an editor in a writers\' room.')) +
    '\n\nYou operate as a REWRITER in a pipeline: you receive the current paragraph (already touched by earlier agents) and return a version that conforms to your lens.';
  const prompt =
`=== STORY SETTINGS ===
${settingsSummary(settings)}

=== STORY BIBLE (relevant facts) ===
${bible ? bible.slice(0, 900) : '(none)'}

=== CURRENT PARAGRAPH ===
"""${text}"""

Rewrite the paragraph so it conforms to YOUR lens. Keep the writer's meaning, the same events, and roughly the same length. Make the SMALLEST change that achieves your lens — if it already conforms, return it unchanged. Return ONLY the rewritten paragraph: no quotes, no preamble, no notes.`;
  const out = await llmText(prompt, { system: sys, decode: { temperature: 0.4, max_tokens: tokenCap(text, 4) } });
  return cleanProse(out, text);
}

/* ---- END · continuity ------------------------------------------------ */
const CONTINUITY_SCHEMA = Z.object({
  issues: Z.array(Z.object({
    offset: Z.integer().describe('how many paragraphs back the conflicting text is: 1 = the paragraph immediately before the change'),
    original: Z.string().describe('the EXACT substring copied verbatim from THAT prior paragraph to replace'),
    replacement: Z.string().describe('the corrected text that matches the writer\'s new change'),
    reason: Z.string().describe('the specific conflict, in a few words'),
  })).default([]),
});
function radiusCount(radius) {
  return radius === 'sentence' ? 1 : radius === 'paragraph' ? 1 : radius === 'p3' ? 3 : radius === 'p10' ? 10 : 0;
}
async function continuityRepair(block, { settings, bible, priorTexts, radius }) {
  const N = radiusCount(radius);
  if (!N || !Array.isArray(priorTexts) || !priorTexts.length) return [];
  const slice = priorTexts.slice(-N);
  let scoped = slice.map((t, i) => ({ offset: slice.length - i, text: String(t || '') }));
  if (radius === 'sentence') {
    const last = scoped[scoped.length - 1];
    if (last) { const m = last.text.match(/[^.!?]*[.!?]["”']?\s*$/); last.text = (m ? m[0] : last.text).trim(); }
    scoped = scoped.slice(-1);
  }
  scoped = scoped.filter(s => s.text.trim().length > 1);
  if (!scoped.length) return [];
  const ctxBlock = scoped.slice().reverse().map(s => `PRIOR ¶ (offset ${s.offset}):\n"""${s.text}"""`).join('\n\n');
  const out = await llmJSON(
`The writer just changed or added this paragraph:

=== THE CHANGE (now current) ===
"""${block}"""

${bible ? '=== STORY BIBLE (established facts) ===\n' + bible.slice(0, 700) + '\n\n' : ''}Check whether THE CHANGE introduces a contradiction with the prior paragraph(s) below — a fact, name, object, place, detail, or state that no longer matches. For each genuine conflict, propose the SMALLEST edit to the PRIOR paragraph so the narrative stays consistent with the change. Only real conflicts; if everything is consistent, return an empty issues array.

${ctxBlock}`,
    CONTINUITY_SCHEMA,
    { system: anchorEnd().systemPrompt, max_tokens: 900 }
  );
  const issues = (out && out.issues) || [];
  const byOffset = Object.fromEntries(scoped.map(s => [s.offset, s.text]));
  return issues
    .filter(it => it && byOffset[it.offset] != null && it.original &&
      byOffset[it.offset].includes(it.original) && norm(it.original) !== norm(it.replacement))
    .slice(0, 4)
    .map(it => ({ id: uid('c'), agent: 'Continuity', type: 'replace', offset: it.offset, original: it.original, replacement: it.replacement, reason: it.reason || 'keep the story consistent' }));
}

/* ---- run the room ---------------------------------------------------- */
export async function runRoom(block, ctx = {}) {
  const original = String(block || '');
  if (original.trim().length < 4) return { rewritten: original, changed: false, trail: [], continuity: [] };
  const settings = ctx.settings || {};
  let bible = '';
  try { bible = (await bibleContext(original)) || ''; } catch { bible = ''; }

  const room = roomOrder();
  let text = original;
  const trail = [];
  const errs = [];
  for (const agent of room) {
    if (!agent.enabled || agent.pinned === 'end') continue;
    let next = text;
    try {
      next = agent.pinned === 'start' ? await copyEditPass(text) : await transformPass(agent, text, { settings, bible });
    } catch (e) { next = text; errs.push(String((e && e.message) || e)); }
    next = (next || '').trim();
    if (next && norm(next) !== norm(text)) { text = next; trail.push({ agent: agent.name, kind: agent.kind }); }
  }
  let continuity = [];
  const end = room.find(a => a.pinned === 'end');
  if (end && end.enabled && end.radius && end.radius !== 'off') {
    try { continuity = await continuityRepair(text, { settings, bible, priorTexts: ctx.priorTexts || [], radius: end.radius }); }
    catch (e) { continuity = []; errs.push(String((e && e.message) || e)); }
  }
  // If the agents ran but nothing changed AND calls were failing, the model
  // endpoint is unreachable — surface that instead of silently doing nothing.
  const error = (errs.length && !trail.length) ? errs[0] : null;
  return { rewritten: text, changed: norm(text) !== norm(original), trail, continuity, error };
}

/* ====================================================================== *
 *  UI — the room (right column) + the library (Agents tab)
 * ====================================================================== */
function kindOptions(selected) {
  return KINDS.map(k => `<option value="${k}"${k === selected ? ' selected' : ''}>${k}</option>`).join('');
}

export function renderAgentsUI(roomEl, libEl) {
  let dragId = null, dragFrom = null;   // shared DnD state across both surfaces

  function commit() { persist(); drawRoom(); drawLibrary(); }

  /* ---------- the ROOM (right column) ---------- */
  function drawRoom() {
    roomEl.innerHTML = '';
    const h = document.createElement('h3'); h.textContent = "Your writers' room"; roomEl.appendChild(h);
    const intro = document.createElement('div');
    intro.className = 'muted'; intro.style.marginBottom = '10px';
    intro.innerHTML = 'Runs <b>top&#8209;to&#8209;bottom</b> on each paragraph you finish. Drag agents in from the <b>Agents</b> tab; drag&nbsp;&#9776; to reorder.';
    roomEl.appendChild(intro);

    const list = document.createElement('div');
    list.className = 'room-list';
    roomEl.appendChild(list);

    const order = roomOrder();
    const mids = order.filter(a => !a.pinned);
    order.forEach(agent => list.appendChild(roomCard(agent)));

    if (!mids.length) {
      const drop = document.createElement('div');
      drop.className = 'room-empty';
      drop.textContent = 'Drop agents here — open the Agents tab and drag one in.';
      // insert the empty hint between the two anchors
      const endCard = list.querySelector('[data-pin="end"]');
      list.insertBefore(drop, endCard);
    }

    // the whole list is a drop target for library → room
    list.addEventListener('dragover', (e) => { if (dragFrom === 'library') { e.preventDefault(); list.classList.add('drag-over'); } });
    list.addEventListener('dragleave', () => list.classList.remove('drag-over'));
    list.addEventListener('drop', (e) => {
      list.classList.remove('drag-over');
      if (dragFrom === 'library' && dragId) { e.preventDefault(); addToRoom(dragId); }
    });
  }

  function roomCard(agent) {
    const pinned = !!agent.pinned;
    const card = document.createElement('div');
    card.className = 'card' + (pinned ? ' pinned' : '');
    card.dataset.id = agent.id;
    if (pinned) card.dataset.pin = agent.pinned;

    const row = document.createElement('div'); row.className = 'row';
    const handle = document.createElement('span'); handle.className = 'handle';
    if (pinned) { handle.textContent = '⚲'; handle.title = agent.pinned === 'start' ? 'Always runs first' : 'Always runs last'; handle.style.cursor = 'default'; }
    else { handle.textContent = '☰'; handle.title = 'Drag to reorder'; handle.draggable = true; }
    row.appendChild(handle);

    const name = document.createElement('span'); name.className = 'name'; name.textContent = agent.name; row.appendChild(name);
    if (pinned) { const pin = document.createElement('span'); pin.className = 'pin'; pin.textContent = agent.pinned === 'start' ? 'start' : 'end'; row.appendChild(pin); }
    else { const kind = document.createElement('span'); kind.className = 'kind'; kind.textContent = agent.kind; row.appendChild(kind); }

    const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.className = 'toggle';
    toggle.checked = !!agent.enabled; toggle.title = agent.enabled ? 'Enabled' : 'Disabled';
    toggle.addEventListener('change', () => { agent.enabled = toggle.checked; persist(); });
    row.appendChild(toggle);
    card.appendChild(row);

    const desc = document.createElement('div'); desc.className = 'desc'; desc.textContent = agent.description || '(no description)'; card.appendChild(desc);

    if (agent.pinned === 'end') {
      const rl = document.createElement('label'); rl.textContent = 'Blast radius — how far back to reconcile'; rl.style.marginTop = '8px'; card.appendChild(rl);
      const sel = document.createElement('select');
      sel.innerHTML = RADII.map(r => `<option value="${r.value}"${r.value === (agent.radius || 'paragraph') ? ' selected' : ''}>${r.label}</option>`).join('');
      sel.addEventListener('change', () => { agent.radius = sel.value; persist(); });
      card.appendChild(sel);
    }

    const acts = document.createElement('div'); acts.className = 'row'; acts.style.marginTop = '8px'; acts.style.gap = '7px';
    const editBtn = document.createElement('button'); editBtn.className = 'btn sm'; editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => { if (card.querySelector('[data-role="form"]')) return; card.appendChild(buildForm(agent, () => {})); });
    acts.appendChild(editBtn);
    if (!pinned) {
      const rm = document.createElement('button'); rm.className = 'btn sm'; rm.style.background = 'transparent'; rm.style.border = '1px solid #463e33';
      rm.textContent = 'Remove'; rm.title = 'Send back to the library';
      rm.addEventListener('click', () => { agent.inRoom = false; commit(); });
      acts.appendChild(rm);
    }
    card.appendChild(acts);

    if (!pinned) {
      handle.addEventListener('dragstart', (e) => { dragId = agent.id; dragFrom = 'room'; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', agent.id); card.classList.add('dragging'); });
      handle.addEventListener('dragend', () => { card.classList.remove('dragging'); dragId = null; dragFrom = null; });
      card.addEventListener('dragover', (e) => { if (dragFrom === 'room') { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } });
      card.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); if (dragFrom === 'room' && dragId && dragId !== agent.id) reorder(dragId, agent.id); });
    }
    return card;
  }

  function addToRoom(id) {
    const a = AGENTS.find(x => x.id === id); if (!a || a.pinned) return;
    a.inRoom = true;
    const maxOrder = AGENTS.filter(x => !x.pinned && x.inRoom).reduce((m, x) => Math.max(m, x.order), -1);
    a.order = maxOrder + 1;
    commit();
  }
  function reorder(id, targetId) {
    const mids = AGENTS.filter(a => !a.pinned && a.inRoom).sort((a, b) => a.order - b.order);
    const from = mids.findIndex(a => a.id === id); const to = mids.findIndex(a => a.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = mids.splice(from, 1); mids.splice(to, 0, moved);
    mids.forEach((a, i) => { a.order = i; });
    commit();
  }

  /* ---------- the LIBRARY (Agents tab) ---------- */
  function drawLibrary() {
    libEl.innerHTML = '';
    const h = document.createElement('h3'); h.textContent = 'Agent library'; libEl.appendChild(h);
    const intro = document.createElement('div'); intro.className = 'muted'; intro.style.marginBottom = '12px';
    intro.innerHTML = 'Drag an agent into <b>your writers’ room</b> on the right (or click <b>Add&nbsp;&rarr;</b>). Build your own for a specific voice or tone.';
    libEl.appendChild(intro);

    const list = document.createElement('div'); libEl.appendChild(list);
    const lib = libraryAgents();
    if (!lib.length) {
      const empty = document.createElement('div'); empty.className = 'muted'; empty.textContent = 'Everything is in your room. Create a new agent below.'; list.appendChild(empty);
    }
    lib.forEach(agent => list.appendChild(libraryCard(agent)));

    const addWrap = document.createElement('div'); addWrap.style.marginTop = '6px';
    const addBtn = document.createElement('button'); addBtn.className = 'btn'; addBtn.style.width = '100%'; addBtn.textContent = '+ Create your own agent';
    addBtn.addEventListener('click', () => { addBtn.style.display = 'none'; addWrap.appendChild(buildForm(null, () => { addBtn.style.display = ''; })); });
    addWrap.appendChild(addBtn); libEl.appendChild(addWrap);
  }

  function libraryCard(agent) {
    const card = document.createElement('div'); card.className = 'card lib'; card.dataset.id = agent.id; card.draggable = true;
    const row = document.createElement('div'); row.className = 'row';
    const handle = document.createElement('span'); handle.className = 'handle'; handle.textContent = '⠿'; handle.title = 'Drag into your writers’ room'; row.appendChild(handle);
    const name = document.createElement('span'); name.className = 'name'; name.textContent = agent.name; row.appendChild(name);
    const kind = document.createElement('span'); kind.className = 'kind'; kind.textContent = agent.kind; row.appendChild(kind);
    if (agent.builtin) { const bp = document.createElement('span'); bp.className = 'kind'; bp.textContent = 'built-in'; row.appendChild(bp); }
    card.appendChild(row);

    const desc = document.createElement('div'); desc.className = 'desc'; desc.textContent = agent.description || '(no description)'; card.appendChild(desc);

    const acts = document.createElement('div'); acts.className = 'row'; acts.style.marginTop = '8px'; acts.style.gap = '7px';
    const add = document.createElement('button'); add.className = 'btn sm'; add.textContent = 'Add →'; add.title = 'Add to your writers’ room';
    add.addEventListener('click', () => addToRoom(agent.id)); acts.appendChild(add);
    const edit = document.createElement('button'); edit.className = 'btn sm'; edit.style.background = 'transparent'; edit.style.border = '1px solid #463e33'; edit.textContent = 'Edit';
    edit.addEventListener('click', () => { if (card.querySelector('[data-role="form"]')) return; card.appendChild(buildForm(agent, () => {})); }); acts.appendChild(edit);
    if (!agent.builtin) {
      const del = document.createElement('button'); del.className = 'btn sm'; del.style.background = 'var(--err)'; del.textContent = 'Delete';
      del.addEventListener('click', () => { if (!confirm(`Delete agent "${agent.name}"?`)) return; AGENTS = AGENTS.filter(a => a.id !== agent.id); commit(); });
      acts.appendChild(del);
    }
    card.appendChild(acts);

    card.addEventListener('dragstart', (e) => { dragId = agent.id; dragFrom = 'library'; e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', agent.id); card.classList.add('dragging'); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); dragId = null; dragFrom = null; });
    return card;
  }

  /* ---------- shared edit/create form ---------- */
  function buildForm(agent, onClose) {
    const isEdit = !!agent;
    const pinned = isEdit && !!agent.pinned;
    const form = document.createElement('div');
    form.dataset.role = 'form'; form.style.marginTop = '10px'; form.style.paddingTop = '10px'; form.style.borderTop = '1px solid #342e25';
    const mkLabel = (t) => { const l = document.createElement('label'); l.textContent = t; return l; };

    form.appendChild(mkLabel('Name'));
    const nameIn = document.createElement('input'); nameIn.value = isEdit ? agent.name : ''; nameIn.placeholder = 'e.g. Voice of Stephen King + Raymond E. Feist'; nameIn.disabled = pinned; form.appendChild(nameIn);

    let kindSel = null;
    if (!pinned) { form.appendChild(mkLabel('Kind')); kindSel = document.createElement('select'); kindSel.innerHTML = kindOptions(isEdit ? agent.kind : 'custom'); form.appendChild(kindSel); }

    form.appendChild(mkLabel('Description'));
    const descIn = document.createElement('input'); descIn.value = isEdit ? agent.description : ''; descIn.placeholder = 'What does this agent do to the text?'; form.appendChild(descIn);

    form.appendChild(mkLabel(pinned ? 'System prompt (the rule it enforces)' : 'System prompt (the lens it rewrites toward)'));
    const promptIn = document.createElement('textarea'); promptIn.rows = 5; promptIn.value = isEdit ? agent.systemPrompt : '';
    promptIn.placeholder = 'e.g. "You are a tone specialist. Rewrite the paragraph in dark, deadpan humour without changing events…"'; form.appendChild(promptIn);

    const btnRow = document.createElement('div'); btnRow.className = 'row'; btnRow.style.marginTop = '10px'; btnRow.style.gap = '7px';
    const saveBtn = document.createElement('button'); saveBtn.className = 'btn sm'; saveBtn.textContent = isEdit ? 'Save' : 'Create & add to room';
    saveBtn.addEventListener('click', () => {
      const nm = nameIn.value.trim();
      if (!nm) { nameIn.focus(); nameIn.style.borderColor = 'var(--err)'; return; }
      if (isEdit) {
        if (!pinned) { agent.name = nm; agent.kind = kindSel.value; }
        agent.description = descIn.value.trim(); agent.systemPrompt = promptIn.value.trim();
      } else {
        const maxOrder = AGENTS.filter(a => !a.pinned && a.inRoom).reduce((m, a) => Math.max(m, a.order), -1);
        AGENTS.push({
          id: uid('custom'),
          kind: KINDS.includes(kindSel.value) ? kindSel.value : 'custom',
          name: nm, description: descIn.value.trim(),
          systemPrompt: promptIn.value.trim() || ('You are ' + nm + ', an editor in a writers\' room. Rewrite the paragraph through your lens with the smallest change that helps.'),
          enabled: true, order: maxOrder + 1, builtin: false, inRoom: true,   // new agents go straight into the room
        });
      }
      onClose(); commit();
    });
    btnRow.appendChild(saveBtn);
    const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn sm'; cancelBtn.style.background = 'transparent'; cancelBtn.style.border = '1px solid #463e33'; cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => { form.remove(); onClose(); });
    btnRow.appendChild(cancelBtn);
    form.appendChild(btnRow);
    return form;
  }

  drawRoom();
  drawLibrary();
}
