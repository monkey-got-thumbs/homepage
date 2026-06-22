/* agents.js — the user-orderable writers' room.
 *
 * Each "agent" is a lens that reads the just-finished paragraph (plus the story
 * settings, the relevant story-bible context, and what earlier agents already
 * said) and either passes or returns a couple of focused suggestions. They run
 * IN THE ORDER the writer arranges them, so a later agent can build on an
 * earlier one's notes.
 *
 * Exports:
 *   loadAgents()                      — load agents.json (seed + persist if absent)
 *   getAgents()                       — ordered array of agent defs
 *   runPipeline(paragraph, ctx)       — run enabled agents in order → merged suggestion[]
 *   renderAgents(container, onChange) — CRUD + reorder + toggle UI, incl. "+ New agent"
 *
 * Agent def: { id, kind, name, description, systemPrompt, enabled, order, builtin }
 * Suggestion: { id, agent, type:'replace'|'note'|'insert', original?, replacement?, reason }
 * ====================================================================== */
import { Z, loadJSON, saveJSONSoon, slugify } from './core.js';
import { llmJSON } from './llm.js';

/* LESSONS / bibleContext come from sibling modules. Import defensively so the
 * writers' room still works (with graceful fallbacks) if those modules vary. */
let LESSONS = [];
try { ({ LESSONS = [] } = await import('./rag.js')); } catch { LESSONS = []; }
let bibleContext = async () => '';
try { const m = await import('./storybible.js'); if (typeof m.bibleContext === 'function') bibleContext = m.bibleContext; } catch {}

const AGENTS_PATH = 'agents.json';
const KINDS = ['genre', 'voice', 'topic', 'pov', 'lesson', 'custom'];

let AGENTS = [];

/* ---- seeding --------------------------------------------------------- */
function uid(prefix = 'a') { return prefix + '_' + Math.random().toString(36).slice(2, 9); }

function seedDefaults() {
  const defs = [];
  let order = 0;
  const push = (d) => defs.push({ enabled: true, builtin: true, order: order++, ...d });

  push({
    id: 'genre', kind: 'genre', name: 'Genre Keeper',
    description: 'Keeps the prose true to the chosen genre — its tropes, pacing, and reader expectations.',
    systemPrompt:
      'You are the Genre Keeper in a writers\' room. Read the paragraph through the lens of the story\'s GENRE. ' +
      'Flag moments that break genre expectations (wrong register, anachronism, deflated stakes, missed conventions) ' +
      'and offer small, surgical fixes that pull the prose toward the genre. Do NOT rewrite the writer\'s ideas — sharpen them.',
  });
  push({
    id: 'voice', kind: 'voice', name: 'Voice Coach',
    description: 'Tunes rhythm, diction and tone toward the author\'s chosen voice / inspiration.',
    systemPrompt:
      'You are the Voice Coach. Use the story\'s VOICE setting (an author or style named in the settings) as your north star. ' +
      'Where the paragraph reads flat, generic, or off-key, suggest tighter word choices and rhythm that move it toward that voice. ' +
      'Preserve meaning; never flatten the writer\'s intent. Prefer one or two precise swaps over wholesale rewrites.',
  });
  push({
    id: 'topic', kind: 'topic', name: 'Theme & Resonance',
    description: 'Watches for the story\'s themes and surfaces chances to deepen them.',
    systemPrompt:
      'You are the Theme & Resonance editor. Hold the story\'s premise/blurb and recurring themes in mind. ' +
      'Where a line could carry more thematic weight or subtext, suggest a sharper image or an inserted beat that resonates. ' +
      'Be subtle — themes land best implied, not stated. Avoid heavy-handedness.',
  });
  push({
    id: 'pov', kind: 'pov', name: 'POV & Tense Enforcer',
    description: 'Catches point-of-view slips and tense drift against the story setup.',
    systemPrompt:
      'You are the POV & Tense Enforcer. The story declares a POINT OF VIEW (e.g. first / third-limited / omniscient) and a TENSE ' +
      '(past / present). Flag any sentence that violates the declared POV (head-hopping, knowledge the POV character cannot have) ' +
      'or drifts in tense, and give the exact corrected substring. This is a continuity job: only flag genuine violations.',
  });

  // one lesson agent per entry in LESSONS
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
        'Read the paragraph only through this lesson. If it already honours the lesson, pass. ' +
        'Otherwise give at most two concrete, minimal edits that apply the lesson. Keep the writer\'s meaning.',
    });
  }

  return defs;
}

/* ---- load / accessors ------------------------------------------------ */
export async function loadAgents() {
  const stored = await loadJSON(AGENTS_PATH, null);
  if (Array.isArray(stored) && stored.length) {
    AGENTS = stored.map((a, i) => normalizeAgent(a, i));
  } else {
    AGENTS = seedDefaults();
    saveJSONSoon(AGENTS_PATH, AGENTS);
  }
  resort();
  return AGENTS;
}

function normalizeAgent(a, i) {
  return {
    id: a.id || uid(),
    kind: KINDS.includes(a.kind) ? a.kind : 'custom',
    name: a.name || 'Untitled agent',
    description: a.description || '',
    systemPrompt: a.systemPrompt || '',
    enabled: a.enabled !== false,
    order: Number.isFinite(a.order) ? a.order : i,
    builtin: !!a.builtin,
  };
}

function resort() {
  AGENTS.sort((x, y) => x.order - y.order);
  AGENTS.forEach((a, i) => { a.order = i; });
}

export function getAgents() {
  return AGENTS.slice().sort((a, b) => a.order - b.order);
}

function persist() { resort(); saveJSONSoon(AGENTS_PATH, AGENTS); }

/* ---- pipeline -------------------------------------------------------- */
const AGENT_SCHEMA = Z.object({
  pass: Z.boolean().describe('true if the paragraph needs no change through this lens'),
  suggestions: Z.array(Z.object({
    type: Z.enum(['replace', 'note', 'insert']).describe('replace = swap exact text; insert = add after; note = advisory only'),
    original: Z.string().default('').describe('for type=replace: the EXACT substring of the paragraph to replace'),
    replacement: Z.string().default('').describe('for replace/insert: the new or added text'),
    reason: Z.string().describe('short reason the change helps'),
  })).default([]),
});

function settingsSummary(s = {}) {
  const lines = [
    `POV: ${s.pov || '(unspecified)'}`,
    `Tense: ${s.tense || '(unspecified)'}`,
    `Genre: ${s.genre || '(unspecified)'}`,
    `Voice / inspiration: ${s.voice || '(unspecified)'}`,
    `Premise / blurb: ${s.blurb || s.premise || '(unspecified)'}`,
  ];
  return lines.join('\n');
}

export async function runPipeline(paragraph, ctx = {}) {
  const para = String(paragraph || '');
  if (para.trim().length < 4) return [];

  const settings = ctx.settings || {};
  let bible = '';
  try { bible = (await bibleContext(para)) || ''; } catch { bible = ''; }

  const enabled = getAgents().filter(a => a.enabled);
  const merged = [];
  const notes = []; // running "earlier agents said…" trail passed forward

  for (const agent of enabled) {
    const priorBlock = notes.length
      ? notes.map(n => `- [${n.agent}] ${n.line}`).join('\n')
      : '(none yet — you are first)';

    const prompt =
`You are reviewing ONE finished paragraph from a work of fiction.

=== STORY SETTINGS ===
${settingsSummary(settings)}

=== STORY BIBLE (relevant facts) ===
${bible ? bible.slice(0, 1200) : '(no bible context retrieved)'}

=== NOTES FROM EARLIER AGENTS (build on these; don't repeat them) ===
${priorBlock}

=== PARAGRAPH ===
"""${para}"""

Apply YOUR lens only. If the paragraph is fine through your lens, return {"pass": true, "suggestions": []}.
Otherwise return {"pass": false, "suggestions": [...]} with AT MOST 2 suggestions.
Rules:
- For type "replace", "original" MUST be copied EXACTLY from the paragraph above (verbatim substring) and "replacement" is the new text.
- For type "insert", "replacement" is a sentence/idea to add after the paragraph.
- For type "note", give advisory feedback only (omit original/replacement).
Be specific and minimal. Preserve the writer's meaning and voice.`;

    let out = null;
    try {
      out = await llmJSON(prompt, AGENT_SCHEMA, { system: agent.systemPrompt, max_tokens: 900 });
    } catch { out = null; }
    if (!out || out.pass) continue;

    const sugg = Array.isArray(out.suggestions) ? out.suggestions.slice(0, 2) : [];
    for (const s of sugg) {
      const type = ['replace', 'note', 'insert'].includes(s.type) ? s.type : 'note';
      const original = (s.original || '').trim();
      const replacement = (s.replacement || '').trim();
      const reason = (s.reason || '').trim() || 'suggested by ' + agent.name;

      if (type === 'replace') {
        // drop unless original is an exact substring of the paragraph and actually changes something
        if (!original || !para.includes(original) || original === replacement) continue;
        merged.push({ id: uid('s'), agent: agent.name, type, original, replacement, reason });
        notes.push({ agent: agent.name, line: `replace "${original.slice(0, 40)}" — ${reason}` });
      } else if (type === 'insert') {
        if (!replacement) continue;
        merged.push({ id: uid('s'), agent: agent.name, type, replacement, reason });
        notes.push({ agent: agent.name, line: `insert: ${reason}` });
      } else {
        merged.push({ id: uid('s'), agent: agent.name, type: 'note', reason });
        notes.push({ agent: agent.name, line: reason });
      }
    }
  }

  return merged;
}

/* ---- UI -------------------------------------------------------------- */
function kindOptions(selected) {
  return KINDS.map(k => `<option value="${k}"${k === selected ? ' selected' : ''}>${k}</option>`).join('');
}

export function renderAgents(container, onChange = () => {}) {
  const notify = () => { try { onChange(); } catch {} };

  function commit() { persist(); notify(); draw(); }

  function draw() {
    container.innerHTML = '';

    const h = document.createElement('h3');
    h.textContent = "Your writers' room";
    container.appendChild(h);

    const intro = document.createElement('div');
    intro.className = 'muted';
    intro.style.marginBottom = '10px';
    intro.textContent = 'Drag ☰ to reorder — agents run top-to-bottom and build on each other. Toggle, edit, or add your own.';
    container.appendChild(intro);

    const list = document.createElement('div');
    list.dataset.role = 'agent-list';
    container.appendChild(list);

    const ordered = getAgents();
    if (!ordered.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No agents yet — add one below.';
      list.appendChild(empty);
    }

    ordered.forEach(agent => list.appendChild(agentCard(agent)));

    // ---- "+ New agent" ----
    const addWrap = document.createElement('div');
    addWrap.style.marginTop = '6px';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn';
    addBtn.style.width = '100%';
    addBtn.textContent = '+ New agent';
    addBtn.addEventListener('click', () => {
      addBtn.style.display = 'none';
      addWrap.appendChild(buildForm(null, addWrap, addBtn));
    });
    addWrap.appendChild(addBtn);
    container.appendChild(addWrap);
  }

  function agentCard(agent) {
    const card = document.createElement('div');
    card.className = 'card';
    card.draggable = false;
    card.dataset.id = agent.id;

    const row = document.createElement('div');
    row.className = 'row';

    const handle = document.createElement('span');
    handle.className = 'handle';
    handle.textContent = '☰';
    handle.title = 'Drag to reorder';
    handle.draggable = true;
    row.appendChild(handle);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = agent.name;
    row.appendChild(name);

    const kind = document.createElement('span');
    kind.className = 'kind';
    kind.textContent = agent.kind;
    row.appendChild(kind);

    if (agent.builtin) {
      const bp = document.createElement('span');
      bp.className = 'kind';
      bp.textContent = 'built-in';
      row.appendChild(bp);
    }

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'toggle';
    toggle.checked = !!agent.enabled;
    toggle.title = agent.enabled ? 'Enabled' : 'Disabled';
    toggle.addEventListener('change', () => { agent.enabled = toggle.checked; commit(); });
    row.appendChild(toggle);

    card.appendChild(row);

    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = agent.description || '(no description)';
    card.appendChild(desc);

    const acts = document.createElement('div');
    acts.className = 'row';
    acts.style.marginTop = '8px';
    acts.style.gap = '7px';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn sm';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      if (card.querySelector('[data-role="form"]')) return;
      card.appendChild(buildForm(agent, card, null));
    });
    acts.appendChild(editBtn);

    if (!agent.builtin) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn sm';
      delBtn.style.background = 'var(--err)';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        if (!confirm(`Delete agent "${agent.name}"?`)) return;
        AGENTS = AGENTS.filter(a => a.id !== agent.id);
        commit();
      });
      acts.appendChild(delBtn);
    }

    card.appendChild(acts);

    // ---- drag to reorder (handle initiates) ----
    handle.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', agent.id);
      card.classList.add('dragging');
      card.style.opacity = '0.5';
    });
    handle.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      card.style.opacity = '';
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData('text/plain');
      if (!dragId || dragId === agent.id) return;
      reorder(dragId, agent.id);
    });

    return card;
  }

  function reorder(dragId, targetId) {
    const ord = getAgents();
    const from = ord.findIndex(a => a.id === dragId);
    const to = ord.findIndex(a => a.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ord.splice(from, 1);
    ord.splice(to, 0, moved);
    ord.forEach((a, i) => { a.order = i; });
    commit();
  }

  function buildForm(agent, mountParent, hiddenBtn) {
    const isEdit = !!agent;
    const form = document.createElement('div');
    form.dataset.role = 'form';
    form.style.marginTop = '10px';
    form.style.paddingTop = '10px';
    form.style.borderTop = '1px solid #342e25';

    const mkLabel = (t) => { const l = document.createElement('label'); l.textContent = t; return l; };

    form.appendChild(mkLabel('Name'));
    const nameIn = document.createElement('input');
    nameIn.value = isEdit ? agent.name : '';
    nameIn.placeholder = 'e.g. Dialogue Doctor';
    form.appendChild(nameIn);

    form.appendChild(mkLabel('Kind'));
    const kindSel = document.createElement('select');
    kindSel.innerHTML = kindOptions(isEdit ? agent.kind : 'custom');
    form.appendChild(kindSel);

    form.appendChild(mkLabel('Description'));
    const descIn = document.createElement('input');
    descIn.value = isEdit ? agent.description : '';
    descIn.placeholder = 'What does this agent watch for?';
    form.appendChild(descIn);

    form.appendChild(mkLabel('System prompt (the lens)'));
    const promptIn = document.createElement('textarea');
    promptIn.rows = 5;
    promptIn.value = isEdit ? agent.systemPrompt : '';
    promptIn.placeholder = 'Frame this agent\'s perspective. e.g. "You are a dialogue specialist. Flag stilted or on-the-nose lines and tighten subtext…"';
    form.appendChild(promptIn);

    const enWrap = document.createElement('div');
    enWrap.className = 'row';
    enWrap.style.marginTop = '8px';
    const enIn = document.createElement('input');
    enIn.type = 'checkbox';
    enIn.style.width = 'auto';
    enIn.checked = isEdit ? !!agent.enabled : true;
    const enLbl = document.createElement('label');
    enLbl.textContent = 'Enabled';
    enLbl.style.margin = '0';
    enWrap.appendChild(enIn);
    enWrap.appendChild(enLbl);
    form.appendChild(enWrap);

    const btnRow = document.createElement('div');
    btnRow.className = 'row';
    btnRow.style.marginTop = '10px';
    btnRow.style.gap = '7px';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn sm';
    saveBtn.textContent = isEdit ? 'Save' : 'Create agent';
    saveBtn.addEventListener('click', () => {
      const nm = nameIn.value.trim();
      if (!nm) { nameIn.focus(); nameIn.style.borderColor = 'var(--err)'; return; }
      if (isEdit) {
        agent.name = nm;
        agent.kind = kindSel.value;
        agent.description = descIn.value.trim();
        agent.systemPrompt = promptIn.value.trim();
        agent.enabled = enIn.checked;
      } else {
        AGENTS.push({
          id: uid('custom'),
          kind: KINDS.includes(kindSel.value) ? kindSel.value : 'custom',
          name: nm,
          description: descIn.value.trim(),
          systemPrompt: promptIn.value.trim() ||
            ('You are ' + nm + ', an editor in a writers\' room. Review the paragraph through your lens and suggest minimal, concrete improvements.'),
          enabled: enIn.checked,
          order: AGENTS.length,
          builtin: false,
        });
      }
      commit();
    });
    btnRow.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn sm';
    cancelBtn.style.background = 'transparent';
    cancelBtn.style.border = '1px solid #463e33';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      form.remove();
      if (hiddenBtn) hiddenBtn.style.display = '';
    });
    btnRow.appendChild(cancelBtn);

    form.appendChild(btnRow);
    return form;
  }

  draw();
}
