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

        // test runs (backend gives an Output; the local read gives a checklist to apply yourself)
        const runs = $('runs-list'); runs.replaceChildren();
        (data.testRuns || []).forEach((r) => {
            const row = el('div', 'run');
            row.appendChild(el('div', 'io-label', 'Message'));
            row.appendChild(el('div', 'io', r.input || ''));
            if (Array.isArray(r.check)) {
                row.appendChild(el('div', 'io-label', 'A good reply should'));
                const ul = el('ul', 'check-list');
                r.check.forEach((c) => ul.appendChild(el('li', null, c)));
                row.appendChild(ul);
            } else {
                row.appendChild(el('div', 'io-label', 'Output'));
                row.appendChild(el('div', 'io', r.output || ''));
            }
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

    // ── Local analysis (honest checklist read; no model, no faked output) ──
    function analyzeLocally(sp, tests, rubric, name) {
        var has = {
            role: /\byou are\b|\byou['’]re\b|act as|your role/i.test(sp),
            job: /\b(help|assist|answer|support|your job|scope|you (will|should|can)\b)/i.test(sp),
            limits: /\b(never|do not|don['’]t|only|must not|cannot|can['’]t|avoid|refuse|not allowed)\b/i.test(sp),
            tone: /\b(tone|warm|friendly|polite|concise|brief|formal|casual|plain ?english|short|kind)\b/i.test(sp),
            format: /\b(format|output|reply (with|in)|respond (with|in)|list|checklist|bullet|json|steps?|table|sentences?|paragraph|one line)\b/i.test(sp),
            unsure: /\b(if (you ?['’]?re )?unsure|don['’]t know|not sure|out of scope|say so|hand ?off|escalate|pass (it )?to a human|admit)\b/i.test(sp),
            grounded: /\b(only (from|use)|based on|according to|do not make .* up|don['’]t invent|no ?hallucinat|stick to|policy)\b/i.test(sp)
        };
        var words = sp.split(/\s+/).filter(Boolean).length;
        var issues = [];
        var add = function (sev, issue, why) { issues.push({ severity: sev, issue: issue, why: why }); };
        if (!has.role) add('high', 'No clear role', 'It doesn’t say who the agent is meant to be. Start with “You are a …”.');
        if (!has.job) add('high', 'No defined job', 'Say plainly what it should help with — and what it shouldn’t.');
        if (words < 25) add('high', 'Very short / vague', 'There isn’t much here for the AI to go on — the more of the pieces below you add, the better it behaves.');
        if (!has.limits) add('medium', 'No limits', 'Without “never / only / don’t”, an agent tends to over-promise or wander off-task.');
        if (!has.unsure) add('medium', 'No “when unsure” rule', 'Tell it to say when it doesn’t know and hand off — otherwise it will confidently make something up.');
        if (!has.grounded && /\b(policy|refund|price|rule|fact|law|medical|legal|account)\b/i.test(sp)) add('medium', 'Not grounded in your facts', 'It must follow real facts/policy — add “answer only from …” so it can’t invent rules.');
        if (!has.format) add('low', 'No shape for the answer', 'Ask for a checklist / short reply / set format so answers come out consistent.');
        if (!has.tone) add('low', 'No tone', 'One line on tone (warm, brief, plain English) keeps replies on-brand.');
        if (/\b(helpful|good|nice|appropriate|as ?needed|etc\.?)\b/i.test(sp) && !has.format) add('low', 'Vague words', 'Words like “helpful” mean nothing to an AI — say exactly what a good answer does.');

        var present = [];
        if (has.role) present.push('a clear role'); if (has.job) present.push('a defined job');
        if (has.limits) present.push('limits'); if (has.tone) present.push('a tone');
        if (has.format) present.push('an answer shape'); if (has.unsure) present.push('an “if unsure” rule');
        if (has.grounded) present.push('grounding in your facts');

        var summary = issues.length === 0
            ? 'Strong. Your instructions already cover the essentials — ' + present.join(', ') + '. A couple of polish ideas below.'
            : 'A decent start. It has ' + (present.length ? present.join(', ') : 'the bare bones') + ', but it’s missing ' + issues.length + ' thing' + (issues.length > 1 ? 's' : '') + ' that would make the answers far more reliable.';

        var ACTION = {
            'No clear role': 'Add a first line: “You are a [what it is] for [who / where].”',
            'No defined job': 'Add a “Your job:” line — what it helps with — and a “Not your job:” line for what it shouldn’t touch.',
            'Very short / vague': 'Flesh it out with the role, the job, the limits, the tone and the answer-shape — each line removes a guess.',
            'No limits': 'Add a “Limits:” line — e.g. “only …; never promise … you can’t deliver.”',
            'No “when unsure” rule': 'Add: “If unsure or out of scope, say so plainly and offer to hand off to a human.”',
            'Not grounded in your facts': 'Add: “Answer only from the policy/facts above; if it isn’t covered, say you’re not sure.”',
            'No shape for the answer': 'Add an “Output:” line — e.g. “Reply in 2–3 warm sentences” or “as a short checklist.”',
            'No tone': 'Add a “Tone:” line — e.g. “warm, plain English, concise.”',
            'Vague words': 'Replace fuzzy words like “helpful” with the concrete thing a good answer does.'
        };
        var improvements = issues.slice(0, 5).map(function (it, i) { return { priority: i + 1, change: ACTION[it.issue] || it.issue, why: it.why }; });
        if (!improvements.length) improvements.push({ priority: 1, change: 'Try it on a few tricky, edge-case messages and tighten any line the answer gets wrong.', why: 'Good prompts are found by testing the awkward cases, not the easy ones.' });

        var checks = [];
        (rubric || '').split(/[.;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (c) { checks.push(c.charAt(0).toUpperCase() + c.slice(1)); });
        if (has.unsure) checks.push('When it’s out of scope, it says so and offers a human — it doesn’t bluff');
        if (has.limits) checks.push('It respects the limits — no promises it can’t keep');
        if (has.grounded) checks.push('It sticks to your facts / policy and doesn’t invent rules');
        if (!checks.length) checks.push('It actually answers the question, in the tone and shape you asked for');
        var testRuns = (tests || []).map(function (t) { return { input: t, check: checks }; });

        var additions = [];
        if (!has.role) additions.push('You are a ' + (name ? name : 'helpful assistant') + '.');
        if (!has.job) additions.push('Your job: [what it helps with]. Not your job: [what to refuse or hand off].');
        if (!has.limits) additions.push('Limits: only do the above; never promise anything you can’t actually deliver.');
        if (!has.tone) additions.push('Tone: warm, plain English, concise.');
        if (!has.format) additions.push('Output: reply in 2–3 short, friendly sentences.');
        if (!has.unsure) additions.push('If unsure or out of scope: say so plainly and offer to hand off to a human.');
        if (!has.grounded && /\b(policy|refund|price|rule|fact|account)\b/i.test(sp)) additions.push('Answer only from the facts / policy above; if something isn’t covered, say you’re not sure.');
        var improvedPrompt = additions.length
            ? sp.trim() + '\n\n— added to strengthen it (edit to fit) —\n' + additions.join('\n')
            : sp.trim();

        return { critique: { summary: summary, issues: issues }, testRuns: testRuns, improvements: improvements, improvedPrompt: improvedPrompt, _local: true };
    }

    // ── Submit ───────────────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const systemPrompt = sp.value.trim();
        const tests = ['test-1', 'test-2', 'test-3'].map((id) => $(id).value.trim()).filter(Boolean);

        if (!systemPrompt) { setStatus('Add your agent\'s system prompt first.', 'error'); sp.focus(); return; }
        if (systemPrompt.length > 6000) { setStatus('System prompt is over the 6000-character limit.', 'error'); sp.focus(); return; }
        if (!tests.length) { setStatus('Add at least one test input so the advisor can run your agent.', 'error'); $('test-1').focus(); return; }

        // Always-useful fallback: an honest client-side checklist read (no model, no faked output).
        const localFallback = (msg) => {
            const card = $('runs-card');
            if (card) {
                const h = card.querySelector('h2'); if (h) h.textContent = 'Try each one yourself';
                const note = card.querySelector('p.muted');
                if (note) note.textContent = "We can't run a live AI on this page right now — but here's exactly what to check when you paste each message into your own AI tool (ChatGPT, Claude, and so on).";
            }
            render(analyzeLocally(systemPrompt, tests, $('rubric').value.trim(), $('agent-name').value.trim()));
            setStatus(msg || "Here's a plain-English read of your instructions — a careful checklist, not a live AI call.", '');
        };

        if (PREVIEW) {
            localFallback("Here's a plain-English read of your instructions — a careful checklist, not a live AI call. A deeper, run-it-for-you review is coming.");
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

            if (res.status === 429) { localFallback('You\'ve hit today\'s free live-review limit — here\'s a quick checklist read instead.'); }
            else if (res.status === 503) { localFallback('The live reviewer is taking a short break — here\'s a quick checklist read in the meantime.'); }
            else if (!res.ok) { localFallback('The live reviewer hit a snag — here\'s a quick checklist read instead.'); }
            else {
                const data = await res.json();
                render(data);
                setStatus('', '');
                if (T.trackEvent) T.trackEvent('advisor_analyze', { page: location.pathname, inputs: tests.length });
            }
        } catch (err) {
            clearTimeout(timer);
            if (err && err.name === 'AbortError') localFallback('The live reviewer took too long — here\'s a quick checklist read instead.');
            else localFallback("Couldn't reach the live reviewer — here's a quick checklist read instead.");
        } finally {
            analyzeBtn.disabled = false; analyzeBtn.textContent = orig;
            if (window.turnstile && window.turnstile.reset) { try { window.turnstile.reset(); } catch (e) {} }
        }
    });
})();
