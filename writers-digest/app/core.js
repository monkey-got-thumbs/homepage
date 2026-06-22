/* core.js — Writers Digest foundation, ported/adapted from the Browser Agent
 * harness (magic/agent.html). Provides: the Z schema/validator (one definition
 * drives both JSON Schema and runtime validation), the OPFS workspace + swap
 * store, a MiniLM embeddings worker with an in-memory vector index, retrieve(),
 * and small JSON-document store helpers used by the story bible / settings.
 *
 * Everything is framework-free ES modules so the feature modules and a workflow
 * can build against a stable contract.
 * ====================================================================== */

/* ---- Z : tiny zod-ish validator that also emits JSON Schema ----------- */
class ZBase { constructor(){ this._optional=false; this._default=undefined; this._desc=undefined; }
  optional(){ this._optional=true; return this; }
  default(v){ this._default=v; this._optional=true; return this; }
  describe(d){ this._desc=d; return this; } }
class ZScalar extends ZBase { constructor(t,opts={}){ super(); this.jsonType=t; this.opts=opts; }
  min(n){ this.opts.min=n; return this; } max(n){ this.opts.max=n; return this; }
  toJSONSchema(){ const s={ type:this.jsonType==='integer'?'integer':this.jsonType };
    if(this.opts.enum) s.enum=this.opts.enum; if(this._desc) s.description=this._desc;
    if(this.jsonType==='string'){ if(this.opts.min!=null)s.minLength=this.opts.min; if(this.opts.max!=null)s.maxLength=this.opts.max; }
    if(this.jsonType==='number'||this.jsonType==='integer'){ if(this.opts.min!=null)s.minimum=this.opts.min; if(this.opts.max!=null)s.maximum=this.opts.max; }
    return s; }
  safeParse(v){ const t=this.jsonType;
    if(t==='string'){ if(typeof v==='number'||typeof v==='boolean') v=String(v);
      if(typeof v!=='string') return {ok:false,error:'expected string'};
      if(this.opts.enum && !this.opts.enum.includes(v)) return {ok:false,error:`must be one of ${this.opts.enum.join(', ')}`};
      return {ok:true,value:v}; }
    if(t==='number'||t==='integer'){ if(typeof v==='string'&&v.trim()!==''&&!isNaN(Number(v))) v=Number(v);
      if(typeof v!=='number'||isNaN(v)) return {ok:false,error:'expected number'};
      if(t==='integer') v=Math.trunc(v); return {ok:true,value:v}; }
    if(t==='boolean'){ if(typeof v==='boolean'){} else if(v==='true')v=true; else if(v==='false')v=false; else return {ok:false,error:'expected boolean'}; return {ok:true,value:v}; }
    return {ok:true,value:v}; } }
class ZArray extends ZBase { constructor(item){ super(); this.item=item; }
  toJSONSchema(){ const s={type:'array',items:this.item.toJSONSchema()}; if(this._desc)s.description=this._desc; return s; }
  safeParse(v){ if(!Array.isArray(v)) return {ok:false,error:'expected array'};
    const out=[]; for(const el of v){ const r=this.item.safeParse(el); if(!r.ok) return r; out.push(r.value); } return {ok:true,value:out}; } }
class ZObject extends ZBase { constructor(shape){ super(); this.shape=shape; }
  toJSONSchema(){ const properties={},required=[];
    for(const [k,t] of Object.entries(this.shape)){ properties[k]=t.toJSONSchema(); if(!t._optional) required.push(k); }
    const s={type:'object',properties,additionalProperties:false}; if(required.length) s.required=required; if(this._desc) s.description=this._desc; return s; }
  safeParse(v){ if(v===null||typeof v!=='object'||Array.isArray(v)) return {ok:false,error:'expected object'};
    const out={}; for(const [k,t] of Object.entries(this.shape)){ let val=v[k];
      if(val===undefined||val===null){ if(t._default!==undefined){ out[k]=t._default; continue; } if(t._optional) continue; return {ok:false,error:`missing required field "${k}"`}; }
      const r=t.safeParse(val); if(!r.ok) return {ok:false,error:`field "${k}": ${r.error}`}; out[k]=r.value; }
    return {ok:true,value:out}; } }
export const Z = {
  object:(s)=>new ZObject(s), string:()=>new ZScalar('string'), number:()=>new ZScalar('number'),
  integer:()=>new ZScalar('integer'), boolean:()=>new ZScalar('boolean'),
  enum:(vals)=>new ZScalar('string',{enum:vals}), array:(i)=>new ZArray(i),
};

/* ---- small utils ------------------------------------------------------ */
export const estTokens = (s)=>Math.ceil((s?.length||0)/3.6);
export const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
export const slugify = (s)=>String(s).replace(/^https?:\/\//,'').replace(/[#?].*$/,'').replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,60)||'x';
export async function sha8(str){ const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join(''); }

/* ---- OPFS workspace --------------------------------------------------- */
async function opfsRoot(){ return await navigator.storage.getDirectory(); }
async function wsDir(create=true){ return await (await opfsRoot()).getDirectoryHandle('workspace',{create}); }
function splitPath(p){ const parts=String(p||'').replace(/^\/+/,'').split('/').filter(x=>x&&x!=='.');
  if(parts.some(x=>x==='..')) throw new Error('path escapes /workspace'); return parts; }
async function fileHandle(p,{create=false}={}){ const parts=splitPath(p); if(!parts.length) throw new Error('empty path');
  const fname=parts.pop(); let d=await wsDir(); for(const part of parts){ d=await d.getDirectoryHandle(part,{create}); } return await d.getFileHandle(fname,{create}); }
async function dirHandle(p,{create=false}={}){ let d=await wsDir(); for(const part of splitPath(p)){ d=await d.getDirectoryHandle(part,{create}); } return d; }
export async function readFileText(p){ const f=await (await fileHandle(p)).getFile(); return await f.text(); }
export async function writeFileText(p,content){ const fh=await fileHandle(p,{create:true}); const w=await fh.createWritable(); await w.write(content); await w.close(); return {bytes:new TextEncoder().encode(content).length}; }
export async function listDir(p){ const d=await dirHandle(p||''); const out=[];
  for await (const [name,h] of d.entries()){ let size=null; if(h.kind==='file'){ try{ size=(await h.getFile()).size; }catch{} } out.push({name,kind:h.kind,...(size!=null?{size}:{})}); }
  out.sort((a,b)=> a.kind===b.kind? a.name.localeCompare(b.name) : a.kind==='directory'?-1:1); return out; }
export async function walkWorkspace(prefix=''){ const out=[]; const d= prefix? await dirHandle(prefix) : await wsDir();
  for await (const [name,h] of d.entries()){ const rel= prefix? prefix.replace(/\/$/,'')+'/'+name : name;
    if(h.kind==='directory'){ out.push(rel+'/'); out.push(...await walkWorkspace(rel)); } else out.push(rel); } return out; }
export async function opfsHasFile(p){ try{ await fileHandle(p); return true; }catch{ return false; } }

/* JSON document store (story bible, settings, lessons-state…) */
export async function loadJSON(p, fallback){ try{ return JSON.parse(await readFileText(p)); }catch{ return fallback; } }
let _saveTimers={};
export async function saveJSON(p, obj){ await writeFileText(p, JSON.stringify(obj,null,2)); }
export function saveJSONSoon(p, obj, ms=1500){ clearTimeout(_saveTimers[p]); _saveTimers[p]=setTimeout(()=>saveJSON(p,obj).catch(()=>{}), ms); }

/* ---- swap store: spill oversized blobs to OPFS, keep a handle --------- */
async function swapRecordsDir(){ const s=await (await opfsRoot()).getDirectoryHandle('swap',{create:true}); return await s.getDirectoryHandle('records',{create:true}); }
export async function swapOut(content, kind='blob', source=''){ const id=await sha8(content);
  const fh=await (await swapRecordsDir()).getFileHandle(id+'.json',{create:true});
  const preview = content.length<=300? content : content.slice(0,300).replace(/\s+/g,' ').trim()+'…';
  const rec={id,kind,source,content,tokens:estTokens(content),preview,mtime:Date.now()};
  const w=await fh.createWritable(); await w.write(JSON.stringify(rec)); await w.close();
  indexContent(`swap://${id}`, source||kind, content);
  return {handle:`swap://${id}`, preview, tokens:rec.tokens}; }
export async function swapIn(handle, offset=0, limit=4000){ const id=String(handle).replace(/^swap:\/\//,'');
  const fh=await (await swapRecordsDir()).getFileHandle(id+'.json'); const rec=JSON.parse(await (await fh.getFile()).text());
  const slice=rec.content.slice(offset, offset+limit);
  return {content:slice, totalChars:rec.content.length, offset, returned:slice.length, remaining:Math.max(0, rec.content.length-(offset+slice.length))}; }

/* ---- embeddings worker (MiniLM via transformers.js) ------------------- */
const EMBED_WORKER_SRC = `
import { pipeline, env } from "https://esm.run/@huggingface/transformers";
env.allowLocalModels=false;
let extractor=null;
async function get(){ if(!extractor) extractor=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2'); return extractor; }
onmessage=async(e)=>{ const {id,texts}=e.data;
  try{ const ex=await get(); const vecs=[]; for(const t of texts){ const o=await ex(t,{pooling:'mean',normalize:true}); vecs.push(Array.from(o.data)); } postMessage({id,ok:true,vecs}); }
  catch(err){ postMessage({id,ok:false,error:String((err&&err.message)||err)}); } };`;
function spawnModuleWorker(src){ const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'})); const w=new Worker(url,{type:'module'}); URL.revokeObjectURL(url); return w; }
let embedWorker=null, embedSeq=0; const embedPending=new Map();
function getEmbedWorker(){ if(!embedWorker){ embedWorker=spawnModuleWorker(EMBED_WORKER_SRC);
    embedWorker.onmessage=(e)=>{ const {id,ok,vecs,error}=e.data; const p=embedPending.get(id); if(p){ embedPending.delete(id); ok?p.res(vecs):p.rej(new Error(error||'embed failed')); } };
    embedWorker.onerror=()=>{ for(const [,p] of embedPending) p.rej(new Error('embed worker crashed')); embedPending.clear(); embedWorker=null; }; } return embedWorker; }
export function embedTexts(texts){ return new Promise((res,rej)=>{ const id=++embedSeq; embedPending.set(id,{res,rej});
  getEmbedWorker().postMessage({id,texts}); setTimeout(()=>{ if(embedPending.has(id)){ embedPending.delete(id); rej(new Error('embed timeout')); } },90000); }); }

/* ---- vector index + retrieve ----------------------------------------- */
let vectorIndex=[]; const indexedHandles=new Set(); const MAX_CHUNKS=2000;
function dotv(a,b){ let s=0,n=Math.min(a.length,b.length); for(let i=0;i<n;i++) s+=a[i]*b[i]; return s; }
export function chunkText(text, size=900, overlap=120, maxChunks=400){ const out=[]; let i=0,n=text.length;
  while(i<n && out.length<maxChunks){ let end=Math.min(i+size,n);
    if(end<n){ const w=Math.min(overlap,end-i); const win=text.slice(end-w,end);
      const m=Math.max(win.lastIndexOf('. '),win.lastIndexOf('\n'),win.lastIndexOf('? '),win.lastIndexOf('! ')); if(m>20) end=end-w+m+1; }
    out.push({text:text.slice(i,end),offset:i}); i=(end-overlap>i)?end-overlap:end; } return out; }
let saveIndexTimer=null;
function saveIndexSoon(){ if(saveIndexTimer) return; saveIndexTimer=setTimeout(async()=>{ saveIndexTimer=null; try{ await writeFileText('.index.json',JSON.stringify({chunks:vectorIndex})); }catch{} },6000); }
export async function loadIndex(){ try{ const j=JSON.parse(await readFileText('.index.json')); if(j&&Array.isArray(j.chunks)){ vectorIndex=j.chunks; for(const c of vectorIndex) indexedHandles.add(c.handle); } }catch{} }
export async function indexContent(handle, source, content){ if(!content||content.length<200||indexedHandles.has(handle)) return; indexedHandles.add(handle);
  try{ const chunks=chunkText(content); const vecs=await embedTexts(chunks.map(c=>c.text));
    for(let i=0;i<chunks.length;i++) vectorIndex.push({handle,source,offset:chunks[i].offset,text:chunks[i].text,vec:vecs[i]});
    if(vectorIndex.length>MAX_CHUNKS) vectorIndex.splice(0,vectorIndex.length-MAX_CHUNKS); saveIndexSoon();
  }catch(e){ console.warn('indexContent failed',e); indexedHandles.delete(handle); } }
// retrieve top-k chunks for a query. opts.source = substring filter on chunk.source (e.g. 'kb:' or 'bible:').
export async function retrieve(query, k=4, opts={}){ if(!query||!vectorIndex.length) return [];
  let qv; try{ qv=(await embedTexts([query]))[0]; }catch(e){ return []; }
  let pool=vectorIndex; if(opts.source) pool=pool.filter(it=>String(it.source||'').includes(opts.source));
  return pool.map(it=>({it,score:dotv(qv,it.vec)})).sort((a,b)=>b.score-a.score).slice(0,k)
    .map(s=>({score:Number(s.score.toFixed(3)),source:s.it.source,text:s.it.text})); }
export function indexStats(){ return {chunks:vectorIndex.length}; }
