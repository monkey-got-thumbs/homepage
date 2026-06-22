/* editor.js — Writers Digest Word-like editor.
 *
 * A contenteditable "page" of <p> paragraphs, persisted to OPFS, with on-Enter
 * orchestration: when the writer finishes a paragraph and presses Enter, the
 * harness (via hooks.onParagraph) returns suggestion objects which we render as
 * keep/change cards anchored beside the page. Self-contained; nothing imports
 * this module except main.js which calls initEditor().
 *
 * EXPORT: initEditor({ page, title, suggestions }, hooks)
 *   hooks = { onParagraph(text, fullDoc) -> Promise<suggestion[]> }
 *
 * Suggestion shape:
 *   { id, agent, type:'replace'|'note'|'insert', original?, replacement?, reason }
 * ====================================================================== */
import { loadJSON, saveJSONSoon } from './core.js';

const MAX_CARDS = 6;
const MIN_WORDS = 3;

/* ---- helpers ---------------------------------------------------------- */
function wordCount(s){ return (String(s||'').trim().match(/\S+/g) || []).length; }

// Walk up from a node to the closest <p> child of `page` (the block being edited).
function closestParagraph(node, page){
  let n = node;
  while (n && n !== page){
    if (n.nodeType === 1 && n.tagName === 'P' && n.parentNode === page) return n;
    n = n.parentNode;
  }
  return null;
}

// The <p> the caret is currently inside.
function caretParagraph(page){
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  return closestParagraph(sel.anchorNode, page);
}

// Ensure the page is made of <p> blocks; wrap any stray text/inline nodes.
function normalizeParagraphs(page){
  if (!page.querySelector('p')){
    const txt = page.textContent || '';
    page.innerHTML = '';
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(txt));
    page.appendChild(p);
    return;
  }
  // wrap any direct non-<p> nodes into paragraphs
  const stray = [];
  for (const child of Array.from(page.childNodes)){
    if (child.nodeType === 1 && child.tagName === 'P') continue;
    if (child.nodeType === 3 && !child.textContent.trim()) { child.remove(); continue; }
    stray.push(child);
  }
  for (const node of stray){
    const p = document.createElement('p');
    page.insertBefore(p, node);
    p.appendChild(node);
  }
}

function placeCaretAtEnd(node){
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ---- editor ----------------------------------------------------------- */
export function initEditor({ page, title, suggestions }, hooks = {}){
  const onParagraph = hooks.onParagraph || (async ()=>[]);

  // nodes currently mid-flight (avoid re-entrant fires for the same <p>)
  const inFlight = new WeakSet();

  /* ---- persistence ---------------------------------------------------- */
  function persist(){
    saveJSONSoon('manuscript.json', { title: title.value, html: page.innerHTML });
  }

  (async function restore(){
    try {
      const doc = await loadJSON('manuscript.json', { title:'', html:'' });
      if (doc && typeof doc.title === 'string') title.value = doc.title;
      if (doc && doc.html && doc.html.trim()) page.innerHTML = doc.html;
    } catch {}
    normalizeParagraphs(page);
  })();

  page.addEventListener('input', () => { normalizeOnIdle(); persist(); });
  title.addEventListener('input', persist);

  let normTimer = null;
  function normalizeOnIdle(){
    clearTimeout(normTimer);
    normTimer = setTimeout(()=>{ try { normalizeParagraphs(page); } catch {} }, 600);
  }

  /* ---- on-Enter detection -------------------------------------------- */
  page.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;

    // The paragraph the caret is leaving.
    const leaving = caretParagraph(page);
    if (!leaving) return;
    const text = (leaving.innerText || leaving.textContent || '').trim();

    // Let the browser create the new block, then maybe fire.
    setTimeout(() => {
      try { normalizeParagraphs(page); } catch {}
      if (!text || wordCount(text) < MIN_WORDS) return;
      if (inFlight.has(leaving)) return;
      fireParagraph(leaving, text);
    }, 0);
  });

  async function fireParagraph(node, text){
    if (inFlight.has(node)) return;
    inFlight.add(node);
    try {
      const list = await onParagraph(text, page.innerText);
      if (Array.isArray(list) && list.length){
        for (const s of list) renderSuggestion(s, node);
      }
    } catch (err) {
      console.warn('onParagraph failed', err);
    } finally {
      inFlight.delete(node);
    }
  }

  /* ---- suggestion cards ---------------------------------------------- */
  function trimCards(){
    while (suggestions.children.length > MAX_CARDS){
      suggestions.removeChild(suggestions.firstChild);
    }
  }

  function applyReplace(node, original, replacement){
    if (!node || !node.isConnected) return false;
    const cur = node.innerText || node.textContent || '';
    if (original && cur.includes(original)){
      const next = cur.replace(original, replacement);
      node.textContent = next;
      return true;
    }
    // fallback: if original no longer matches, replace whole paragraph
    if (replacement){ node.textContent = replacement; return true; }
    return false;
  }

  function applyInsert(node, replacement){
    if (!node || !node.isConnected) return false;
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(replacement || ''));
    if (node.nextSibling) node.parentNode.insertBefore(p, node.nextSibling);
    else node.parentNode.appendChild(p);
    return true;
  }

  function renderSuggestion(s, node){
    if (!s || !s.reason && !s.replacement) return;
    const card = document.createElement('div');
    card.className = 'sugg';

    const agent = document.createElement('div');
    agent.className = 'agent';
    agent.textContent = s.agent || 'Writers Room';
    card.appendChild(agent);

    const reason = document.createElement('div');
    reason.className = 'reason';
    reason.textContent = s.reason || '';
    card.appendChild(reason);

    const type = s.type || 'note';

    if ((type === 'replace' || type === 'insert') && s.replacement){
      const repl = document.createElement('div');
      repl.className = 'repl';
      repl.textContent = s.replacement;
      card.appendChild(repl);

      const acts = document.createElement('div');
      acts.className = 'acts';

      const keep = document.createElement('button');
      keep.className = 'keep';
      keep.textContent = 'Keep';
      keep.addEventListener('click', () => removeCard(card));

      const change = document.createElement('button');
      change.className = 'change';
      change.textContent = 'Change';
      change.addEventListener('click', () => {
        let ok = false;
        if (type === 'replace') ok = applyReplace(node, s.original, s.replacement);
        else ok = applyInsert(node, s.replacement);
        if (ok) persist();
        removeCard(card);
      });

      acts.appendChild(keep);
      acts.appendChild(change);
      card.appendChild(acts);
    } else {
      // note: advisory only
      const acts = document.createElement('div');
      acts.className = 'acts';
      const got = document.createElement('button');
      got.className = 'keep';
      got.textContent = 'Got it';
      got.addEventListener('click', () => removeCard(card));
      acts.appendChild(got);
      card.appendChild(acts);
    }

    suggestions.appendChild(card);
    trimCards();
  }

  function removeCard(card){
    if (card && card.parentNode) card.parentNode.removeChild(card);
  }

  return {
    persist,
    clearSuggestions(){ suggestions.innerHTML = ''; },
  };
}
