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
import { loadIndex } from './core.js';
import { setStop } from './llm.js';
import { loadSettings, getSettings, renderSettings } from './settings.js';
import { loadBible, ingestParagraph, renderBible } from './storybible.js';
import { seedKB } from './rag.js';
import { loadAgents, runRoom, renderAgentsUI } from './agents.js';
import { renderResearch } from './workflows.js';
import { initEditor } from './editor.js';

const $ = (s)=>document.querySelector(s);
const statusText=$('#statusText'), statusDot=$('#statusDot'), modelInfo=$('#modelInfo'), stopBtn=$('#stopBtn');
let busy=0;
export function setStatus(t, kind){ statusText.textContent=t; statusDot.className='dot'+(kind==='ok'?' on':kind==='err'?' err':''); }
export function pushBusy(t){ busy++; setStatus(t||'thinking…'); stopBtn.style.display='inline-block'; }
export function popBusy(){ if(--busy<=0){ busy=0; setStatus('ready','ok'); stopBtn.style.display='none'; } }
stopBtn.addEventListener('click', ()=>{ setStop(true); setTimeout(()=>setStop(false), 500); popBusy(); });

/* ---- on-Enter orchestration ------------------------------------------ */
// Called by the editor when a paragraph is finished. Runs the writers' room as a
// transform pipeline and returns { rewritten, changed, trail, continuity }.
async function onRoom(block, { priorTexts, fullDoc } = {}){
  pushBusy('the room is working…');
  const settings = getSettings();
  let res;
  try {
    res = await runRoom(block, { settings, priorTexts, fullDoc });
    ingestParagraph(block).catch(()=>{});   // grow the bible in the background
  } catch (e) {
    console.warn('runRoom failed', e);
    res = { rewritten: block, changed:false, trail:[], continuity:[], error:String((e&&e.message)||e) };
  } finally { popBusy(); }
  // popBusy reset the status to "ready"; if the room couldn't reach the model, say so (after).
  if (res && res.error){
    const m = /\b(404|403|5\d\d)\b/.test(res.error) ? `model endpoint unreachable (${res.error})` : res.error;
    setStatus('the room couldn’t reach the model — ' + m, 'err');
  }
  return res;
}

/* ---- top tabs (switch the centre column; the room stays put) ---------- */
function wireTabs(){
  document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click', ()=>{
    document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('#centerWrap .pane').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); $('#pane-'+b.dataset.tab).classList.add('active');
    if (b.dataset.tab==='story') renderBible($('#story-bible'));   // bible grows; refresh on view
  }));
}

/* ---- boot ------------------------------------------------------------- */
(async function boot(){
  try {
    setStatus('loading model config…');
    try { const c = await (await fetch('/config')).json(); modelInfo.textContent = `${c.provider} · ${c.model}`; } catch {}
    setStatus('warming memory…');
    await loadIndex();
    // Fast, OPFS-backed loads gate the UI; KB seeding (model download) runs in the
    // background so the editor + room are usable immediately. retrieve() returns []
    // until the index is warm.
    await Promise.all([ loadSettings(), loadBible(), loadAgents() ]);
    seedKB().catch(()=>{});

    wireTabs();
    renderAgentsUI($('#roomPane'), $('#pane-agents'));       // right column = the room; Agents tab = the library to drag from
    renderSettings($('#story-setup'), ()=>{});              // Story ▸ Setup: POV / tense / genre / voice / outline
    renderBible($('#story-bible'));                          // Story ▸ Bible: characters / locations / continuity
    renderResearch($('#pane-research'));                    // ultracode: deep research + brainstorm + fact-check

    initEditor({ page:$('#page'), title:$('#title'), suggestions:$('#suggestions') }, { onRoom });
    setStatus('ready','ok');
  } catch (e) {
    console.error(e); setStatus('boot failed: '+(e.message||e), 'err');
  }
})();
