/* Agent Builder Advisor — one-shot client.
 * External module (CSP `script-src 'self'`), progressive-enhancement guarded.
 * Until MGT_TRACKING.ADVISOR_ENDPOINT is set, the page runs in "preview" mode
 * (teaching example only). When set, it POSTs once to the Bedrock-backed Lambda
 * and renders critique + test runs + improvements (all model output is inserted
 * as textContent — never as HTML).
 */
(function () {
    const form = document.getElementById('advisor-form');
    if (!form) return;

    const T = window.MGT_TRACKING || {};
    const ENDPOINT = T.ADVISOR_ENDPOINT || '';
    const TURNSTILE_KEY = T.TURNSTILE_SITE_KEY || '';
    const PREVIEW = !ENDPOINT;

    const $ = (id) => document.getElementById(id);
    const statusEl = $('advisor-status');
    const results = $('results');
    const analyzeBtn = $('analyze-btn');
    const sp = $('system-prompt');
    const spCount = $('sp-count');

    const setStatus = (msg, kind) => { statusEl.textContent = msg || ''; statusEl.className = kind || ''; };

    // ── Preview mode banner ──────────────────────────────────────────
    if (PREVIEW) { const n = $('preview-note'); if (n) n.hidden = false; }

    // ── Char counter ─────────────────────────────────────────────────
    const updateCount = () => {
        const n = sp.value.length;
        spCount.textContent = n + ' / 6000';
        spCount.classList.toggle('over', n > 6000);
    };
    sp.addEventListener('input', updateCount);
    updateCount();

    // ── Reveal extra test inputs ─────────────────────────────────────
    let revealed = 1;
    const addBtn = $('add-input');
    addBtn.addEventListener('click', () => {
        revealed++;
        const wrap = $('test-' + revealed + '-wrap');
        if (wrap) { wrap.hidden = false; wrap.querySelector('textarea').focus(); }
        if (revealed >= 3) addBtn.hidden = true;
    });

    // ── Example (teaching) ───────────────────────────────────────────
    const EXAMPLE = {
        agentName: 'Refund-support assistant for Northwind Shoes (online shop)',
        systemPrompt: [
            'You are a refund-support assistant for Northwind Shoes, an online shop.',
            '',
            'Scope: Help customers understand the returns policy and start a return.',
            'Policy you must follow: Refunds are allowed within 30 days of delivery, for unworn items with proof of purchase. Faulty items can be returned any time.',
            'Limits: You cannot approve refunds yourself — you explain eligibility and, if eligible, give the steps to start one. Never promise money back.',
            'Tone: Warm, plain English, 3 sentences max unless asked for detail.',
            'If unsure or out of scope: say so and offer to hand off to a human at support@northwind.example.',
            'Output: A short reply to the customer, then a line "ELIGIBLE: yes/no/unclear".'
        ].join('\n'),
        tests: [
            'I bought these trainers 40 days ago and they fell apart — can I get a refund?',
            'do you ship to germany'
        ],
        rubric: 'Cites the 30-day / faulty-item policy correctly, stays warm and brief, never promises a refund it can\'t authorise, and hands off when out of scope.'
    };
    $('load-example').addEventListener('click', () => {
        $('agent-name').value = EXAMPLE.agentName;
        sp.value = EXAMPLE.systemPrompt; updateCount();
        $('test-1').value = EXAMPLE.tests[0];
        $('test-2-wrap').hidden = false; $('test-2').value = EXAMPLE.tests[1]; revealed = Math.max(revealed, 2);
        $('rubric').value = EXAMPLE.rubric;
        setStatus('Example loaded — edit it, then send for feedback.', '');
        if (window.MGT && window.MGT.announceToScreenReader) window.MGT.announceToScreenReader('Example loaded');
        sp.focus();
    });

    // ── Turnstile (only when configured) ─────────────────────────────
    if (TURNSTILE_KEY) {
        const slot = $('cf-slot');
        const div = document.createElement('div');
        div.className = 'cf-turnstile';
        div.setAttribute('data-sitekey', TURNSTILE_KEY);
        div.setAttribute('data-theme', 'dark');
        slot.appendChild(div);
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        s.async = true; s.defer = true;
        document.head.appendChild(s);
    }
    const turnstileToken = () => {
        if (window.turnstile && typeof window.turnstile.getResponse === 'function') {
            try { return window.turnstile.getResponse() || ''; } catch (e) { /* not ready */ }
        }
        const el = form.querySelector('[name="cf-turnstile-response"]');
        return el ? el.value : '';
    };

    // ── Result rendering (all model strings via textContent) ─────────
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

    function render(data) {
        // critique
        $('critique-summary').textContent = (data.critique && data.critique.summary) || '';
        const issues = $('critique-issues'); issues.replaceChildren();
        ((data.critique && data.critique.issues) || []).forEach((it) => {
            const row = el('div', 'issue');
            const sev = (it.severity || 'low').toLowerCase();
            row.appendChild(el('span', 'pill sev sev--' + (['high', 'medium', 'low'].includes(sev) ? sev : 'low'), sev));
            row.appendChild(el('span', null, it.issue || ''));
            if (it.why) row.appendChild(el('p', 'why', 'Why: ' + it.why));
            issues.appendChild(row);
        });
        if (!issues.children.length) issues.appendChild(el('p', 'muted', 'No blocking issues found — see what\'s already strong below.'));

        // test runs
        const runs = $('runs-list'); runs.replaceChildren();
        (data.testRuns || []).forEach((r) => {
            const row = el('div', 'run');
            row.appendChild(el('div', 'io-label', 'Input'));
            row.appendChild(el('div', 'io', r.input || ''));
            row.appendChild(el('div', 'io-label', 'Output'));
            row.appendChild(el('div', 'io', r.output || ''));
            if (r.note) row.appendChild(el('p', 'note', 'Note: ' + r.note));
            runs.appendChild(row);
        });

        // improvements
        const imps = $('improvements-list'); imps.replaceChildren();
        (data.improvements || []).forEach((im, i) => {
            const row = el('div', 'imp');
            row.appendChild(el('strong', null, (im.priority || i + 1) + '. ' + (im.change || '')));
            if (im.why) row.appendChild(el('p', 'why', 'Why: ' + im.why));
            imps.appendChild(row);
        });

        // improved prompt
        $('improved-prompt').textContent = data.improvedPrompt || '';
        $('improved-card').hidden = !data.improvedPrompt;

        results.hidden = false;
        results.focus();
        results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ── Copy improved prompt ─────────────────────────────────────────
    $('copy-improved').addEventListener('click', () => {
        const text = $('improved-prompt').textContent;
        const done = () => { const b = $('copy-improved'); b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1800); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(done);
        else { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); done(); }
    });

    // ── Submit ───────────────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const systemPrompt = sp.value.trim();
        const tests = ['test-1', 'test-2', 'test-3'].map((id) => $(id).value.trim()).filter(Boolean);

        if (!systemPrompt) { setStatus('Add your agent\'s system prompt first.', 'error'); sp.focus(); return; }
        if (systemPrompt.length > 6000) { setStatus('System prompt is over the 6000-character limit.', 'error'); sp.focus(); return; }
        if (!tests.length) { setStatus('Add at least one test input so the advisor can run your agent.', 'error'); $('test-1').focus(); return; }

        if (PREVIEW) {
            setStatus('Live analysis is launching soon — for now, expand the worked example below to learn what a strong prompt looks like.', '');
            const n = $('preview-note'); if (n) { n.hidden = false; n.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            return;
        }

        const token = TURNSTILE_KEY ? turnstileToken() : '';
        if (TURNSTILE_KEY && !token) { setStatus('Please complete the “I\'m human” check, then send for feedback.', 'error'); return; }

        analyzeBtn.disabled = true;
        const orig = analyzeBtn.textContent; analyzeBtn.textContent = 'Analysing…';
        setStatus('Analysing your agent — this usually takes 10–30 seconds…', 'loading');
        results.hidden = true;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 50000);
        try {
            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentName: $('agent-name').value.trim(),
                    systemPrompt: systemPrompt,
                    testInputs: tests,
                    rubric: $('rubric').value.trim(),
                    website: $('website').value,
                    turnstileToken: token
                }),
                signal: controller.signal
            });
            clearTimeout(timer);

            if (res.status === 429) { setStatus('You\'ve hit today\'s free-analysis limit — it keeps the tool free for everyone. Please come back tomorrow, or build offline with the worked example below.', 'error'); }
            else if (res.status === 503) { setStatus('The advisor is taking a short break to keep costs sane. Please try again later.', 'error'); }
            else if (!res.ok) { setStatus('Something went wrong analysing your agent. Please check your inputs and try again.', 'error'); }
            else {
                const data = await res.json();
                render(data);
                setStatus('', '');
                if (T.trackEvent) T.trackEvent('advisor_analyze', { page: location.pathname, inputs: tests.length });
            }
        } catch (err) {
            clearTimeout(timer);
            if (err && err.name === 'AbortError') setStatus('That took too long — try shortening your prompt or test inputs and run again.', 'error');
            else setStatus('Couldn\'t reach the advisor. Please try again in a moment.', 'error');
        } finally {
            analyzeBtn.disabled = false; analyzeBtn.textContent = orig;
            if (window.turnstile && window.turnstile.reset) { try { window.turnstile.reset(); } catch (e) {} }
        }
    });
})();
