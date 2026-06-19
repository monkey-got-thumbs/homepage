/* =============================================================================
 * chatyman.js — a drop-in, in-browser support chatbot for a single website.
 *
 *   <script src="/chatyman.js" defer></script>   +   /chatyman.json
 *
 * Curated workflow for the guided paths (always works, zero deps), a small
 * in-browser model for understanding (transformers.js MiniLM embeddings — runs
 * on WASM in any modern browser; optional WebLLM generative grounding when
 * WebGPU is present), and SCOPED agentic retrieval over the host's OWN site
 * (same-origin fetch + RAG, cited answers, never the open web, never invented).
 *
 * Everything runs in the browser. No backend. No per-message cost. Same-origin
 * only → CORS is a non-issue and standard browser security stays on.
 *
 * Data attributes on the <script> tag:
 *   data-config="/chatyman.json"   config URL (default /chatyman.json)
 *   data-inline="#selector"        render inline into an element (no launcher)
 *   data-open="true"               auto-open the floating panel on load
 *
 * Built by Monkey Got Thumbs. Architecture: see projects/chatyman/PLAN.md.
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__chatymanLoaded) return;
    window.__chatymanLoaded = true;

    /* ---- locate our own <script> + read options -------------------------- */
    const SELF = document.currentScript ||
        [].slice.call(document.scripts).reverse().find(s => /chatyman\.js(\?|$)/.test(s.src || ''));
    const ds = (SELF && SELF.dataset) || {};
    const CONFIG_URL = ds.config || '/chatyman.json';
    const INLINE_SEL = ds.inline || null;
    const AUTO_OPEN = ds.open === 'true';

    /* ---- model runtimes (loaded lazily from CDN, cached after first use) -- */
    const WEBLLM_URL = 'https://esm.run/@mlc-ai/web-llm';
    const XENOVA_URL = 'https://esm.run/@huggingface/transformers';

    /* ---- runtime state --------------------------------------------------- */
    let CFG = null, FLOW = null, node = null, NODES = {}, GLOBALS = [];
    let started = false, busy = false;
    let embReady = false, embFn = null;          // MiniLM embed(texts)->vecs
    let _embResolve = null; const embReadyPromise = new Promise(r => { _embResolve = r; });
    let llm = null, llmGrammar = false, llmState = 'idle'; // idle|loading|ready|off
    let siteIndex = [], indexState = 'idle', _indexPromise = null;  // idle|running|done
    let ui = null;                                // {root, msgs, btns, input, ...}

    /* ===================================================================== *
     * Small utilities
     * ===================================================================== */
    const $ = (sel, r) => (r || document).querySelector(sel);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; } // vecs normalized → cosine

    function sameOrigin(url) {
        try { return new URL(url, location.href).origin === location.origin; }
        catch (_) { return false; }
    }
    async function fetchSameOrigin(url) {
        if (!sameOrigin(url)) throw new Error('cross-origin blocked: ' + url);
        const r = await fetch(url, { credentials: 'same-origin' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.text();
    }
    // Readable text from an HTML string (strip chrome/scripts).
    function readableFromHtml(html) {
        let title = '', text = '';
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            title = (doc.querySelector('title') && doc.querySelector('title').textContent || '').trim();
            doc.querySelectorAll('script,style,noscript,svg,template,mgt-header,mgt-footer,header,footer,nav').forEach(n => n.remove());
            const main = doc.querySelector('main') || doc.body || doc.documentElement;
            text = (main.textContent || '').replace(/\s+/g, ' ').trim();
        } catch (_) {}
        return { title, text };
    }
    function readableFromDocument() {
        const clone = document.cloneNode(true);
        clone.querySelectorAll('script,style,noscript,svg,template,mgt-header,mgt-footer,header,footer,nav,#chatyman-root').forEach(n => n.remove());
        const main = clone.querySelector('main') || clone.body;
        return {
            title: (document.title || '').trim(),
            text: ((main && main.textContent) || '').replace(/\s+/g, ' ').trim()
        };
    }
    function chunkText(text, size) {
        size = size || 900;
        const words = text.split(/\s+/); const out = []; let cur = [];
        let n = 0;
        for (const w of words) {
            cur.push(w); n += w.length + 1;
            if (n >= size) { out.push(cur.join(' ')); cur = []; n = 0; }
        }
        if (cur.length) out.push(cur.join(' '));
        return out.filter(c => c.length > 40);
    }
    function globToRe(g) {
        return new RegExp('^' + g.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    }

    /* ===================================================================== *
     * Embeddings — transformers.js MiniLM in a worker (WASM, runs everywhere)
     * ===================================================================== */
    function spawnEmbWorker() {
        const src = `
import { pipeline, env } from ${JSON.stringify(XENOVA_URL)};
env.allowLocalModels = false;
let ext = null;
async function load(){ if(!ext) ext = await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2'); return ext; }
onmessage = async (e) => {
  const { id, texts } = e.data;
  try {
    const x = await load();
    const out = await x(texts, { pooling: 'mean', normalize: true });
    let vecs;
    if (out && typeof out.tolist === 'function') vecs = out.tolist();
    else { const d = out.dims[1]; vecs = []; for (let i=0;i<texts.length;i++) vecs.push(Array.from(out.data.slice(i*d,(i+1)*d))); }
    postMessage({ id, ok: true, vecs });
  } catch (err) { postMessage({ id, ok: false, error: String((err && err.message) || err) }); }
};`;
        const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        const w = new Worker(url, { type: 'module' });
        setTimeout(() => URL.revokeObjectURL(url), 0);
        return w;
    }
    function initEmbeddings() {
        let worker, seq = 0; const pending = new Map();
        try { worker = spawnEmbWorker(); } catch (_) { return null; }
        worker.onmessage = e => {
            const { id, ok, vecs, error } = e.data; const p = pending.get(id);
            if (p) { pending.delete(id); ok ? p.res(vecs) : p.rej(new Error(error)); }
        };
        worker.onerror = () => { for (const [, p] of pending) p.rej(new Error('emb worker crashed')); pending.clear(); embReady = false; };
        return (texts) => new Promise((res, rej) => {
            const id = ++seq; pending.set(id, { res, rej });
            worker.postMessage({ id, texts });
            setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('emb timeout')); } }, 120000);
        });
    }

    /* ===================================================================== *
     * WebLLM — optional generative grounding (only when WebGPU is present)
     * ===================================================================== */
    async function ensureLLM() {
        if (llmState === 'ready') return llm;
        if (llmState === 'off' || llmState === 'loading') return null;
        if (!('gpu' in navigator) || (CFG.model && CFG.model.generative === 'off')) { llmState = 'off'; return null; }
        llmState = 'loading'; setStatus('Loading the in-browser LLM…');
        try {
            const webllm = await import(/* @vite-ignore */ WEBLLM_URL);
            const want = (CFG.model && CFG.model.preferred) || 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
            const list = webllm.prebuiltAppConfig.model_list.map(m => m.model_id);
            const pick = list.find(id => id === want)
                || list.find(id => /Qwen2\.5-1\.5B-Instruct-q4f16/.test(id))
                || list.find(id => /Qwen2\.5-0\.5B-Instruct-q4f16/.test(id))
                || list.find(id => /Llama-3\.2-1B-Instruct-q4f16/.test(id));
            if (!pick) { llmState = 'off'; return null; }
            llm = await webllm.CreateMLCEngine(pick, {
                initProgressCallback: p => setStatus('Loading AI… ' + Math.round((p.progress || 0) * 100) + '%')
            });
            // probe grammar-constrained JSON support
            try {
                const r = await llm.chat.completions.create({
                    messages: [{ role: 'user', content: 'Reply with JSON {"ok":true} only.' }],
                    response_format: { type: 'json_object', schema: JSON.stringify({ type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false }) },
                    max_tokens: 20, temperature: 0
                });
                llmGrammar = typeof JSON.parse(r.choices[0].message.content).ok === 'boolean';
            } catch (_) { llmGrammar = false; }
            llmState = 'ready'; setStatus('');
            return llm;
        } catch (e) {
            console.warn('chatyman: LLM load failed', e); llmState = 'off'; setStatus(''); return null;
        }
    }
    async function llmRouteIntent(text, intents) {
        if (!llm) return null;
        const ids = intents.map(i => i.id);
        const enumIds = ids.concat(['site_lookup', 'out_of_scope']);
        const schema = {
            type: 'object', additionalProperties: false,
            properties: { intent: { type: 'string', enum: enumIds }, confidence: { type: 'number' } },
            required: ['intent', 'confidence']
        };
        const lines = intents.map(i => `- ${i.id}: ${(i.desc || (i.examples && i.examples[0]) || i.id)}`).join('\n');
        const sys = 'You route a website visitor\'s message to ONE intent id from the list. ' +
            'If they ask a general question the website content might answer, use "site_lookup". ' +
            'If nothing fits, use "out_of_scope". Output JSON only — do not explain.';
        try {
            const r = await llm.chat.completions.create({
                messages: [{ role: 'system', content: sys }, { role: 'user', content: `Intents:\n${lines}\n\nMessage: ${text}` }],
                response_format: llmGrammar ? { type: 'json_object', schema: JSON.stringify(schema) } : { type: 'json_object' },
                max_tokens: 64, temperature: 0
            });
            const m = r.choices[0].message.content.match(/\{[\s\S]*\}/);
            const j = JSON.parse(m ? m[0] : r.choices[0].message.content);
            if (enumIds.includes(j.intent)) return j;
        } catch (e) { console.warn('chatyman: llm route failed', e); }
        return null;
    }
    async function llmGroundedAnswer(query, chunks) {
        if (!llm || !chunks.length) return null;
        const ctx = chunks.map((c, i) => `[${i + 1}] ${c.title} — ${c.url}\n${c.text}`).join('\n\n').slice(0, 4200);
        const sys = 'You are a website assistant. Answer the question using ONLY the context from this website. ' +
            'Be concise and friendly. Cite sources inline like [1]. If the context does not contain the answer, ' +
            'say you are not certain and suggest contacting the team. Never invent facts.';
        try {
            const r = await llm.chat.completions.create({
                messages: [{ role: 'system', content: sys }, { role: 'user', content: `Context:\n${ctx}\n\nQuestion: ${query}` }],
                max_tokens: 320, temperature: 0.2
            });
            return r.choices[0].message.content.trim();
        } catch (e) { console.warn('chatyman: llm answer failed', e); return null; }
    }

    /* ===================================================================== *
     * Scoped agentic layer — same-origin site discovery + RAG (read-only)
     * ===================================================================== */
    async function discoverUrls() {
        const site = CFG.site || {};
        const inc = (site.include || []).map(globToRe);
        const exc = (site.exclude || []).map(globToRe);
        const keepPath = p => {
            if (exc.some(re => re.test(p))) return false;
            return inc.length ? inc.some(re => re.test(p)) : true;
        };
        // Work in PATHS, not absolute URLs — a sitemap declares production hostnames,
        // but we always fetch same-origin (works on prod, staging, localhost, any host).
        let paths = [];
        try {
            const xml = await fetchSameOrigin(site.sitemap || '/sitemap.xml');
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            paths = [].slice.call(doc.querySelectorAll('loc')).map(n => {
                try { return new URL(n.textContent.trim()).pathname; } catch (_) { return null; }
            }).filter(Boolean);
        } catch (_) {
            // fallback: same-origin links from the current page
            paths = [].slice.call(document.querySelectorAll('a[href]')).map(a => {
                try { const u = new URL(a.href); return (u.origin === location.origin && !u.hash) ? u.pathname : null; }
                catch (_) { return null; }
            }).filter(Boolean);
        }
        paths = Array.from(new Set(paths)).filter(keepPath);
        return paths.map(p => new URL(p, location.origin).href);
    }
    function indexSite() {
        if (_indexPromise) return _indexPromise;          // run once; callers await the same promise
        if (!CFG.site) { _indexPromise = Promise.resolve(); return _indexPromise; }
        indexState = 'running';
        _indexPromise = (async () => {
            try {
                const urls = await discoverUrls();
                const maxPages = CFG.site.maxPages || 60;
                const maxChunks = CFG.site.maxChunks || 500;
                const raw = [];
                for (const u of urls.slice(0, maxPages)) {
                    try {
                        const html = await fetchSameOrigin(u);
                        const { title, text } = readableFromHtml(html);
                        if (text.length < 80) continue;
                        for (const c of chunkText(text, 900)) {
                            raw.push({ url: new URL(u, location.href).pathname, title, text: c });
                            if (raw.length >= maxChunks) break;
                        }
                    } catch (_) {}
                    if (raw.length >= maxChunks) break;
                    await sleep(0); // yield
                }
                if (!embReady) { try { await Promise.race([embReadyPromise, new Promise(r => setTimeout(r, 12000))]); } catch (_) {} }
                if (embReady && raw.length) {
                    for (let i = 0; i < raw.length; i += 32) {
                        const batch = raw.slice(i, i + 32);
                        try { const vecs = await embFn(batch.map(b => b.text)); batch.forEach((b, k) => b.vec = vecs[k]); } catch (_) {}
                        siteIndex.push(...batch);
                        await sleep(0);
                    }
                } else {
                    siteIndex = raw; // keyword-only fallback
                }
                indexState = 'done';
            } catch (e) { console.warn('chatyman: indexSite failed', e); indexState = 'done'; }
        })();
        return _indexPromise;
    }
    async function retrieve(query, k) {
        k = k || 4;
        if (!siteIndex.length) return [];
        if (embReady && siteIndex[0].vec) {
            const [qv] = await embFn([query]);
            return siteIndex.map(s => ({ s, score: dot(qv, s.vec) }))
                .sort((a, b) => b.score - a.score).slice(0, k)
                .filter(x => x.score > 0.25).map(x => x.s);
        }
        // keyword fallback
        const terms = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);
        return siteIndex.map(s => {
            const t = s.text.toLowerCase(); let sc = 0; terms.forEach(w => { if (t.includes(w)) sc++; });
            return { s, score: sc };
        }).sort((a, b) => b.score - a.score).slice(0, k).filter(x => x.score > 0).map(x => x.s);
    }

    /* ===================================================================== *
     * NLU routing — tiered: buttons → embeddings → (LLM) → site/fallback
     * ===================================================================== */
    function nodeIntents() { return (node.intents || []).concat(GLOBALS); }

    async function embScores(text, intents) {
        if (!embReady) return null;
        // centroid per intent = mean of example vectors (computed + cached lazily)
        for (const it of intents) {
            if (!it._cent) {
                const ex = (it.examples && it.examples.length) ? it.examples : [it.id.replace(/_/g, ' ')];
                const vs = await embFn(ex);
                const d = vs[0].length, c = new Array(d).fill(0);
                vs.forEach(v => { for (let i = 0; i < d; i++) c[i] += v[i]; });
                let nrm = 0; for (let i = 0; i < d; i++) { c[i] /= vs.length; nrm += c[i] * c[i]; }
                nrm = Math.sqrt(nrm) || 1; for (let i = 0; i < d; i++) c[i] /= nrm;
                it._cent = c;
            }
        }
        const [qv] = await embFn([text]);
        return intents.map(it => ({ it, score: dot(qv, it._cent) })).sort((a, b) => b.score - a.score);
    }

    async function route(text) {
        const intents = nodeIntents();
        const th = CFG.thresholds || {};
        const tauHigh = th.tauHigh != null ? th.tauHigh : 0.62;
        const delta = th.delta != null ? th.delta : 0.06;
        const tauAsk = th.tauAsk != null ? th.tauAsk : 0.42;

        // Ensure the small embedding model is ready (bounded wait) — it's essential
        // for smart routing and only ~23MB. Never block on the big generative model.
        if (!embReady) { warmEmbeddings(); await Promise.race([embReadyPromise, new Promise(r => setTimeout(r, 15000))]); }

        let scored = null;
        try { scored = await embScores(text, intents); } catch (_) {}

        if (scored && scored.length) {
            const best = scored[0], second = scored[1] || { score: -1 };
            if (best.score >= tauHigh && (best.score - second.score) >= delta) {
                return { intent: best.it.id, via: 'embedding', def: best.it };
            }
        }
        // Only consult the generative LLM if it is ALREADY loaded; otherwise warm it in
        // the background so later turns can use it — never block this turn on a ~1GB download.
        if (llmState === 'ready') {
            const j = await llmRouteIntent(text, intents);
            if (j) {
                if (j.intent === 'site_lookup') return { intent: 'site_lookup', via: 'llm' };
                if (j.intent === 'out_of_scope') return { intent: 'out_of_scope', via: 'llm' };
                const def = intents.find(i => i.id === j.intent);
                if (def) return { intent: def.id, via: 'llm', def };
            }
        } else {
            ensureLLM();
        }
        // lenient embedding accept, else fall back to site search
        if (scored && scored.length && scored[0].score >= tauAsk) {
            return { intent: scored[0].it.id, via: 'embedding-lenient', def: scored[0].it };
        }
        return { intent: 'site_lookup', via: 'fallback' };
    }

    /* ===================================================================== *
     * Dialogue manager — walks the curated flow graph
     * ===================================================================== */
    function goTo(id) {
        const n = NODES[id];
        if (!n) { console.warn('chatyman: missing node', id); return; }
        node = n; node._id = id;
        renderNode(n);
    }
    function renderNode(n) {
        if (n.say) addBot(n.say);
        if (n.answer) emitAnswer(n.answer);
        renderButtons(n);
        gateInput(n);
        if (n.collect) askInput(n.collect.prompt || 'Please type your answer.');
    }
    function renderButtons(n) {
        ui.btns.innerHTML = '';
        (n.buttons || []).forEach(b => {
            const el = document.createElement('button');
            el.className = 'cm-chip'; el.textContent = b.label;
            el.addEventListener('click', () => onButton(b));
            ui.btns.appendChild(el);
        });
    }
    function gateInput(n) {
        const free = (n.intents && n.intents.length) || n.collect || n.fallback || CFG.alwaysAllowText !== false;
        ui.input.disabled = !free;
        ui.send.disabled = !free;
        ui.input.placeholder = free ? (CFG.inputPlaceholder || 'Type your message…') : 'Pick an option above…';
    }
    function emitAnswer(ans) {
        addBot(ans.text, ans.sources);
    }

    async function onButton(b) {
        addUser(b.label);
        if (b.action === 'escalate') return escalate();
        if (b.action === 'site_rag') { ui.input.focus(); return addBot(escalateOrAsk()); }
        if (b.goto) return goTo(b.goto);
        if (b.url) { window.open(b.url, sameOrigin(b.url) ? '_self' : '_blank'); return; }
    }
    function escalateOrAsk() { return 'Sure — what would you like to know? I can search this site for you.'; }

    function escalate() {
        const e = CFG.escalation || {};
        if (e.type === 'email' && e.value) addBot(`No problem — you can reach a human at <a href="mailto:${esc(e.value)}">${esc(e.value)}</a>.`);
        else if (e.type === 'url' && e.value) addBot(`No problem — <a href="${esc(e.value)}" target="_blank" rel="noopener">get in touch here</a>.`);
        else addBot('No problem — please use the contact page to reach a human.');
        if (NODES[(CFG.flow && CFG.flow.start) || 'root']) renderButtons(NODES[(CFG.flow && CFG.flow.start) || 'root']);
    }

    async function onText(text) {
        text = (text || '').trim(); if (!text) return;
        addUser(text);
        ui.input.value = '';
        // slot-fill mode
        if (node.collect) {
            const slot = node.collect.slot;
            CFG._slots = CFG._slots || {}; CFG._slots[slot] = text;
            const next = node.collect.goto || node._id;
            node = Object.assign({}, NODES[next] || node); node._id = next;
            if (node.answer) emitAnswer(node.answer);
            renderButtons(node); gateInput(node);
            return;
        }
        setTyping(true);
        try {
            const r = await route(text);
            if (r.intent === 'out_of_scope') {
                addBot(CFG.outOfScope || "I'm not sure about that one. I can help with this site, or connect you to a human.");
                renderButtons(node);
            } else if (r.intent === 'site_lookup') {
                await answerFromSite(text);
            } else if (r.def && r.def.action === 'escalate') {
                escalate();
            } else if (r.def && r.def.goto) {
                goTo(r.def.goto);
            } else if (r.def && r.def.answer) {
                emitAnswer(r.def.answer); renderButtons(node);
            } else {
                await answerFromSite(text);
            }
        } catch (e) {
            console.warn('chatyman: route error', e);
            addBot('Sorry — something went wrong. Try rephrasing, or contact us.');
        } finally { setTyping(false); }
    }

    async function answerFromSite(query) {
        setStatus('Reading the site…'); await indexSite(); setStatus('');
        const chunks = await retrieve(query, 4);
        if (!chunks.length) {
            addBot(CFG.noResults || "I couldn't find that on the site. Want me to connect you to a human?");
            renderButtons(node); return;
        }
        if (llmState !== 'ready') ensureLLM(); // background-load for later turns
        const eng = (llmState === 'ready') ? llm : null;
        if (eng) {
            const ans = await llmGroundedAnswer(query, chunks);
            if (ans) {
                const seen = [], srcs = [];
                chunks.forEach(c => { if (!seen.includes(c.url)) { seen.push(c.url); srcs.push({ url: c.url, title: c.title }); } });
                addBot(mdToHtml(ans), srcs.map(s => s.url));
                renderButtons(node); return;
            }
        }
        // no generative model → return the best matching pages (still grounded + useful)
        const seen = [], lines = [];
        chunks.forEach(c => {
            if (seen.includes(c.url)) return; seen.push(c.url);
            lines.push(`<a href="${esc(c.url)}">${esc(c.title || c.url)}</a> — ${esc(c.text.slice(0, 120))}…`);
        });
        addBot("Here's what I found on the site:<br><br>" + lines.slice(0, 3).join('<br><br>'));
        renderButtons(node);
    }

    function mdToHtml(s) {
        return esc(s)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    /* ===================================================================== *
     * UI — Shadow-DOM widget (style-isolated from the host page)
     * ===================================================================== */
    const STYLE = `
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }
.cm-wrap { font-family: "Montserrat", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    --acc: var(--cm-accent, #A6FF4D); --bg: #17122B; --bg2: #0E0B1A; --fg: #EDECF6; --muted: #B9B5D3;
    --brand: #503E94; --brand2: #6A55C0; --bd: rgba(255,255,255,.10); }
.cm-launch { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
    display: flex; align-items: center; gap: 10px; border: 0; cursor: pointer;
    background: linear-gradient(180deg, var(--brand2), var(--brand)); color: #fff;
    font: 700 15px/1 "Montserrat", sans-serif; padding: 14px 18px; border-radius: 999px;
    box-shadow: 0 10px 30px rgba(0,0,0,.45); transition: transform .15s ease, filter .15s ease; }
.cm-launch:hover { filter: brightness(1.08); transform: translateY(-1px); }
.cm-launch .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--acc); box-shadow: 0 0 10px var(--acc); }
.cm-panel { position: fixed; right: 20px; bottom: 20px; z-index: 2147483001;
    width: min(390px, calc(100vw - 32px)); height: min(620px, calc(100vh - 40px));
    display: none; flex-direction: column; overflow: hidden;
    background: var(--bg2); color: var(--fg); border: 1px solid var(--bd); border-radius: 18px;
    box-shadow: 0 24px 70px rgba(0,0,0,.6); }
.cm-panel.cm-inline { position: static; width: 100%; height: 560px; display: flex; box-shadow: 0 16px 48px rgba(0,0,0,.45); }
.cm-panel.open { display: flex; animation: cmIn .18s ease-out; }
@keyframes cmIn { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: none; } }
.cm-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--brand) 70%, #000), var(--bg)); border-bottom: 1px solid var(--bd); }
.cm-head .av { width: 34px; height: 34px; border-radius: 50%; background: var(--acc); color: #11210a;
    display: grid; place-items: center; font-weight: 800; font-size: 16px; }
.cm-head .t { flex: 1; min-width: 0; }
.cm-head .t b { display: block; font-size: 15px; }
.cm-head .t span { display: block; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cm-head button { background: transparent; border: 0; color: var(--muted); cursor: pointer; font-size: 20px; line-height: 1; padding: 4px 8px; border-radius: 8px; }
.cm-head button:hover { color: #fff; background: rgba(255,255,255,.08); }
.cm-msgs { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.cm-msg { max-width: 86%; padding: 10px 13px; border-radius: 14px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
.cm-bot { align-self: flex-start; background: var(--bg); border: 1px solid var(--bd); border-bottom-left-radius: 4px; }
.cm-user { align-self: flex-end; background: linear-gradient(180deg, var(--brand2), var(--brand)); color: #fff; border-bottom-right-radius: 4px; }
.cm-msg a { color: var(--acc); text-decoration: underline; text-underline-offset: 2px; }
.cm-user a { color: #fff; }
.cm-src { margin-top: 8px; font-size: 11px; color: var(--muted); }
.cm-src a { color: var(--muted); }
.cm-typing { align-self: flex-start; display: inline-flex; gap: 4px; padding: 12px 14px; background: var(--bg); border: 1px solid var(--bd); border-radius: 14px; }
.cm-typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: cmB 1s infinite; }
.cm-typing i:nth-child(2){ animation-delay:.15s } .cm-typing i:nth-child(3){ animation-delay:.3s }
@keyframes cmB { 0%,60%,100%{ opacity:.3; transform: translateY(0) } 30%{ opacity:1; transform: translateY(-3px) } }
.cm-btns { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 16px 8px; }
.cm-chip { background: color-mix(in srgb, var(--brand) 28%, transparent); color: var(--fg);
    border: 1px solid var(--bd); border-radius: 999px; padding: 8px 13px; font-size: 13px; cursor: pointer;
    font-family: inherit; transition: all .15s ease; }
.cm-chip:hover { border-color: var(--acc); color: var(--acc); }
.cm-foot { padding: 12px 14px; border-top: 1px solid var(--bd); }
.cm-status { font-size: 11px; color: var(--muted); min-height: 14px; padding: 0 2px 6px; }
.cm-row { display: flex; gap: 8px; }
.cm-row input { flex: 1; background: var(--bg); color: var(--fg); border: 1px solid var(--bd);
    border-radius: 10px; padding: 11px 13px; font: 14px "Montserrat", sans-serif; }
.cm-row input:focus { outline: 2px solid var(--acc); border-color: transparent; }
.cm-row button { background: linear-gradient(180deg, var(--brand2), var(--brand)); color: #fff; border: 0;
    border-radius: 10px; width: 44px; cursor: pointer; font-size: 17px; }
.cm-row button:disabled { opacity: .5; cursor: not-allowed; }
.cm-credit { text-align: center; font-size: 10px; color: var(--muted); padding-top: 8px; }
.cm-credit a { color: var(--muted); }
`;

    function buildUI() {
        const host = document.createElement('div');
        host.id = 'chatyman-root';
        const root = host.attachShadow({ mode: 'open' });
        const wrap = document.createElement('div'); wrap.className = 'cm-wrap';
        const accent = (CFG.branding && CFG.branding.accent) || '#A6FF4D';
        wrap.style.setProperty('--cm-accent', accent);
        const name = (CFG.branding && CFG.branding.name) || 'Assistant';
        const sub = (CFG.branding && CFG.branding.subtitle) || 'Ask me anything';
        const inline = INLINE_SEL ? document.querySelector(INLINE_SEL) : null;

        wrap.innerHTML =
            `<style>${STYLE}</style>` +
            (inline ? '' : `<button class="cm-launch" part="launch"><span class="dot"></span>${esc((CFG.branding && CFG.branding.launcherText) || 'Need help?')}</button>`) +
            `<section class="cm-panel${inline ? ' cm-inline open' : ''}" role="dialog" aria-label="${esc(name)}">
                <div class="cm-head">
                    <div class="av">${esc((name[0] || 'C').toUpperCase())}</div>
                    <div class="t"><b>${esc(name)}</b><span>${esc(sub)}</span></div>
                    ${inline ? '' : '<button class="cm-min" aria-label="Minimize">–</button>'}
                </div>
                <div class="cm-msgs" role="log" aria-live="polite"></div>
                <div class="cm-btns"></div>
                <div class="cm-foot">
                    <div class="cm-status"></div>
                    <div class="cm-row">
                        <input type="text" aria-label="Message" placeholder="Type your message…" />
                        <button class="cm-send" aria-label="Send">➤</button>
                    </div>
                    <div class="cm-credit">Powered by <a href="https://monkey-got-thumbs.com/chatty/" target="_blank" rel="noopener">chatyman</a> · runs in your browser</div>
                </div>
            </section>`;

        root.appendChild(wrap);
        (inline || document.body).appendChild(host);

        ui = {
            host, root: wrap,
            panel: $('.cm-panel', wrap), launch: $('.cm-launch', wrap),
            msgs: $('.cm-msgs', wrap), btns: $('.cm-btns', wrap),
            input: $('.cm-row input', wrap), send: $('.cm-send', wrap),
            status: $('.cm-status', wrap), inline: !!inline
        };
        if (ui.launch) ui.launch.addEventListener('click', toggle);
        const min = $('.cm-min', wrap); if (min) min.addEventListener('click', toggle);
        ui.send.addEventListener('click', () => onText(ui.input.value));
        ui.input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onText(ui.input.value); } });
    }

    function open() { if (ui.panel) ui.panel.classList.add('open'); if (ui.launch) ui.launch.style.display = 'none'; if (!started) startConversation(); ui.input.focus(); }
    function close() { if (ui.panel) ui.panel.classList.remove('open'); if (ui.launch) ui.launch.style.display = ''; }
    function toggle() { (ui.panel.classList.contains('open') && !ui.inline) ? close() : open(); }

    function addBot(html, sources) {
        const d = document.createElement('div'); d.className = 'cm-msg cm-bot'; d.innerHTML = html;
        if (sources && sources.length) {
            const seen = []; const links = sources.filter(u => { if (seen.includes(u)) return false; seen.push(u); return true; })
                .slice(0, 4).map(u => `<a href="${esc(u)}">${esc(u)}</a>`).join(' · ');
            const s = document.createElement('div'); s.className = 'cm-src'; s.innerHTML = 'Sources: ' + links; d.appendChild(s);
        }
        ui.msgs.appendChild(d); scroll();
    }
    function addUser(text) {
        const d = document.createElement('div'); d.className = 'cm-msg cm-user'; d.textContent = text;
        ui.msgs.appendChild(d); scroll();
    }
    let typingEl = null;
    function setTyping(on) {
        if (on && !typingEl) { typingEl = document.createElement('div'); typingEl.className = 'cm-typing'; typingEl.innerHTML = '<i></i><i></i><i></i>'; ui.msgs.appendChild(typingEl); scroll(); }
        else if (!on && typingEl) { typingEl.remove(); typingEl = null; }
    }
    function setStatus(t) { if (ui && ui.status) ui.status.textContent = t || ''; }
    function askInput(p) { ui.input.placeholder = p; ui.input.focus(); }
    function scroll() { ui.msgs.scrollTop = ui.msgs.scrollHeight; }

    function startConversation() {
        started = true;
        const startId = (CFG.flow && CFG.flow.start) || 'root';
        goTo(startId);
        // warm embeddings + idle-index the site so the agentic path is fast later
        warmEmbeddings();
        if (CFG.site && CFG.site.indexOnIdle !== false) {
            if ('requestIdleCallback' in window) requestIdleCallback(() => indexSite(), { timeout: 4000 });
            else setTimeout(() => indexSite(), 2500);
        }
        if (CFG.model && CFG.model.generative === 'eager') ensureLLM();
    }

    async function warmEmbeddings() {
        if (embFn) return embReadyPromise;
        embFn = initEmbeddings();
        if (!embFn) { _embResolve(false); return embReadyPromise; }
        try { await embFn(['hello']); embReady = true; _embResolve(true); }
        catch (_) { embReady = false; _embResolve(false); }
        return embReadyPromise;
    }

    /* ===================================================================== *
     * Boot
     * ===================================================================== */
    async function boot() {
        try {
            const r = await fetch(CONFIG_URL, { credentials: 'same-origin' });
            if (!r.ok) throw new Error('config HTTP ' + r.status);
            CFG = await r.json();
        } catch (e) {
            console.error('chatyman: could not load ' + CONFIG_URL, e);
            return; // fail silent on the host page
        }
        FLOW = CFG.flow || {};
        NODES = FLOW.nodes || {};
        GLOBALS = (FLOW.globals && FLOW.globals.intents) || [];
        if (!NODES[(FLOW.start) || 'root']) { console.error('chatyman: flow.start node missing'); return; }
        buildUI();
        if (INLINE_SEL || AUTO_OPEN) open();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    // expose a tiny API for the demo page
    window.chatyman = { open: () => open(), close: () => close(), reload: boot };
})();
