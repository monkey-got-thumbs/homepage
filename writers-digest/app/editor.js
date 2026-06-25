/* editor.js — Writers Digest Word-like editor.
 *
 * A contenteditable "page" of <p> paragraphs, persisted to OPFS. On Enter, the
 * paragraph you just finished is sent to the writers' room (hooks.onRoom). The
 * room returns a REWRITTEN version (the chain of agents) plus continuity issues.
 * We AUTO-APPLY the rewrite in place and drop a quiet ⟲ marker that reverts to
 * your words; continuity issues become accept/reject cards that edit the prior
 * paragraphs they reference.
 *
 * EXPORT: initEditor({ page, title, suggestions }, hooks)
 *   hooks = { onRoom(blockText, { priorTexts, fullDoc }) -> Promise<{
 *              rewritten, changed, trail:[{agent,kind}], continuity:[{offset,original,replacement,reason}]
 *            }> }
 * ====================================================================== */
import { loadJSON, saveJSONSoon } from './core.js';

const MAX_CARDS = 6;
const MIN_WORDS = 3;

/* ---- helpers ---------------------------------------------------------- */
function wordCount(s){ return (String(s||'').trim().match(/\S+/g) || []).length; }
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Plain text of a paragraph, excluding any injected ⟲ marker.
function paraText(node){
  if (!node) return '';
  let t = '';
  for (const ch of node.childNodes){
    if (ch.nodeType === 1 && ch.classList && ch.classList.contains('room-mark')) continue;
    t += ch.textContent || '';
  }
  return t;
}

function closestParagraph(node, page){
  let n = node;
  while (n && n !== page){
    if (n.nodeType === 1 && n.tagName === 'P' && n.parentNode === page) return n;
    n = n.parentNode;
  }
  return null;
}
function caretParagraph(page){
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  return closestParagraph(sel.anchorNode, page);
}

function normalizeParagraphs(page){
  if (!page.querySelector('p')){
    const txt = page.textContent || '';
    page.innerHTML = '';
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(txt));
    page.appendChild(p);
    return;
  }
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

/* ---- editor ----------------------------------------------------------- */
export function initEditor({ page, title, suggestions }, hooks = {}){
  const onRoom = hooks.onRoom || (async ()=>null);
  const inFlight = new WeakSet();
  const edited = new WeakMap();          // <p> → { original, rewritten, trail }

  /* ---- persistence (markers stripped from the saved HTML) ------------- */
  function persist(){
    const clone = page.cloneNode(true);
    clone.querySelectorAll('.room-mark').forEach(m => m.remove());
    saveJSONSoon('manuscript.json', { title: title.value, html: clone.innerHTML });
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

  /* ---- on-Enter: send the finished paragraph to the room -------------- */
  page.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const leaving = caretParagraph(page);
    if (!leaving) return;
    const text = paraText(leaving).trim();

    // snapshot the paragraphs that come BEFORE this one (for continuity radius)
    const paras = Array.from(page.querySelectorAll(':scope > p'));
    const idx = paras.indexOf(leaving);
    const priorNodes = idx > 0 ? paras.slice(0, idx) : [];

    setTimeout(() => {
      try { normalizeParagraphs(page); } catch {}
      if (!text || wordCount(text) < MIN_WORDS) return;
      if (inFlight.has(leaving)) return;
      fireRoom(leaving, text, priorNodes);
    }, 0);
  });

  async function fireRoom(node, text, priorNodes){
    if (inFlight.has(node)) return;
    inFlight.add(node);
    try {
      const priorTexts = priorNodes.map(n => paraText(n).trim());
      const res = await onRoom(text, { priorTexts, fullDoc: page.innerText });
      if (!res) return;

      // auto-apply the room's rewrite of THIS block
      if (res.changed && res.rewritten && node.isConnected){
        applyRoomEdit(node, text, res.rewritten, res.trail || []);
      }
      // continuity issues edit PRIOR paragraphs (offset 1 = immediately before)
      const cont = Array.isArray(res.continuity) ? res.continuity : [];
      for (const c of cont){
        const target = priorNodes[priorNodes.length - c.offset];
        if (target && target.isConnected) renderContinuityCard(c, target);
      }
    } catch (err) {
      console.warn('room failed', err);
    } finally {
      inFlight.delete(node);
    }
  }

  /* ---- auto-apply + quiet undo --------------------------------------- */
  function applyRoomEdit(node, original, rewritten, trail){
    node.querySelectorAll('.room-mark').forEach(m => m.remove());
    node.textContent = rewritten;
    const mark = document.createElement('span');
    mark.className = 'room-mark';
    mark.setAttribute('contenteditable', 'false');
    mark.textContent = ' ⟲';
    mark.title = 'Edited by your writers’ room — click to review or undo';
    node.appendChild(mark);
    edited.set(node, { original, rewritten, trail });
    mark.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openRoomPopover(node, mark); });
    persist();
  }

  function openRoomPopover(node, mark){
    closeRoomPopover();
    const info = edited.get(node);
    if (!info) return;
    const pop = document.createElement('div');
    pop.className = 'room-pop';
    pop.id = 'roomPop';

    const trail = document.createElement('div');
    trail.className = 'rp-trail';
    trail.textContent = info.trail && info.trail.length
      ? 'Reshaped by ' + info.trail.map(t => t.agent).join(' · ')
      : 'Lightly cleaned up';
    pop.appendChild(trail);

    const orig = document.createElement('div');
    orig.className = 'rp-orig';
    orig.textContent = info.original;
    pop.appendChild(orig);

    const acts = document.createElement('div');
    acts.className = 'rp-acts';
    const revert = document.createElement('button');
    revert.className = 'change';
    revert.textContent = 'Revert to my words';
    revert.addEventListener('click', () => {
      node.querySelectorAll('.room-mark').forEach(m => m.remove());
      node.textContent = info.original;
      edited.delete(node);
      closeRoomPopover();
      persist();
    });
    const keep = document.createElement('button');
    keep.className = 'keep';
    keep.textContent = 'Keep it';
    keep.addEventListener('click', closeRoomPopover);
    acts.appendChild(revert);
    acts.appendChild(keep);
    pop.appendChild(acts);

    document.body.appendChild(pop);
    const r = mark.getBoundingClientRect();
    pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
    pop.style.left = Math.max(8, Math.min(window.scrollX + r.left - 8, window.innerWidth - 320)) + 'px';

    const outside = (ev) => { if (!pop.contains(ev.target) && ev.target !== mark){ closeRoomPopover(); } };
    pop._outside = outside;
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
  }
  function closeRoomPopover(){
    const p = document.getElementById('roomPop');
    if (p){ if (p._outside) document.removeEventListener('mousedown', p._outside); p.remove(); }
  }

  /* ---- continuity cards (edit a PRIOR paragraph) --------------------- */
  function trimCards(){
    while (suggestions.children.length > MAX_CARDS) suggestions.removeChild(suggestions.firstChild);
  }
  function removeCard(card){ if (card && card.parentNode) card.parentNode.removeChild(card); }

  function renderContinuityCard(c, targetNode){
    if (!c || !c.original || !c.replacement) return;
    const card = document.createElement('div');
    card.className = 'sugg cont';

    const agent = document.createElement('div');
    agent.className = 'agent';
    agent.textContent = 'Continuity · ¶ ' + c.offset + ' back';
    card.appendChild(agent);

    const reason = document.createElement('div');
    reason.className = 'reason';
    reason.textContent = c.reason || 'keeps the story consistent';
    card.appendChild(reason);

    const repl = document.createElement('div');
    repl.className = 'repl';
    repl.innerHTML = '<span class="cont-was">' + escapeHtml(c.original) + '</span> → ' + escapeHtml(c.replacement);
    card.appendChild(repl);

    const acts = document.createElement('div');
    acts.className = 'acts';
    const apply = document.createElement('button');
    apply.className = 'change';
    apply.textContent = 'Apply';
    apply.addEventListener('click', () => {
      const cur = paraText(targetNode);
      if (targetNode.isConnected && cur.includes(c.original)){
        const mark = targetNode.querySelector('.room-mark');
        targetNode.textContent = cur.replace(c.original, c.replacement);
        if (mark) targetNode.appendChild(mark);     // preserve any existing marker glyph
        flash(targetNode);
        persist();
      }
      removeCard(card);
    });
    const ignore = document.createElement('button');
    ignore.className = 'keep';
    ignore.textContent = 'Ignore';
    ignore.addEventListener('click', () => removeCard(card));
    acts.appendChild(apply);
    acts.appendChild(ignore);
    card.appendChild(acts);

    suggestions.appendChild(card);
    trimCards();
  }

  function flash(node){
    try {
      node.style.transition = 'background .25s ease';
      node.style.background = 'rgba(194,135,43,.28)';
      setTimeout(() => { node.style.background = ''; }, 600);
    } catch {}
  }

  return {
    persist,
    clearSuggestions(){ suggestions.innerHTML = ''; },
  };
}
