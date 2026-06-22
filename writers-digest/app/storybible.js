/* storybible.js — the EXTRA memory for Writers Digest.
 *
 * A living story bible that tracks characters, locations, objects, and plot
 * devices as the manuscript grows, plus a continuity timeline. As paragraphs
 * are written, ingestParagraph() extracts entities + actions via constrained
 * JSON and MERGES them into the bible (deduping, unioning traits, bumping
 * mention counts) and indexes each touched entity into the vector store under a
 * 'bible:' source so it surfaces in retrieve(). continuityCheck() grounds the
 * LLM in the relevant slice of the bible and flags out-of-character actions or
 * contradictions as advisory 'note' suggestions. bibleContext() returns a
 * compact summary for other agents to ground on. renderBible() paints the
 * sidebar tab.
 * ====================================================================== */
import { Z, loadJSON, saveJSONSoon, indexContent } from './core.js';
import { llmJSON } from './llm.js';

/* ---- state ----------------------------------------------------------- */
const BIBLE_PATH = 'storybible.json';
const KINDS = ['characters', 'locations', 'objects', 'plot_devices'];
const KIND_LABEL = { characters:'Characters', locations:'Locations', objects:'Objects', plot_devices:'Plot Devices' };

let state = blankState();
function blankState(){ return { characters:{}, locations:{}, objects:{}, plot_devices:{}, timeline:[] }; }

export function getBible(){ return state; }

export async function loadBible(){
  const loaded = await loadJSON(BIBLE_PATH, null);
  state = normalize(loaded);
  return state;
}
function normalize(obj){
  const s = blankState();
  if (!obj || typeof obj !== 'object') return s;
  for (const k of KINDS){
    if (obj[k] && typeof obj[k] === 'object'){
      for (const [name, e] of Object.entries(obj[k])){
        if (!e || typeof e !== 'object') continue;
        s[k][name] = {
          name: e.name || name,
          kind: e.kind || singular(k),
          traits: Array.isArray(e.traits) ? e.traits.slice() : [],
          description: e.description || '',
          mentions: Number(e.mentions) || 0,
          actions: Array.isArray(e.actions) ? e.actions.slice() : [],
          firstSeen: Number(e.firstSeen) || 0,
        };
      }
    }
  }
  if (Array.isArray(obj.timeline)) s.timeline = obj.timeline.slice();
  return s;
}
function singular(kind){ return ({ characters:'character', locations:'location', objects:'object', plot_devices:'plot_device' })[kind] || kind; }
function kindOf(singularKind){
  return ({ character:'characters', location:'locations', object:'objects', plot_device:'plot_devices' })[singularKind] || (singularKind + 's');
}

/* ---- helpers --------------------------------------------------------- */
function allEntities(){
  const out = [];
  for (const k of KINDS) for (const e of Object.values(state[k])) out.push(e);
  return out;
}
function knownNamesIn(text){
  const lower = String(text || '').toLowerCase();
  return allEntities().filter(e => e.name && lower.includes(e.name.toLowerCase()));
}
function summaryFor(e){
  const parts = [`${e.name} (${e.kind})`];
  if (e.traits.length) parts.push('traits: ' + e.traits.join(', '));
  if (e.description) parts.push(e.description);
  if (e.actions.length) parts.push('recent: ' + e.actions.slice(-4).join(' / '));
  return parts.join('. ');
}

/* ---- ingestion ------------------------------------------------------- */
const INGEST_SCHEMA = Z.object({
  characters: Z.array(Z.object({
    name: Z.string().describe('character name as written'),
    traits: Z.array(Z.string()).default([]).describe('personality/physical traits stated or strongly implied'),
    description: Z.string().default('').describe('one-line description'),
    action: Z.string().default('').describe('what this character does in THIS paragraph (empty if nothing)'),
  })).default([]),
  locations: Z.array(Z.object({
    name: Z.string(), description: Z.string().default(''),
  })).default([]),
  objects: Z.array(Z.object({
    name: Z.string(), description: Z.string().default(''),
  })).default([]),
  plot_devices: Z.array(Z.object({
    name: Z.string(), description: Z.string().default(''),
  })).default([]),
});

export async function ingestParagraph(text){
  const para = String(text || '').trim();
  if (para.length < 4) return;
  let extracted = null;
  try {
    extracted = await llmJSON(
      `Extract concrete story-bible entities that APPEAR in this paragraph. Only include entities actually present; do not invent. Use names exactly as written.\n\nParagraph:\n"""${para}"""`,
      INGEST_SCHEMA,
      { system: 'You are a story-bible librarian. Extract characters (with traits/description and what they do here), locations, objects, and plot devices. If a category is absent, return an empty array for it.' }
    );
  } catch { extracted = null; }
  if (!extracted) return;

  const tick = state.timeline.length;
  const touched = [];

  mergeKind('characters', extracted.characters, (entity, raw) => {
    unionTraits(entity, raw.traits);
    if (raw.description && !entity.description) entity.description = raw.description;
    if (raw.action && raw.action.trim()){
      entity.actions.push(raw.action.trim());
      state.timeline.push({ at: tick, name: entity.name, action: raw.action.trim() });
    }
  });
  mergeKind('locations', extracted.locations, (entity, raw) => {
    if (raw.description && !entity.description) entity.description = raw.description;
  });
  mergeKind('objects', extracted.objects, (entity, raw) => {
    if (raw.description && !entity.description) entity.description = raw.description;
  });
  mergeKind('plot_devices', extracted.plot_devices, (entity, raw) => {
    if (raw.description && !entity.description) entity.description = raw.description;
  });

  function mergeKind(kind, list, apply){
    if (!Array.isArray(list)) return;
    for (const raw of list){
      const name = (raw && raw.name || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      let entity = state[kind][key];
      if (!entity){
        entity = state[kind][key] = {
          name, kind: singular(kind), traits: [], description: '', mentions: 0, actions: [], firstSeen: tick,
        };
      }
      entity.mentions += 1;
      apply(entity, raw);
      touched.push(entity);
    }
  }

  for (const e of touched){
    try { await indexContent('bible:' + e.name, 'bible:' + e.kind, summaryFor(e)); } catch {}
  }
  saveJSONSoon(BIBLE_PATH, state);
}

function unionTraits(entity, traits){
  if (!Array.isArray(traits)) return;
  const have = new Set(entity.traits.map(t => String(t).toLowerCase()));
  for (const t of traits){
    const v = String(t || '').trim();
    if (v && !have.has(v.toLowerCase())){ entity.traits.push(v); have.add(v.toLowerCase()); }
  }
}

/* ---- continuity check ------------------------------------------------ */
const CONTINUITY_SCHEMA = Z.object({
  issues: Z.array(Z.object({
    entity: Z.string().describe('the entity name involved'),
    reason: Z.string().describe('how this paragraph contradicts the bible or has someone act out of character'),
  })).default([]),
});

export async function continuityCheck(text){
  const para = String(text || '').trim();
  if (para.length < 4) return [];
  const known = knownNamesIn(para);
  if (!known.length) return [];

  let result = null;
  try {
    result = await llmJSON(
      `Story bible (established facts):\n${bibleContext(para)}\n\nNew paragraph:\n"""${para}"""\n\nDoes the paragraph CONTRADICT any established trait/fact, or have a character act clearly out of character? Only flag genuine, specific continuity problems. If everything is consistent, return an empty issues array.`,
      CONTINUITY_SCHEMA,
      { system: 'You are a continuity editor for fiction. Be conservative: flag only real contradictions against the established bible, never stylistic preferences or natural character growth.' }
    );
  } catch { result = null; }
  if (!result || !Array.isArray(result.issues)) return [];

  return result.issues.slice(0, 2)
    .filter(i => i && i.reason && i.reason.trim())
    .map((i, n) => ({
      id: 'c' + Date.now() + n,
      agent: 'Continuity',
      type: 'note',
      reason: (i.entity ? i.entity.trim() + ': ' : '') + i.reason.trim(),
    }));
}

/* ---- grounding context ----------------------------------------------- */
export function bibleContext(text){
  let relevant = knownNamesIn(text);
  if (!relevant.length){
    relevant = allEntities().sort((a, b) => b.mentions - a.mentions).slice(0, 6);
  }
  if (!relevant.length) return '(story bible empty)';
  return relevant.map(summaryFor).join('\n');
}

/* ---- rendering ------------------------------------------------------- */
export function renderBible(container){
  if (!container) return;
  container.innerHTML = '';

  const total = allEntities().length;
  if (!total){
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = '(empty — keep writing)';
    container.appendChild(empty);
    return;
  }

  for (const kind of KINDS){
    const entities = Object.values(state[kind]).sort((a, b) => b.mentions - a.mentions);
    if (!entities.length) continue;

    const h = document.createElement('h3');
    h.textContent = KIND_LABEL[kind];
    container.appendChild(h);

    for (const e of entities){
      const card = document.createElement('div');
      card.className = 'card';

      const row = document.createElement('div');
      row.className = 'row';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = e.name;
      const tag = document.createElement('span');
      tag.className = 'kind';
      tag.textContent = e.kind.replace('_', ' ');
      const mentions = document.createElement('span');
      mentions.className = 'muted toggle';
      mentions.textContent = '×' + e.mentions;
      row.append(name, tag, mentions);
      card.appendChild(row);

      if (e.description){
        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.textContent = e.description;
        card.appendChild(desc);
      }

      if (e.traits.length){
        const traits = document.createElement('div');
        traits.style.marginTop = '5px';
        for (const t of e.traits){
          const pill = document.createElement('span');
          pill.className = 'pill';
          pill.textContent = t;
          traits.appendChild(pill);
        }
        card.appendChild(traits);
      }

      if (e.actions.length){
        const tl = document.createElement('div');
        tl.className = 'desc';
        tl.style.marginTop = '6px';
        tl.textContent = '› ' + e.actions.slice(-3).join('  ›  ');
        card.appendChild(tl);
      }

      container.appendChild(card);
    }
  }

  if (state.timeline.length){
    const h = document.createElement('h3');
    h.textContent = 'Timeline';
    container.appendChild(h);
    const card = document.createElement('div');
    card.className = 'card';
    for (const ev of state.timeline.slice(-8)){
      const line = document.createElement('div');
      line.className = 'desc';
      line.style.marginTop = '2px';
      line.textContent = `${ev.name}: ${ev.action}`;
      card.appendChild(line);
    }
    container.appendChild(card);
  }
}
