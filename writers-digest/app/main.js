/* main.js — Writers Digest wiring.
 *
 * Boots the foundation (OPFS index, KB seed, settings, story bible, agents),
 * wires the editor + sidebar, and owns the on-Enter orchestration: when the
 * writer finishes a paragraph, run the grammar pass + the agent pipeline +
 * a continuity check against the story bible, and feed merged suggestions back
 * to the editor as keep/change cards. Story-bible ingestion runs in the
 * background so memory grows as the manuscript does.
 *
 * This file is the integration seam: the imports below are the contract the
 * feature modules satisfy.
 * ====================================================================== */
import { Z, loadIndex } from './core.js';
import { llmJSON, setStop } from './llm.js';
import { loadSettings, getSettings, renderSettings } from './settings.js';
import { loadBible, ingestParagraph, continuityCheck, renderBible } from './storybible.js';
import { seedKB } from './rag.js';
import { loadAgents, runPipeline, renderAgents } from './agents.js';
import { renderResearch } from './workflows.js';
import { initEditor } from './editor.js';

const $ = (s)=>document.querySelector(s);
const statusText=$('#statusText'), statusDot=$('#statusDot'), modelInfo=$('#modelInfo'), stopBtn=$('#stopBtn');
let busy=0;
export function setStatus(t, kind){ statusText.textContent=t; statusDot.className='dot'+(kind==='ok'?' on':kind==='err'?' err':''); }
export function pushBusy(t){ busy++; setStatus(t||'thinking…'); stopBtn.style.display='inline-block'; }
export function popBusy(){ if(--busy<=0){ busy=0; setStatus('ready','ok'); stopBtn.style.display='none'; } }
stopBtn.addEventListener('click', ()=>{ setStop(true); setTimeout(()=>setStop(false), 500); popBusy(); });

/* ---- grammar / spelling / line-edit pass ----------------------------- */
const GRAMMAR_SCHEMA = Z.object({ suggestions: Z.array(Z.object({
  original: Z.string().describe('exact substring from the paragraph to replace'),
  replacement: Z.string().describe('the corrected text'),
  reason: Z.string().describe('short reason (spelling/grammar/clarity)'),
})) });
async function grammarPass(text){
  if (text.trim().length < 4) return [];
  const out = await llmJSON(
    `Proofread this paragraph for spelling, grammar, and obvious clarity issues. Only flag real errors; do not rewrite style or voice. For each, give the exact original substring and its correction.\n\nParagraph:\n"""${text}"""`,
    GRAMMAR_SCHEMA,
    { system: 'You are a meticulous copy editor. Return only genuine corrections; if the paragraph is clean, return an empty list.' }
  );
  const sg = (out && out.suggestions) || [];
  return sg.filter(s=>s.original && text.includes(s.original) && s.original!==s.replacement)
    .map((s,i)=>({ id:'g'+Date.now()+i, agent:'Copy Editor', type:'replace', original:s.original, replacement:s.replacement, reason:s.reason||'correction' }));
}

/* ---- on-Enter orchestration ------------------------------------------ */
// Called by the editor when a paragraph (one or more sentences) is completed.
// Returns a flat list of suggestion objects {id,agent,type,original,replacement,reason}.
async function onParagraph(text, fullDoc){
  pushBusy('the room is reading…');
  const settings = getSettings();
  const ctx = { settings, fullDoc, paragraph:text };
  try {
    // grammar + agent pipeline run together; continuity checked against the bible.
    const [grammar, pipeline, continuity] = await Promise.all([
      grammarPass(text).catch(()=>[]),
      runPipeline(text, ctx).catch(()=>[]),
      continuityCheck(text).catch(()=>[]),
    ]);
    // ingest into the story bible in the background (don't block suggestions)
    ingestParagraph(text).catch(()=>{});
    return [...grammar, ...pipeline, ...continuity];
  } finally { popBusy(); }
}

/* ---- sidebar tabs ----------------------------------------------------- */
function wireTabs(){
  document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click', ()=>{
    document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); $('#pane-'+b.dataset.tab).classList.add('active');
    if (b.dataset.tab==='bible') renderBible($('#pane-bible'));
  }));
}

/* ---- boot ------------------------------------------------------------- */
(async function boot(){
  try {
    setStatus('loading model config…');
    try { const c = await (await fetch('/config')).json(); modelInfo.textContent = `${c.provider} · ${c.model}`; } catch {}
    setStatus('warming memory…');
    await loadIndex();
    await Promise.all([ loadSettings(), loadBible(), loadAgents(), seedKB() ]);

    wireTabs();
    renderAgents($('#pane-agents'), ()=>{});                // agent lineup (built-in + user-created, orderable, toggleable)
    renderSettings($('#pane-settings'), ()=>{});            // POV / tense / outline / blurb / genre
    renderBible($('#pane-bible'));                           // characters / locations / objects / continuity
    renderResearch($('#pane-research'));                    // ultracode: deep research + brainstorm + fact-check

    initEditor({ page:$('#page'), title:$('#title'), suggestions:$('#suggestions') }, { onParagraph });
    setStatus('ready','ok');
  } catch (e) {
    console.error(e); setStatus('boot failed: '+(e.message||e), 'err');
  }
})();
