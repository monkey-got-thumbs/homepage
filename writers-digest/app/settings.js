/* settings.js — Writers Digest story-setup module.
 *
 * Owns the "Setup" pane: point-of-view, tense, genre/sub-genre, voice
 * inspiration, blurb, and outline/skeleton. These values become the steering
 * context every agent (and the continuity check) reads via getSettings(),
 * so the room writes in the writer's chosen mode rather than a default one.
 *
 * Persistence is OPFS-backed (settings.json) and debounced; every field
 * change updates module state, schedules a save, and notifies the host so it
 * can re-run anything that depends on the setup.
 * ====================================================================== */
import { saveJSONSoon, loadJSON } from './core.js';

const DEFAULTS = {
  pov: '3rd-limited',
  tense: 'past',
  genre: '',
  subgenre: '',
  voice: '',
  blurb: '',
  outline: '',
};

let state = { ...DEFAULTS };

/* Load settings.json into module state. Call once at boot. */
export async function loadSettings() {
  const saved = await loadJSON('settings.json', null);
  state = { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
  return state;
}

/* Current settings object (the live module state). */
export function getSettings() {
  return state;
}

const POV_OPTS = [
  ['1st', '1st person'],
  ['3rd-limited', '3rd limited'],
  ['3rd-omniscient', '3rd omniscient'],
];
const TENSE_OPTS = [
  ['past', 'Past'],
  ['present', 'Present'],
];

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const c of kids) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return n;
}

function selectField(labelText, key, opts) {
  const lab = el('label', { text: labelText });
  const sel = el('select');
  for (const [val, text] of opts) {
    const o = el('option', { value: val, text });
    if (state[key] === val) o.selected = true;
    sel.appendChild(o);
  }
  return { lab, field: sel };
}

function inputField(labelText, key, placeholder) {
  const lab = el('label', { text: labelText });
  const inp = el('input', { type: 'text', placeholder: placeholder || '' });
  inp.value = state[key] || '';
  return { lab, field: inp };
}

function textareaField(labelText, key, placeholder, rows) {
  const lab = el('label', { text: labelText });
  const ta = el('textarea', { placeholder: placeholder || '', rows: String(rows || 4) });
  ta.value = state[key] || '';
  return { lab, field: ta };
}

/* Build the setup form into `container`. Calls onChange() after each edit. */
export function renderSettings(container, onChange) {
  container.innerHTML = '';
  const fire = typeof onChange === 'function' ? onChange : () => {};

  const commit = (key, value) => {
    state[key] = value;
    saveJSONSoon('settings.json', state);
    fire();
  };

  container.appendChild(el('h3', { text: 'Story setup' }));

  const fields = [
    { ...selectField('Point of view', 'pov', POV_OPTS), key: 'pov', ev: 'change' },
    { ...selectField('Tense', 'tense', TENSE_OPTS), key: 'tense', ev: 'change' },
    { ...inputField('Genre', 'genre', 'e.g. Fantasy, Thriller, Literary'), key: 'genre', ev: 'input' },
    { ...inputField('Sub-genre', 'subgenre', 'e.g. Cozy mystery, Grimdark'), key: 'subgenre', ev: 'input' },
    { ...inputField('Voice inspiration', 'voice', 'e.g. Stephen King'), key: 'voice', ev: 'input' },
    { ...textareaField('Blurb', 'blurb', 'A one-paragraph pitch for the story…', 4), key: 'blurb', ev: 'input' },
    { ...textareaField('Outline / skeleton', 'outline', 'Beats, chapters, or a rough skeleton of where the story goes…', 7), key: 'outline', ev: 'input' },
  ];

  for (const f of fields) {
    container.appendChild(f.lab);
    container.appendChild(f.field);
    f.field.addEventListener(f.ev, () => commit(f.key, f.field.value));
  }

  return container;
}
