/* "Who should do this job?" — augmented intelligence made obvious by doing it.
 *
 * Maria owes the board a report on 400 patient comments. ONE continuous choice:
 * how much of that reading she hands to the AI (0% = all herself, 100% = all the AI).
 * A second choice: does she still REVIEW the AI's work before it ships?
 *
 * Speed climbs as the AI does more. Got-it-right stays high while Maria reads —
 * or while she reviews the AI — but COLLAPSES toward the 100%-AI end when nobody
 * is checking. Plot both on a speed x trustworthiness chart so the trade-off is
 * a shape you can see, and a sentence + payoff that recompute as you drag.
 *
 * External module (CSP script-src 'self'); progressive-enhanced; pointer + keyboard;
 * reduced-motion respected via CSS. No inline JS anywhere.
 */
(function () {
    "use strict";
    var root = document.getElementById('job-split');
    if (!root) return;

    var slider   = root.querySelector('[id="js-hand"]');
    var handOut  = root.querySelector('[data-handval]');
    var review   = root.querySelector('[data-review]');
    var reviewLabel = review ? review.closest('.js-check') : null;
    var speedFill = root.querySelector('[data-speed-fill]');
    var speedNum  = root.querySelector('[data-speed-num]');
    var trustFill = root.querySelector('[data-trust-fill]');
    var trustNum  = root.querySelector('[data-trust-num]');
    var chart     = root.querySelector('[data-chart]');
    var sentence  = root.querySelector('[data-sentence]');
    var payoffEl  = root.querySelector('[data-payoff]');
    if (!slider || !chart) return; // keep the noscript fallback

    var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

    /* ---- the model -------------------------------------------------------
     * h    = fraction of the 400 comments handed to the AI (0..1)
     * rev  = Maria reviews the AI's output before it ships (boolean)
     *
     * speed: 14 (Maria alone, a full day) -> 100 (instant). Reviewing the AI
     *   costs a little time, so the reviewed line is a touch lower but still fast.
     * trust: 100 while Maria does the reading herself. The AI's raw work is only
     *   ~34 right (it confidently mislabels). Reviewed, Maria catches almost all
     *   of that, so trust stays high across the middle. Unreviewed, trust slides
     *   down toward the AI's raw 34 as the AI does more — nobody is checking.
     */
    var AI_RAW = 34;          // got-it-right if the AI's output ships unchecked
    var MARIA  = 100;         // got-it-right when a person reads/judges it
    var REVIEW_CATCH = 0.93;  // share of AI mistakes Maria catches when reviewing

    function speedOf(h, rev) {
        var base = 14 + 86 * h;               // more to the AI => faster
        if (rev) base -= 16 * h;              // reviewing the AI's share costs time
        return clamp(base, 0, 100);
    }
    function trustOf(h, rev) {
        // the share Maria still reads herself is always right; the AI's share is the risk
        var aiShare = h;
        var aiQuality = rev ? AI_RAW + (MARIA - AI_RAW) * REVIEW_CATCH : AI_RAW;
        var t = (1 - aiShare) * MARIA + aiShare * aiQuality;
        return clamp(t, 0, 100);
    }

    function speedWord(s) { return s < 30 ? 'a full day' : s < 55 ? 'an afternoon' : s < 80 ? 'about an hour' : '2 minutes'; }
    function trustWord(t) { return t >= 92 ? 'spot on' : t >= 72 ? 'solid' : t >= 52 ? 'shaky' : 'wrong'; }

    // The sweet spot: AI carries real volume AND a person is still in the loop.
    function inSweetSpot(h, rev) {
        return rev && h >= 0.40 && h <= 0.80 && trustOf(h, rev) >= 80 && speedOf(h, rev) >= 55;
    }

    /* ---- chart: x = speed, y = got-it-right (up = better) ----------------
     * We draw BOTH trade-off curves (reviewed vs unchecked) so the shape of the
     * choice is visible at a glance, shade the sweet-spot region, then plot "you".
     */
    var W = 620, H = 320, L = 56, R = 22, T = 24, B = 46;
    var pw = W - L - R, ph = H - T - B;
    var X = function (s) { return L + (s / 100) * pw; };          // speed 0..100
    var Y = function (t) { return T + ph * (1 - t / 100); };      // trust 0..100

    function curve(rev) {
        var d = '';
        for (var i = 0; i <= 40; i++) {
            var h = i / 40;
            d += (d ? 'L' : 'M') + X(speedOf(h, rev)).toFixed(1) + ' ' + Y(trustOf(h, rev)).toFixed(1) + ' ';
        }
        return d;
    }

    function drawChart(h, rev) {
        var s = '';
        // grid
        var g;
        for (g = 0; g <= 100; g += 25) {
            s += '<line x1="' + X(g).toFixed(1) + '" y1="' + T + '" x2="' + X(g).toFixed(1) + '" y2="' + (T + ph) + '" stroke="var(--color-border)"/>';
            s += '<line x1="' + L + '" y1="' + Y(g).toFixed(1) + '" x2="' + (W - R) + '" y2="' + Y(g).toFixed(1) + '" stroke="var(--color-border)"/>';
        }
        // axis labels
        s += '<text x="' + X(50).toFixed(1) + '" y="' + (T + ph + 34) + '" font-size="12" text-anchor="middle" fill="var(--color-fg)">Speed (throughput) →</text>';
        s += '<text x="16" y="' + (T + ph / 2).toFixed(1) + '" font-size="12" text-anchor="middle" fill="var(--color-fg)" transform="rotate(-90 16 ' + (T + ph / 2).toFixed(1) + ')">Got it right →</text>';
        s += '<text x="' + (L - 8) + '" y="' + (Y(100) + 4).toFixed(1) + '" font-size="9.5" text-anchor="end" fill="var(--color-muted)">100%</text>';
        s += '<text x="' + (L - 8) + '" y="' + (Y(0) - 2).toFixed(1) + '" font-size="9.5" text-anchor="end" fill="var(--color-muted)">0%</text>';

        // sweet-spot region (top-right-ish: fast AND right)
        var sx = X(speedOf(0.40, true)), sx2 = X(speedOf(0.80, true));
        var syTop = Y(100), syBot = Y(78);
        s += '<rect x="' + Math.min(sx, sx2).toFixed(1) + '" y="' + syTop.toFixed(1) + '" width="' + Math.abs(sx2 - sx).toFixed(1) +
             '" height="' + (syBot - syTop).toFixed(1) + '" rx="8" fill="var(--color-accent)" opacity="0.12" stroke="var(--color-accent)" stroke-dasharray="5 4"/>';
        s += '<text x="' + ((sx + sx2) / 2).toFixed(1) + '" y="' + (syTop - 7).toFixed(1) + '" font-size="10.5" text-anchor="middle" font-weight="700" fill="var(--color-accent)">the sweet spot</text>';

        // the two trade-off curves
        s += '<path d="' + curve(true) + '" fill="none" stroke="var(--color-accent)" stroke-width="2.4" opacity="0.9"/>';
        s += '<path d="' + curve(false) + '" fill="none" stroke="var(--color-error)" stroke-width="2" stroke-dasharray="5 4" opacity="0.75"/>';

        // anchor labels on the two ends so the extremes are named
        s += '<text x="' + (X(14) + 8).toFixed(1) + '" y="' + (Y(100) + 4).toFixed(1) + '" font-size="9.5" fill="var(--color-muted)">Maria alone</text>';
        s += '<text x="' + (X(100) - 4).toFixed(1) + '" y="' + (Y(AI_RAW) + 4).toFixed(1) + '" font-size="9.5" text-anchor="end" fill="var(--color-error)">AI alone, unchecked</text>';

        // legend
        s += '<g font-size="9.5">' +
             '<line x1="' + (L + 6) + '" y1="' + (T + 12) + '" x2="' + (L + 28) + '" y2="' + (T + 12) + '" stroke="var(--color-accent)" stroke-width="2.4"/>' +
             '<text x="' + (L + 33) + '" y="' + (T + 15) + '" fill="var(--color-muted)">reviewed</text>' +
             '<line x1="' + (L + 96) + '" y1="' + (T + 12) + '" x2="' + (L + 118) + '" y2="' + (T + 12) + '" stroke="var(--color-error)" stroke-width="2" stroke-dasharray="5 4"/>' +
             '<text x="' + (L + 123) + '" y="' + (T + 15) + '" fill="var(--color-muted)">unchecked</text></g>';

        // current "you" point
        var cx = X(speedOf(h, rev)), cy = Y(trustOf(h, rev));
        var pColor = inSweetSpot(h, rev) ? 'var(--color-accent)' : (rev ? 'var(--color-fg)' : 'var(--color-error)');
        s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="8" fill="' + pColor + '" stroke="var(--color-bg)" stroke-width="2"/>';
        s += '<text x="' + cx.toFixed(1) + '" y="' + (cy - 13).toFixed(1) + '" font-size="10" text-anchor="middle" font-weight="700" fill="' + pColor + '">you</text>';

        chart.innerHTML = s;
    }

    /* ---- reactive prose --------------------------------------------------- */
    function sentenceFor(h, rev) {
        var pct = Math.round(h * 100);
        if (pct === 0) {
            return 'At <strong>0% to the AI</strong>, Maria reads all 400 comments herself: spot-on, but it eats the whole day.';
        }
        if (pct === 100 && !rev) {
            return 'At <strong>100% to the AI with no one checking</strong>, the report is done in 2 minutes — but the AI’s confident mislabels ship straight to the board. Fast, and <strong>wrong</strong>.';
        }
        if (pct === 100 && rev) {
            return 'The AI does <strong>everything</strong> and Maria reviews all of it. Fast and right — but she’s now checking 400 machine guesses by hand, which is slower than letting it carry just the bulk.';
        }
        if (!rev) {
            return 'You’ve handed <strong>' + pct + '%</strong> to the AI with <strong>no one reviewing</strong>. Each point you give it, its uncaught mistakes seep into the report — watch “got it right” slide down the red line.';
        }
        if (inSweetSpot(h, rev)) {
            return 'At <strong>~' + pct + '% to the AI, with you reviewing</strong>, you’re fast <strong>and</strong> right — the AI sorts the bulk, Maria catches its mislabels and makes the call. <strong>That sweet spot in the middle is augmented intelligence.</strong>';
        }
        return 'You’ve handed <strong>' + pct + '%</strong> to the AI and you’re still reviewing it, so it stays trustworthy. Push a little more onto the AI to pick up speed without losing your grip.';
    }

    var payoffShown = false;
    function maybePayoff(h, rev) {
        if (payoffShown || !payoffEl) return;
        if (inSweetSpot(h, rev)) {
            payoffShown = true;
            payoffEl.innerHTML = '<strong>That’s it — you found it.</strong> Neither end of the slider wins: Maria alone is right but buried; the AI alone is fast but unchecked. ' +
                'The peak is in the <strong>middle, with a person still in the loop</strong>. The machine handles the volume; you keep the judgment. That pairing — not the AI, not you, but both — is augmented intelligence.';
            payoffEl.hidden = false;
        }
    }

    /* ---- render ----------------------------------------------------------- */
    function render() {
        var h = clamp(parseInt(slider.value, 10) || 0, 0, 100) / 100;
        var rev = !!(review && review.checked);
        var pct = Math.round(h * 100);
        var sp = speedOf(h, rev), tr = trustOf(h, rev);

        if (handOut) handOut.textContent = pct + '%';
        slider.setAttribute('aria-valuetext',
            pct === 0 ? '0% to the AI — Maria does it all herself'
            : pct + '% to the AI' + (rev ? ', reviewed by Maria' : ', not reviewed') +
              '. Speed ' + Math.round(sp) + ' of 100, got it right ' + Math.round(tr) + ' of 100.');

        if (speedFill) speedFill.style.width = sp.toFixed(0) + '%';
        if (speedNum) speedNum.textContent = speedWord(sp);
        if (trustFill) {
            trustFill.style.width = tr.toFixed(0) + '%';
            trustFill.classList.toggle('is-low', tr < 55);
        }
        if (trustNum) trustNum.textContent = trustWord(tr);

        // the review toggle is moot at 0% (Maria's doing it all anyway)
        if (reviewLabel) reviewLabel.classList.toggle('is-moot', pct === 0);

        drawChart(h, rev);
        if (sentence) sentence.innerHTML = sentenceFor(h, rev);
        maybePayoff(h, rev);
        root.setAttribute('data-hand', String(pct));
    }

    slider.addEventListener('input', render);
    if (review) review.addEventListener('change', render);

    /* ---- direct manipulation on the chart -------------------------------
     * Drag the "you" dot left/right: its x maps to speed, which we invert back
     * to a hand fraction and write to the real slider (keeping one source of
     * truth + keyboard support). Pointer + touch via setPointerCapture.
     */
    function speedToHand(sp, rev) {
        // invert speedOf: base = 14 + 86h - (rev?16h:0)  => sp = 14 + (rev?70:86)h
        var slope = rev ? 70 : 86;
        return clamp((sp - 14) / slope, 0, 1);
    }
    function chartXToSpeed(clientX) {
        var pt = chart.createSVGPoint();
        pt.x = clientX; pt.y = 0;
        var lx = pt.matrixTransform(chart.getScreenCTM().inverse()).x;
        return clamp(((lx - L) / pw) * 100, 0, 100);
    }
    var dragging = false;
    function dragTo(clientX) {
        var rev = !!(review && review.checked);
        var sp = chartXToSpeed(clientX);
        var h = speedToHand(sp, rev);
        slider.value = String(Math.round(h * 100));
        render();
    }
    chart.addEventListener('pointerdown', function (e) {
        dragging = true;
        try { chart.setPointerCapture(e.pointerId); } catch (err) {}
        dragTo(e.clientX);
        e.preventDefault();
    });
    chart.addEventListener('pointermove', function (e) { if (dragging) dragTo(e.clientX); });
    chart.addEventListener('pointerup', function () { dragging = false; });
    chart.addEventListener('pointercancel', function () { dragging = false; });

    render(); // start at "Maria alone" so dragging tells the story
})();
