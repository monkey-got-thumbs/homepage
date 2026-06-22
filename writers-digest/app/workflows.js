/* workflows.js — ultracode-style research & ideation features for Writers Digest.
 *
 * Exposes the Research panel: deep (fan-out) web research with cited synthesis,
 * grounded brainstorming (plot twists / character beats / titles), and a
 * fact-check that spawns a read-only research subagent.
 *
 * Everything is bounded: fan-out is capped, token budgets are small, and every
 * failure path renders gracefully into the panel instead of throwing.
 * ====================================================================== */
import { Z } from './core.js';
import { llmText, llmJSON, limitConcurrency, runAgent, TOOLS } from './llm.js';

/* settings.js / storybible.js are sibling feature modules that may or may not be
 * present yet. Import them lazily and degrade gracefully so the panel still works
 * (and so this module never fails to load). */
async function safeGetSettings(){
  try { const m = await import('./settings.js'); return (m.getSettings && m.getSettings()) || {}; }
  catch { return {}; }
}
async function safeBibleContext(query){
  try {
    const m = await import('./storybible.js');
    if (m.bibleContext) { const c = await m.bibleContext(query); return typeof c==='string'?c:JSON.stringify(c||''); }
    if (m.getBible) { const b = await m.getBible(); return b?JSON.stringify(b).slice(0,2000):''; }
  } catch {}
  return '';
}

/* ---- helpers --------------------------------------------------------- */
const proxify = (url)=> '/proxy?url='+encodeURIComponent(url);
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function parseSearch(html, max=5){
  const doc=new DOMParser().parseFromString(html,'text/html'); const out=[]; const seen=new Set();
  for(const a of doc.querySelectorAll('a.result__a, .result__title a, .web-result a, h2 a')){
    let href=a.getAttribute('href')||'';
    const m=href.match(/[?&]uddg=([^&]+)/); if(m){ try{ href=decodeURIComponent(m[1]); }catch{} } else if(href.startsWith('//')) href='https:'+href;
    if(!/^https?:/i.test(href)) continue; if(seen.has(href)) continue;
    const title=(a.textContent||'').trim().replace(/\s+/g,' ');
    if(!title) continue; seen.add(href); out.push({title,url:href});
    if(out.length>=max) break;
  }
  return out;
}
function htmlToText(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const title=(doc.querySelector('title')?.textContent||'').trim();
  const SKIP=new Set(['script','style','noscript','svg','head','nav','footer','header','form','button','iframe','aside']);
  const BLOCK=new Set(['p','div','li','ul','ol','h1','h2','h3','h4','h5','h6','br','tr','section','article','blockquote','pre','table']);
  const out=[]; (function walk(node){ for(const ch of node.childNodes){ if(ch.nodeType===3) out.push(ch.nodeValue);
    else if(ch.nodeType===1){ const tag=ch.tagName.toLowerCase(); if(SKIP.has(tag)) continue; walk(ch); if(BLOCK.has(tag)) out.push('\n'); } } })(doc.body||doc.documentElement);
  const text=out.join('').replace(/[ \t]+/g,' ').replace(/ ?\n ?/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  return {title, text};
}
async function webSearch(query, max=5){
  try{ const r=await fetch('/search?q='+encodeURIComponent(query)); return parseSearch(await r.text(), max); }catch{ return []; }
}
async function fetchReadable(url, cap=2200){
  try{ const r=await fetch(proxify(url)); const body=await r.text();
    const {text}= /<(!doctype|html)/i.test(body)? htmlToText(body) : {text:body};
    return (text||'').slice(0, cap);
  }catch{ return ''; }
}

/* ---- deep research --------------------------------------------------- */
// Fan out 3–5 sub-queries, fetch the top source per query (bounded), then
// synthesize a single cited summary. Returns {summary, sources:[{title,url}]}.
export async function deepResearch(topic, onEvent=()=>{}){
  topic = String(topic||'').trim();
  if(!topic) return { summary:'', sources:[] };

  onEvent({ phase:'plan', text:'planning sub-queries' });
  const planSchema = Z.object({ queries: Z.array(Z.string()).describe('3 to 5 focused web search queries') });
  let queries = [];
  const plan = await llmJSON(
    `Break this research topic into 3-5 focused, diverse web-search queries that together cover it well.\n\nTopic: ${topic}`,
    planSchema, { system:'You plan web research. Output only the JSON.', max_tokens:300 }
  ).catch(()=>null);
  if(plan && Array.isArray(plan.queries)) queries = plan.queries.filter(Boolean);
  if(!queries.length) queries = [topic];
  queries = queries.slice(0,5);

  onEvent({ phase:'search', text:`searching ${queries.length} queries` });
  // Fan out: one search + one fetch per query, capped concurrency.
  const findings = await limitConcurrency(3, queries.map(q => async () => {
    const hits = await webSearch(q, 3);
    if(!hits.length) return { q, source:null, text:'' };
    const top = hits[0];
    const text = await fetchReadable(top.url, 2000);
    onEvent({ phase:'source', text:top.title });
    return { q, source:top, text };
  }));

  // Collect unique sources and a bounded evidence blob.
  const sources=[]; const seen=new Set(); let evidence='';
  for(const f of findings){
    if(!f || f.error || !f.source) continue;
    if(!seen.has(f.source.url)){ seen.add(f.source.url); sources.push({ title:f.source.title, url:f.source.url }); }
    if(f.text) evidence += `\n\n[Source ${sources.length}] ${f.source.title} (${f.source.url})\n${f.text}`;
  }
  if(!sources.length) return { summary:'No web sources could be retrieved for this topic.', sources:[] };

  onEvent({ phase:'synthesize', text:'writing cited summary' });
  evidence = evidence.slice(0, 7000);
  const summary = await llmText(
    `Write a concise, well-organized research summary on "${topic}" using ONLY the sources below. Cite claims with bracketed numbers like [1], [2] matching the source order. Do not invent facts. End with no separate reference list.\n\nSOURCES:${evidence}`,
    { system:'You are a careful research analyst. Cite every non-obvious claim. Be concise.', decode:{ max_tokens:700, temperature:0.2 } }
  ).catch(e=>'Synthesis failed: '+(e.message||e));

  return { summary, sources };
}

/* ---- brainstorm ------------------------------------------------------ */
// kind: 'twists' | 'beats' | 'titles'. Returns string[] grounded in settings+bible.
export async function brainstorm(kind, n=6, ctx={}){
  n = Math.max(1, Math.min(12, n|0 || 6));
  const settings = await safeGetSettings();
  const bible = await safeBibleContext(ctx.query || kind);
  const labels = {
    twists:'plot twists that could escalate or subvert the story',
    beats:'character beats / moments of growth, conflict, or revelation',
    titles:'evocative title options for the story',
  };
  const want = labels[kind] || labels.twists;

  const ground = [
    settings.genre ? `Genre: ${settings.genre}` : '',
    settings.pov ? `POV: ${settings.pov}` : '',
    settings.tense ? `Tense: ${settings.tense}` : '',
    settings.blurb ? `Blurb: ${settings.blurb}` : '',
    settings.outline ? `Outline: ${String(settings.outline).slice(0,800)}` : '',
    bible ? `Story bible:\n${bible.slice(0,1200)}` : '',
    ctx.paragraph ? `Recent text:\n${String(ctx.paragraph).slice(0,800)}` : '',
  ].filter(Boolean).join('\n');

  const schema = Z.object({ ideas: Z.array(Z.string()).describe(`${n} ${want}`) });
  const out = await llmJSON(
    `Generate ${n} ${want}, grounded in the story context below. Each idea: one or two punchy sentences, specific to this story (use the names/world given). No numbering, no preamble.\n\nCONTEXT:\n${ground||'(no context yet — invent something fitting a literary work)'}`,
    schema, { system:'You are an inventive but disciplined story editor. Output only the JSON.', max_tokens:800 }
  ).catch(()=>null);

  const ideas = (out && Array.isArray(out.ideas)) ? out.ideas.filter(s=>s && String(s).trim()) : [];
  return ideas.slice(0, n);
}

/* ---- fact-check ------------------------------------------------------ */
// Spawn a read-only research subagent to verify a claim; return a short verdict.
export async function factCheck(claim){
  claim = String(claim||'').trim();
  if(!claim) return 'Enter a claim to fact-check.';
  const readOnly = TOOLS.filter(t => t.isReadOnly({}) && t.name!=='spawn_agent');
  const task = `Verify this factual claim by searching the web and reading sources. Then give a one-paragraph verdict: TRUE, FALSE, PARTLY TRUE, or UNVERIFIABLE, with the key evidence and 1-2 source URLs.\n\nClaim: "${claim}"`;
  let verdict='', err='';
  try {
    for await (const ev of runAgent(task, [], {
      tools: readOnly,
      role: 'You are a rigorous fact-checking subagent. Be skeptical and cite sources.',
      maxTurns: 8, maxTools: 6,
      answerInstruction: 'Give a one-paragraph verdict starting with TRUE / FALSE / PARTLY TRUE / UNVERIFIABLE, then the evidence and source URL(s).',
      answerTokens: 400,
    })) {
      if(ev.type==='final') verdict=ev.text;
      else if(ev.type==='error') err=ev.error;
    }
  } catch(e){ err=String(e.message||e); }
  return verdict || ('Fact-check failed: '+(err||'no verdict produced'));
}

/* ---- UI -------------------------------------------------------------- */
export function renderResearch(container){
  container.innerHTML='';
  const h=document.createElement('h3'); h.textContent='Research & ideas'; container.appendChild(h);

  const lbl=document.createElement('label'); lbl.textContent='Topic, idea seed, or claim';
  const input=document.createElement('textarea'); input.rows=2;
  input.placeholder='e.g. medieval siege warfare · "the Eiffel Tower opened in 1889" · twist seed…';
  container.appendChild(lbl); container.appendChild(input);

  const bar=document.createElement('div'); bar.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  const mkBtn=(text)=>{ const b=document.createElement('button'); b.className='btn sm'; b.textContent=text; return b; };
  const bResearch=mkBtn('Deep research');
  const bTwists=mkBtn('Brainstorm plot twists');
  const bTitles=mkBtn('Brainstorm titles');
  const bFact=mkBtn('Fact-check');
  [bResearch,bTwists,bTitles,bFact].forEach(b=>bar.appendChild(b));
  container.appendChild(bar);

  const status=document.createElement('div'); status.className='muted'; status.style.margin='8px 0'; container.appendChild(status);
  const results=document.createElement('div'); container.appendChild(results);

  let running=false;
  function setRunning(on, msg){
    running=on;
    [bResearch,bTwists,bTitles,bFact].forEach(b=>b.disabled=on);
    status.innerHTML = on ? `<span class="spin"></span> ${esc(msg||'working…')}` : '';
  }
  function setStatusText(msg){ if(running) status.innerHTML=`<span class="spin"></span> ${esc(msg)}`; }

  function card(){ const c=document.createElement('div'); c.className='card'; results.insertBefore(c, results.firstChild); return c; }
  function addCopy(parent, getText, label='Copy'){
    const b=document.createElement('button'); b.className='btn sm'; b.textContent=label; b.style.marginTop='8px';
    b.addEventListener('click', async()=>{
      try{ await navigator.clipboard.writeText(getText()); const o=b.textContent; b.textContent='Copied'; setTimeout(()=>b.textContent=o,1200); }
      catch{ b.textContent='Copy failed'; setTimeout(()=>b.textContent=label,1200); }
    });
    parent.appendChild(b);
  }
  function errorCard(title, msg){
    const c=card();
    c.innerHTML=`<div class="row"><span class="name">${esc(title)}</span><span class="kind">error</span></div><div class="desc">${esc(msg)}</div>`;
  }

  async function guard(fn){ if(running) return; try{ await fn(); }catch(e){ setRunning(false); errorCard('Unexpected error', String(e.message||e)); } }

  // Deep research
  bResearch.addEventListener('click', ()=>guard(async()=>{
    const topic=input.value.trim(); if(!topic){ status.textContent='Enter a topic first.'; return; }
    setRunning(true,'planning…');
    let res;
    try { res = await deepResearch(topic, ev=>setStatusText(ev.text||ev.phase)); }
    catch(e){ setRunning(false); errorCard('Deep research failed', String(e.message||e)); return; }
    setRunning(false);
    const c=card();
    const head=document.createElement('div'); head.className='row';
    head.innerHTML=`<span class="name">Research: ${esc(topic).slice(0,48)}</span><span class="kind">cited</span>`;
    c.appendChild(head);
    const body=document.createElement('div'); body.className='desc'; body.style.whiteSpace='pre-wrap'; body.style.color='var(--panelink)';
    body.textContent=res.summary||'(no summary)'; c.appendChild(body);
    if(res.sources && res.sources.length){
      const src=document.createElement('div'); src.style.marginTop='6px';
      res.sources.forEach((s,i)=>{
        const a=document.createElement('a'); a.className='pill'; a.href=s.url; a.target='_blank'; a.rel='noopener';
        a.textContent=`[${i+1}] ${(s.title||s.url).slice(0,40)}`; src.appendChild(a);
      });
      c.appendChild(src);
    }
    addCopy(c, ()=> res.summary + (res.sources?.length? '\n\nSources:\n'+res.sources.map((s,i)=>`[${i+1}] ${s.title} — ${s.url}`).join('\n') : ''));
  }));

  // Brainstorm helper
  async function doBrainstorm(kind, title){
    const ctx={ query: input.value.trim(), paragraph: input.value.trim() };
    setRunning(true,'brainstorming…');
    let ideas;
    try{ ideas=await brainstorm(kind, 6, ctx); }
    catch(e){ setRunning(false); errorCard(title+' failed', String(e.message||e)); return; }
    setRunning(false);
    if(!ideas || !ideas.length){ errorCard(title, 'No ideas were generated. Try adding more story context in Setup or the Story Bible.'); return; }
    const c=card();
    c.innerHTML=`<div class="row"><span class="name">${esc(title)}</span><span class="kind">${ideas.length} ideas</span></div>`;
    const ol=document.createElement('ol'); ol.style.cssText='margin:8px 0 0;padding-left:20px';
    ideas.forEach(it=>{ const li=document.createElement('li'); li.style.margin='0 0 6px'; li.textContent=it; ol.appendChild(li); });
    c.appendChild(ol);
    addCopy(c, ()=> ideas.map((it,i)=>`${i+1}. ${it}`).join('\n'));
  }
  bTwists.addEventListener('click', ()=>guard(()=>doBrainstorm('twists','Plot twists')));
  bTitles.addEventListener('click', ()=>guard(()=>doBrainstorm('titles','Title ideas')));

  // Fact-check
  bFact.addEventListener('click', ()=>guard(async()=>{
    const claim=input.value.trim(); if(!claim){ status.textContent='Enter a claim to check.'; return; }
    setRunning(true,'fact-checking (this may take a moment)…');
    let verdict;
    try{ verdict=await factCheck(claim); }
    catch(e){ setRunning(false); errorCard('Fact-check failed', String(e.message||e)); return; }
    setRunning(false);
    const c=card();
    c.innerHTML=`<div class="row"><span class="name">Fact-check</span><span class="kind">verdict</span></div><div class="desc" style="font-style:italic">${esc(claim).slice(0,160)}</div>`;
    const body=document.createElement('div'); body.style.cssText='white-space:pre-wrap;margin-top:6px;color:var(--panelink)';
    body.textContent=verdict; c.appendChild(body);
    addCopy(c, ()=>'Claim: '+claim+'\n\n'+verdict);
  }));
}
