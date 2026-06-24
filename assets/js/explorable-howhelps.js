/* "Three ways it helps" explorable — a real little model of each help-mode.
 *
 * Three modes (speed / offload / think-with-you). For each, pick a kind of work
 * (writing / admin / planning), then DRAG how much you lean on AI. A live SVG bar
 * splits the task into "AI carries the effort" (grows) and "the part only you can
 * do" (a floor it can never cross). The prose, the hours reclaimed, and the closing
 * insight all recompute live. The payoff you can't miss: lean as hard as you like —
 * the green never swallows the bit that's yours.
 *
 * CSP-safe external module (script-src 'self'); progressive enhancement — the static
 * markup states the idea if JS never runs. Pointer + keyboard accessible.
 */
(function () {
    "use strict";
    const root = document.getElementById('how-helps');
    if (!root) return;

    // --- model -------------------------------------------------------------
    // Each mode × work-kind is a task: total hours, the irreducible human core
    // (the part AI can't take, as a fraction of total), and what you get back.
    // `lean` (0..1) sets how much of the *takeable* effort AI carries.
    const MODES = {
        speed: {
            label: 'Speed it up',
            verb: 'AI carries the effort',
            tasks: {
                writing: {
                    name: 'the monthly report',
                    total: 4.5, core: 0.18,
                    slog: 'starting from a blank page, drafting, wording it',
                    yours: 'the angle and the final wording',
                    back: 'thinking about what the report should actually say',
                },
                admin: {
                    name: 'this week’s expense write-up',
                    total: 3, core: 0.12,
                    slog: 'copying figures, formatting, chasing the layout',
                    yours: 'the call on anything that looks off',
                    back: 'the work that actually needed a person',
                },
                planning: {
                    name: 'the project kick-off doc',
                    total: 5, core: 0.22,
                    slog: 'pulling the structure together from nothing',
                    yours: 'the priorities and the trade-offs',
                    back: 'the decisions only you can make',
                },
            },
            insight: 'Same job, far less slog. AI does the heavy lifting at the start; you spend the time you got back on the thinking that makes it good.',
        },
        boring: {
            label: 'Take the boring jobs',
            verb: 'AI does the repetitive part',
            tasks: {
                writing: {
                    name: 'tidying 40 messy notes',
                    total: 2.5, core: 0.1,
                    slog: 'fixing each one by hand, over and over',
                    yours: 'a quick spot-check of the odd ones',
                    back: 'the writing that needed your voice',
                },
                admin: {
                    name: 'sorting 200 receipts',
                    total: 3.5, core: 0.08,
                    slog: 'sorting and categorising them one by one',
                    yours: 'a glance over the few it flagged',
                    back: 'anything that actually needs judgment',
                },
                planning: {
                    name: 'collating 12 status updates',
                    total: 2, core: 0.14,
                    slog: 'gathering and lining them all up',
                    yours: 'deciding what matters in the pile',
                    back: 'reading the situation, not assembling it',
                },
            },
            insight: 'The dull, repetitive part is exactly what AI is happiest doing. You keep the spot-check and skip the grind entirely.',
        },
        think: {
            label: 'Think it through with you',
            verb: 'AI offers angles to react to',
            tasks: {
                writing: {
                    name: 'an argument you’re stuck on',
                    total: 3, core: 0.55,
                    slog: 'staring at a blank page for an opening',
                    yours: 'which angle is actually right',
                    back: 'shaping the one that fits, not finding a start',
                },
                admin: {
                    name: 'an awkward email you’re avoiding',
                    total: 1.5, core: 0.45,
                    slog: 'circling the same three sentences',
                    yours: 'the tone and what you really mean',
                    back: 'getting it sent, then moving on',
                },
                planning: {
                    name: 'a plan you can’t see clearly yet',
                    total: 4, core: 0.6,
                    slog: 'going round in circles on your own',
                    yours: 'the judgment about which way is right',
                    back: 'choosing well, with options in front of you',
                },
            },
            insight: 'Here AI is a thinking partner, not a worker. It hands you angles to push against — and the judgment about which is right stays firmly yours.',
        },
    };
    const KINDS = ['writing', 'admin', 'planning'];
    const KIND_LABEL = { writing: 'Writing', admin: 'Admin', planning: 'Planning' };

    // --- elements ----------------------------------------------------------
    const modeBtns = Array.prototype.slice.call(root.querySelectorAll('[data-mode]'));
    const kindBtns = Array.prototype.slice.call(root.querySelectorAll('[data-kind]'));
    const slider = root.querySelector('[data-lean]');
    const svg = root.querySelector('[data-chart]');
    const leanOut = root.querySelector('[data-lean-out]');
    const proseEl = root.querySelector('[data-prose]');
    const reclaimEl = root.querySelector('[data-reclaim]');
    const insightEl = root.querySelector('[data-insight]');
    if (!modeBtns.length || !slider || !svg) return;

    // --- state -------------------------------------------------------------
    let mode = 'speed';
    let kind = 'writing';
    let lean = 0.7;                 // 0..1, how much of the takeable effort AI carries
    const explored = {};           // per mode: have they pushed the lean near its floor?

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    function fmtH(h) {
        // friendly hours/minutes
        if (h >= 0.95) {
            const r = Math.round(h * 2) / 2;
            return (r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)) + 'h';
        }
        return Math.round(h * 60) + ' min';
    }

    function task() { return MODES[mode].tasks[kind]; }

    // What the model computes from (mode, kind, lean):
    //   coreH   = irreducible human hours (the floor — AI never crosses it)
    //   aiH     = effort AI carries this lean setting
    //   youH    = the slog you still do yourself (shrinks as lean rises)
    function compute() {
        const t = task();
        const coreH = t.total * t.core;          // the part only you can do
        const takeable = t.total - coreH;        // everything AI *could* take
        const aiH = takeable * lean;             // what it actually takes at this lean
        const youH = t.total - aiH;              // your remaining time (= core + leftover slog)
        const leftoverSlog = youH - coreH;       // slog still on you (>=0)
        return { coreH, takeable, aiH, youH, leftoverSlog, total: t.total };
    }

    // --- SVG chart ---------------------------------------------------------
    // A single horizontal bar = the whole task. Left segment (accent) = effort AI
    // carries. Right segment (muted) = your time. A dashed line marks the floor —
    // the irreducible core AI can never cross. A draggable handle sets the lean.
    const VW = 620, VH = 132;            // viewBox
    const PAD_L = 14, PAD_R = 14, BAR_Y = 52, BAR_H = 40;
    const barW = VW - PAD_L - PAD_R;
    const X = frac => PAD_L + frac * barW;     // 0..1 of the bar -> px

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function drawChart() {
        const c = compute();
        const aiFrac = c.aiH / c.total;          // 0..1 width of AI segment
        const floorFrac = c.takeable / c.total;  // AI can fill at most up to here
        const fx = X(aiFrac);
        const flx = X(floorFrac);

        let s = '';
        // track background (your-side colour, the whole task)
        s += `<rect x="${PAD_L}" y="${BAR_Y}" width="${barW}" height="${BAR_H}" rx="10" `
            + `fill="var(--hh-you)"/>`;
        // AI segment — grows from the left as you lean in
        if (aiFrac > 0.002) {
            s += `<rect x="${PAD_L}" y="${BAR_Y}" width="${(fx - PAD_L).toFixed(1)}" height="${BAR_H}" rx="10" `
                + `fill="var(--hh-ai)" class="hh-aiseg"/>`;
        }
        // the floor — a hard line AI cannot cross. Everything to its RIGHT is yours, always.
        s += `<line x1="${flx.toFixed(1)}" y1="${BAR_Y - 9}" x2="${flx.toFixed(1)}" y2="${BAR_Y + BAR_H + 9}" `
            + `stroke="var(--hh-floor)" stroke-width="2" stroke-dasharray="3 3"/>`;
        s += `<text x="${flx.toFixed(1)}" y="${BAR_Y + BAR_H + 24}" text-anchor="middle" `
            + `font-size="11" fill="var(--hh-floor)" font-weight="700">only you can do this →</text>`;

        // segment labels (in-bar when wide enough, else above)
        const aiPx = fx - PAD_L;
        const aiLabel = `${esc(MODES[mode].verb)} · ${fmtH(c.aiH)}`;
        if (aiPx > 150) {
            s += `<text x="${(PAD_L + 12).toFixed(1)}" y="${BAR_Y + 25}" font-size="13" font-weight="700" `
                + `fill="var(--hh-ai-ink)">${aiLabel}</text>`;
        } else if (c.aiH > 0.01) {
            s += `<text x="${PAD_L}" y="${BAR_Y - 12}" font-size="12" font-weight="700" `
                + `fill="var(--hh-ai)">${aiLabel}</text>`;
        }
        // your-time label, right-aligned inside the your segment
        const youPx = X(1) - fx;
        const youLabel = `your time · ${fmtH(c.youH)}`;
        if (youPx > 130) {
            s += `<text x="${(X(1) - 12).toFixed(1)}" y="${BAR_Y + 25}" text-anchor="end" font-size="13" `
                + `font-weight="700" fill="var(--hh-you-ink)">${esc(youLabel)}</text>`;
        }

        // draggable handle = the boundary between AI and you
        const hx = clamp(fx, X(0.0), X(floorFrac));
        s += `<g class="hh-handle" tabindex="0" role="slider" `
            + `aria-label="How much you lean on AI for this" aria-valuemin="0" aria-valuemax="100" `
            + `aria-valuenow="${Math.round(lean * 100)}" aria-valuetext="${Math.round(lean * 100)}% — AI carries ${fmtH(c.aiH)}" `
            + `style="cursor:ew-resize;touch-action:none">`
            + `<line x1="${hx.toFixed(1)}" y1="${BAR_Y - 5}" x2="${hx.toFixed(1)}" y2="${BAR_Y + BAR_H + 5}" stroke="var(--hh-edge)" stroke-width="3"/>`
            + `<circle cx="${hx.toFixed(1)}" cy="${BAR_Y + BAR_H / 2}" r="11" fill="var(--hh-edge)"/>`
            + `<path d="M${(hx - 4).toFixed(1)} ${BAR_Y + BAR_H / 2 - 4} l-3 4 l3 4 M${(hx + 4).toFixed(1)} ${BAR_Y + BAR_H / 2 - 4} l3 4 l-3 4" `
            + `stroke="var(--hh-edge-ink)" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
            + `</g>`;

        // caption above the bar
        s += `<text x="${PAD_L}" y="22" font-size="12.5" fill="var(--hh-mut)">`
            + `${esc(task().name)} — about ${fmtH(c.total)} on your own</text>`;
        s += `<text x="${(VW - PAD_R).toFixed(1)}" y="22" text-anchor="end" font-size="12.5" fill="var(--hh-mut)">`
            + `drag ◀▶</text>`;

        svg.innerHTML = s;
    }

    // --- reactive prose ----------------------------------------------------
    function render() {
        const c = compute();
        const t = task();

        // slider position label
        if (leanOut) leanOut.textContent = Math.round(lean * 100) + '%';
        slider.setAttribute('aria-valuetext',
            Math.round(lean * 100) + '% — AI carries ' + fmtH(c.aiH) + ' of ' + fmtH(c.total));

        // big live number: hours reclaimed
        if (reclaimEl) reclaimEl.textContent = fmtH(c.aiH);

        // the sentence recomputes from the numbers above — nothing is fixed text
        if (proseEl) {
            const reclaimTxt = `<b>${fmtH(c.aiH)}</b>`;
            let lead;
            if (lean < 0.08) {
                lead = `Right now you’re doing <b>${esc(t.name)}</b> entirely yourself — about `
                    + `<b>${fmtH(c.total)}</b> of ${esc(t.slog)}. <b>Drag the handle</b> to lean on AI.`;
            } else {
                // verb strings start with "AI " — drop it so the mid-sentence form reads naturally
                const verbLower = MODES[mode].verb.replace(/^AI\s+/i, '').toLowerCase();
                lead = `Lean in and AI ${esc(verbLower)} — you reclaim about ${reclaimTxt} of `
                    + `${esc(t.slog)}, and spend it on ${esc(t.back)}.`;
            }
            const floor = `The part that stays yours — <b>${esc(t.yours)}</b>, about <b>${fmtH(c.coreH)}</b> — `
                + `is the bit past the dashed line. <b>AI never crosses it</b>, however hard you lean.`;
            proseEl.innerHTML = `<span class="hh-lead">${lead}</span> <span class="hh-floor-note">${floor}</span>`;
        }

        // closing insight: appears once you've actually pushed toward the floor
        if (lean > 0.82) explored[mode] = true;
        if (insightEl) {
            if (explored[mode]) {
                insightEl.classList.add('is-lit');
                insightEl.innerHTML = `<span class="hh-ins-lbl">The point</span>${esc(MODES[mode].insight)}`;
            } else {
                insightEl.classList.remove('is-lit');
                insightEl.innerHTML = `<span class="hh-ins-lbl">Push the handle as far as it goes</span>`
                    + `Watch where the green stops — that wall is the part only you can do. Find it and the takeaway lands.`;
            }
        }

        drawChart();
    }

    // --- mode / kind toggles ----------------------------------------------
    function setMode(m) {
        if (!MODES[m]) return;
        mode = m;
        modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
        root.setAttribute('data-mode', m);
        render();
    }
    function setKind(k) {
        if (KINDS.indexOf(k) < 0) return;
        kind = k;
        kindBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === k)));
        render();
    }
    modeBtns.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    kindBtns.forEach(b => b.addEventListener('click', () => setKind(b.dataset.kind)));

    // --- slider (real <input type=range>, keyboard accessible) -------------
    slider.addEventListener('input', () => {
        lean = clamp((+slider.value || 0) / 100, 0, 1);
        render();
    });

    // --- direct manipulation on the SVG handle -----------------------------
    // Drag anywhere on the bar to set the lean; keyboard arrows on the handle too.
    function svgFracFromClient(clientX) {
        const pt = svg.createSVGPoint();
        pt.x = clientX; pt.y = 0;
        const local = pt.matrixTransform(svg.getScreenCTM().inverse());
        return clamp((local.x - PAD_L) / barW, 0, 1);
    }
    function leanFromHandleFrac(frac) {
        // handle moves between 0 and the floor (takeable fraction); map back to lean 0..1
        const t = task();
        const floorFrac = (t.total - t.total * t.core) / t.total; // = takeable/total
        if (floorFrac <= 0) return 0;
        return clamp(frac / floorFrac, 0, 1);
    }
    function syncSlider() { slider.value = String(Math.round(lean * 100)); }

    let dragging = false, activePointer = null;
    function pointAt(clientX) {
        lean = leanFromHandleFrac(svgFracFromClient(clientX));
        syncSlider();
        render();
    }
    svg.addEventListener('pointerdown', e => {
        // ignore right-clicks
        if (e.button && e.button !== 0) return;
        dragging = true; activePointer = e.pointerId;
        try { svg.setPointerCapture(e.pointerId); } catch (_) { }
        pointAt(e.clientX);
        // move keyboard focus to the handle for arrow-key follow-up
        const h = svg.querySelector('.hh-handle');
        if (h && h.focus) { try { h.focus({ preventScroll: true }); } catch (_) { h.focus(); } }
        e.preventDefault();
    });
    svg.addEventListener('pointermove', e => {
        if (!dragging || e.pointerId !== activePointer) return;
        pointAt(e.clientX);
    });
    function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        try { svg.releasePointerCapture(e.pointerId); } catch (_) { }
    }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    // keyboard on the SVG handle (it's re-created each render, so delegate)
    svg.addEventListener('keydown', e => {
        if (!e.target.closest('.hh-handle')) return;
        const STEP = 0.05;
        let handled = true;
        switch (e.key) {
            case 'ArrowRight': case 'ArrowUp': lean = clamp(lean + STEP, 0, 1); break;
            case 'ArrowLeft': case 'ArrowDown': lean = clamp(lean - STEP, 0, 1); break;
            case 'PageUp': lean = clamp(lean + STEP * 3, 0, 1); break;
            case 'PageDown': lean = clamp(lean - STEP * 3, 0, 1); break;
            case 'Home': lean = 0; break;
            case 'End': lean = 1; break;
            default: handled = false;
        }
        if (handled) {
            e.preventDefault();
            syncSlider();
            render();
            // keep focus on the (re-rendered) handle
            const h = svg.querySelector('.hh-handle');
            if (h && h.focus) { try { h.focus({ preventScroll: true }); } catch (_) { h.focus(); } }
        }
    });

    // --- init --------------------------------------------------------------
    slider.value = String(Math.round(lean * 100));
    setKind('writing');
    setMode('speed');   // calls render()
})();
