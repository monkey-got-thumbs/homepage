/* llm.js — the LLM brain for Writers Digest.
 *
 * Talks to the backend /llm proxy (provider-agnostic, normalized SSE), and
 * re-implements the Browser Agent's constrained-decode envelope + agentic loop
 * against that transport. Also exposes a base tool set (workspace + web +
 * retrieve + spawn_agent) that feature modules extend via registerTool().
 *
 * Key exports:
 *   streamLLM({messages, system, schema, max_tokens, temperature, onToken})
 *   llmJSON(prompt, schema, {system})   → validated object (one-shot structured)
 *   llmText(prompt, {system, decode})    → plain string
 *   registerTool(def) / TOOLS            → tool registry for the agent loop
 *   runAgent(task, history, opts)        → async generator of events
 *   limitConcurrency(n, thunks)          → fan-out helper for ultracode workflows
 * ====================================================================== */
import { Z, retrieve, readFileText, writeFileText, walkWorkspace, listDir, swapOut, swapIn, indexContent, slugify, estTokens } from './core.js';

/* ---- transport: normalized SSE from /llm ----------------------------- */
let STOP = false;
export function setStop(v){ STOP = v; }
export function isStopped(){ return STOP; }

// Endpoint: local dev = '/llm' (server.js SSE proxy); deployed = window.WD_LLM_ENDPOINT
// (e.g. '/api/wd' — a same-origin Lambda that returns plain JSON {text}). Both supported.
const LLM_ENDPOINT = (typeof globalThis !== 'undefined' && globalThis.WD_LLM_ENDPOINT) || '/llm';
export async function streamLLM({ messages, system, schema, max_tokens=1536, temperature=0, onToken }) {
  const res = await fetch(LLM_ENDPOINT, { method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ messages, system, schema, max_tokens, temperature }) });
  if (!res.ok) throw new Error('llm request failed: ' + res.status);
  // Non-streaming backend (deployed Lambda): a single JSON body, not SSE.
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (!res.body || !ctype.includes('event-stream')) {
    let o; try { o = await res.json(); } catch { o = {}; }
    if (o.error) throw new Error(o.error);
    const text = o.text ?? o.delta ?? (o.choices && o.choices[0] && (o.choices[0].message?.content || o.choices[0].text)) ?? '';
    if (text && onToken) onToken(text);
    return { text: String(text), finish: o.finish || 'stop' };
  }
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf='', full='', finish=null, err=null;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream:true });
    let nl; while ((nl = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl+2);
      if (!line.startsWith('data:')) continue;
      let o; try { o = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (o.error) { err = o.error; }
      if (o.delta) { full += o.delta; onToken && onToken(o.delta); }
      if (o.done && o.finish) finish = o.finish;
    }
    if (STOP) { try{ reader.cancel(); }catch{} break; }
  }
  if (err && !full) throw new Error(err);
  return { text: full, finish: finish || (STOP?'stop':'stop') };
}

export async function llmText(prompt, { system, decode } = {}) {
  const { text } = await streamLLM({ messages:[{role:'user',content:prompt}], system,
    temperature: decode?.temperature ?? 0.3, max_tokens: decode?.max_tokens ?? 1024 });
  return text.trim();
}

function extractJSON(raw){ let t=String(raw||'').trim();
  try{ return JSON.parse(t); }catch{}
  const start=t.indexOf('{'); if(start<0){ const a=t.indexOf('['); if(a<0) return null; }
  let s=Math.min(...['{','['].map(c=>{const i=t.indexOf(c);return i<0?1e9:i;})); if(s===1e9) return null;
  const open=t[s], close=open==='{'?'}':']'; let depth=0,inStr=false,esc=false;
  for(let i=s;i<t.length;i++){ const c=t[i];
    if(inStr){ if(esc)esc=false; else if(c==='\\')esc=true; else if(c==='"')inStr=false; }
    else { if(c==='"')inStr=true; else if(c===open)depth++; else if(c===close){ depth--; if(depth===0){ try{ return JSON.parse(t.slice(s,i+1)); }catch{ return null; } } } } }
  return null; }

// One-shot structured output validated against a Z schema (retries once on miss).
export async function llmJSON(prompt, zschema, { system, max_tokens=1200 } = {}) {
  const json = zschema.toJSONSchema();
  for (let attempt=0; attempt<2; attempt++) {
    const { text } = await streamLLM({ messages:[{role:'user',content:prompt}], system,
      schema: json, max_tokens, temperature:0 });
    const obj = extractJSON(text); if (obj){ const r=zschema.safeParse(obj); if (r.ok) return r.value; }
    prompt = prompt + '\n\nReturn ONLY a valid JSON object matching the schema. No prose.';
  }
  return null;
}

/* ---- concurrency limiter (ultracode fan-out) ------------------------- */
export async function limitConcurrency(n, thunks){ const out=new Array(thunks.length); let i=0;
  async function worker(){ while(i<thunks.length){ const idx=i++; try{ out[idx]=await thunks[idx](); }catch(e){ out[idx]={error:String(e.message||e)}; } } }
  await Promise.all(Array.from({length:Math.min(n,thunks.length)}, worker)); return out; }

/* ---- tools ----------------------------------------------------------- */
function defineTool(def){ return { name:def.name, description:def.description||'', inputSchema:def.inputSchema||Z.object({}),
  isReadOnly:def.isReadOnly||(()=>false), maxResultSizeChars:def.maxResultSizeChars??8000, call:def.call }; }
export const TOOLS = [];
const toolByName = {};
export function registerTool(def){ const t=defineTool(def); TOOLS.push(t); toolByName[t.name]=t; return t; }

const proxify = (url)=> '/proxy?url='+encodeURIComponent(url);
function htmlToText(html){ const doc=new DOMParser().parseFromString(html,'text/html');
  const title=(doc.querySelector('title')?.textContent||'').trim();
  const SKIP=new Set(['script','style','noscript','svg','head','nav','footer','header','form','button','iframe','aside']);
  const BLOCK=new Set(['p','div','li','ul','ol','h1','h2','h3','h4','h5','h6','br','tr','section','article','blockquote','pre','table']);
  const out=[]; (function walk(node){ for(const ch of node.childNodes){ if(ch.nodeType===3) out.push(ch.nodeValue);
    else if(ch.nodeType===1){ const tag=ch.tagName.toLowerCase(); if(SKIP.has(tag)) continue; walk(ch); if(BLOCK.has(tag)) out.push('\n'); } } })(doc.body||doc.documentElement);
  return {title, text:out.join('').replace(/[ \t]+/g,' ').replace(/ ?\n ?/g,'\n').replace(/\n{3,}/g,'\n\n').trim()}; }
function parseDDG(html, max=6){ const doc=new DOMParser().parseFromString(html,'text/html'); const out=[];
  for(const a of doc.querySelectorAll('a.result__a, .result__title a, .web-result a, h2 a')){ let href=a.getAttribute('href')||'';
    const m=href.match(/[?&]uddg=([^&]+)/); if(m){ try{ href=decodeURIComponent(m[1]); }catch{} } else if(href.startsWith('//')) href='https:'+href;
    if(!/^https?:/i.test(href)) continue; const title=(a.textContent||'').trim();
    const box=a.closest('.result, .web-result, .results_links')||a.parentElement;
    const snippet=((box&&box.querySelector?.('.result__snippet')?.textContent)||'').trim().replace(/\s+/g,' ').slice(0,220);
    if(title) out.push({title,url:href,snippet}); if(out.length>=max) break; } return out; }

// Base tools — workspace + web + retrieve. spawn_agent is registered after runAgent is defined.
registerTool({ name:'list_workspace', description:'List every file/dir path in the workspace.', isReadOnly:()=>true,
  call: async ()=>{ const p=await walkWorkspace(); return p.length?p.join('\n'):'(empty)'; } });
registerTool({ name:'read_file', description:'Read a text file from the workspace (numbered lines).', isReadOnly:()=>true, maxResultSizeChars:12000,
  inputSchema:Z.object({ path:Z.string(), offset:Z.integer().optional(), limit:Z.integer().optional() }),
  call: async ({path,offset=1,limit=600})=>{ let t; try{ t=await readFileText(path); }catch(e){ return {error:`cannot read ${path}: ${e.message}`}; }
    const lines=t.split('\n'); const start=Math.max(0,offset-1); const slice=lines.slice(start,start+limit);
    return slice.map((l,i)=>`${String(start+i+1).padStart(5)}\t${l}`).join('\n')+(start+limit<lines.length?`\n… (${lines.length-(start+limit)} more)`:''); } });
registerTool({ name:'write_file', description:'Create or overwrite a workspace text file.', maxResultSizeChars:2000,
  inputSchema:Z.object({ path:Z.string(), content:Z.string() }),
  call: async ({path,content})=>{ try{ const {bytes}=await writeFileText(path,content); if(!path.startsWith('.')) indexContent('file:'+path,path,content); return `wrote ${path} (${bytes}b)`; }catch(e){ return {error:`cannot write ${path}: ${e.message}`}; } } });
registerTool({ name:'web_search', description:'Search the web (DuckDuckGo): returns title/url/snippet.', isReadOnly:()=>true, maxResultSizeChars:6000,
  inputSchema:Z.object({ query:Z.string(), max:Z.integer().default(6) }),
  call: async ({query,max=6})=>{ try{ const r=await fetch('/search?q='+encodeURIComponent(query)); const html=await r.text();
    const res=parseDDG(html,max); return res.length?res:'(no results)'; }catch(e){ return {error:'search failed: '+e.message}; } } });
registerTool({ name:'fetch_url', description:'GET a URL and return readable text (HTML stripped).', isReadOnly:()=>true, maxResultSizeChars:10000,
  inputSchema:Z.object({ url:Z.string() }),
  call: async ({url})=>{ let body; try{ const r=await fetch(proxify(url)); body=await r.text(); }catch(e){ return {error:'fetch failed: '+e.message}; }
    const {title,text}= /<(!doctype|html)/i.test(body)? htmlToText(body) : {title:'',text:body};
    const full=`# ${title||url}\n${text}`; if(full.length>3000){ const p='sources/'+slugify(url)+'.txt'; try{ await writeFileText(p,full); indexContent('file:'+p,url,full); }catch{}
      return `Saved to ${p} (${full.length} chars). retrieve() or read_file('${p}') to read. Preview:\n${text.slice(0,1000)}`; } return full; } });
registerTool({ name:'retrieve', description:'Semantic search over indexed content (sources, KB advice, story bible).', isReadOnly:()=>true, maxResultSizeChars:6000,
  inputSchema:Z.object({ query:Z.string(), k:Z.integer().default(4) }),
  call: async ({query,k=4})=>{ const r=await retrieve(query,k); return r.length?r.map(x=>`[${x.score}] (${x.source})\n${x.text.slice(0,500)}`).join('\n\n'):'(no matches)'; } });
registerTool({ name:'page_in', description:'Read a swapped-out result by swap:// handle (paginated).', isReadOnly:()=>true,
  inputSchema:Z.object({ handle:Z.string(), offset:Z.integer().default(0), limit:Z.integer().default(4000) }),
  call: async ({handle,offset,limit})=>{ try{ return await swapIn(handle,offset,limit); }catch(e){ return {error:e.message}; } } });

/* ---- constrained-decode envelope ------------------------------------- */
function buildEnvelopeSchema(tools){ const branches=tools.map(t=>({ type:'object',
  properties:{kind:{const:'tool'},name:{const:t.name},input:t.inputSchema.toJSONSchema()}, required:['kind','name','input'], additionalProperties:false }));
  return { type:'object', properties:{ thought:{type:'string',maxLength:240},
    action:{ oneOf:[ {type:'object',properties:{kind:{const:'final'}},required:['kind'],additionalProperties:false}, ...branches ] } },
    required:['action'], additionalProperties:false }; }
function systemPromptFor(tools, role){ const list=tools.map(t=>{ const props=t.inputSchema.toJSONSchema().properties||{};
    const args=Object.keys(props).join(', '); return `- ${t.name}(${args}) — ${(t.description||'').slice(0,60)}`; }).join('\n');
  return `${role||'You are a focused research/writing subagent running inside a web app.'}
You operate by calling tools in a loop. Each turn output ONE JSON object:
  {"thought":"<short>","action":{...}}
where action is EITHER {"kind":"final"} (task done — you will then write the answer)
OR {"kind":"tool","name":"<tool>","input":{...}} (call exactly one tool).
Rules: output ONLY the JSON object. One tool per turn. Stop when done; never loop forever.
Use the FEWEST tools needed. Answer from tool results, never invent facts.
Available tools:\n${list}`; }
function parseEnvelope(raw){ const o=extractJSON(raw); return (o&&o.action)?o:null; }

async function runTool(tool, input){ const data=await tool.call(input); const text=typeof data==='string'?data:JSON.stringify(data);
  if(text.length>tool.maxResultSizeChars){ const {handle,preview}=await swapOut(text,'tool_result',tool.name);
    return {_swapped:true, handle, note:`Result too large (${text.length} chars), saved to ${handle}. Use retrieve() or page_in("${handle}").`, preview}; }
  return data; }

/* ---- the agentic loop ------------------------------------------------- */
export async function* runAgent(task, history=[], opts={}){
  const tools = opts.tools || TOOLS;
  const localByName = Object.fromEntries(tools.map(t=>[t.name,t]));
  let messages=[...history, {role:'user',content:task}];
  const system = systemPromptFor(tools, opts.role);
  const schema = buildEnvelopeSchema(tools);
  const MAX_TURNS = opts.maxTurns || 14, HARD_TOOL_CAP = opts.maxTools || 12;
  let turn=0, toolCalls=0, toolsUsed=false; const recent=[];
  while (true) {
    if (STOP) { yield {type:'final', text:'(stopped)'}; return; }
    if (turn++ >= MAX_TURNS || toolCalls >= HARD_TOOL_CAP) {
      yield {type:'status', text:'wrapping up'}; const a=await finalAnswer(messages, system, opts, task); yield {type:'final', text:a, capped:true}; return;
    }
    yield {type:'turn', n:turn};
    let res; try{ res=await streamLLM({ messages, system, schema, max_tokens:1280, temperature:0 }); }
    catch(e){ yield {type:'error', error:'inference failed: '+e.message}; return; }
    const env=parseEnvelope(res.text);
    if (!env){ messages.push({role:'assistant',content:res.text||'(empty)'}); messages.push({role:'user',content:'Respond again with ONLY the JSON envelope.'}); if(turn>2){ yield {type:'final', text:await finalAnswer(messages,system,opts,task)}; return; } continue; }
    messages.push({role:'assistant',content:JSON.stringify(env)});
    const a=env.action;
    if (a.kind==='final'){ yield {type:'status',text:'writing'}; const ans=await finalAnswer(messages,system,opts,task); yield {type:'final', text:ans, thought:env.thought}; return; }
    const tool=localByName[a.name];
    yield {type:'tool_call', name:a.name, input:a.input||{}, thought:env.thought, readOnly: tool?tool.isReadOnly(a.input||{}):false};
    const key=a.name+':'+JSON.stringify(a.input||{}); recent.push(key); if(recent.length>6) recent.shift();
    if(recent.filter(k=>k===key).length>=3){ yield {type:'final', text:await finalAnswer(messages,system,opts,task)}; return; }
    let result; if(!tool){ result={error:`unknown tool ${a.name}`}; }
    else { const parsed=tool.inputSchema.safeParse(a.input||{}); if(!parsed.ok) result={error:'invalid input: '+parsed.error};
      else { try{ result=await runTool(tool,parsed.value); toolsUsed=true; toolCalls++; }catch(e){ result={error:a.name+' threw: '+e.message}; } } }
    yield {type:'tool_result', name:a.name, result};
    messages.push({role:'user', content:'TOOL RESULT '+a.name+': '+(typeof result==='string'?result:JSON.stringify(result))});
  }
}
async function finalAnswer(messages, system, opts, task){
  const ask = opts.answerInstruction || 'Write the final answer in clean prose, using ONLY the information gathered above. Be concise and direct.';
  const { text } = await streamLLM({ system, messages:[...messages, {role:'user',content:ask}], max_tokens: opts.answerTokens||1200, temperature:0.2, onToken: opts.onAnswerToken });
  return text.trim();
}

// spawn_agent — delegate a self-contained sub-task to a fresh read-only subagent.
registerTool({ name:'spawn_agent', description:'Delegate a focused sub-task (research/digest) to a subagent with its own context; returns its report.', maxResultSizeChars:8000,
  inputSchema:Z.object({ prompt:Z.string(), role:Z.string().optional() }),
  call: async ({prompt, role})=>{ const allowed=TOOLS.filter(t=>t.isReadOnly({})&&t.name!=='spawn_agent'); let report='',err='';
    try{ for await (const ev of runAgent(prompt, [], {tools:allowed, role:role||'You are a focused research subagent.', maxTurns:12})){ if(ev.type==='final') report=ev.text; else if(ev.type==='error') err=ev.error; } }
    catch(e){ err=String(e.message||e); } return err?{error:err,report}:{report}; } });
