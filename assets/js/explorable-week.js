/* "Your week, reshaped" — an explorable, Bret-Victor style.
 *
 * A real week drawn as a grid of hour-blocks (5 weekday columns). Some blocks are
 * BUSYWORK (you can hand them to the AI — click, drag across them, or arrow+Enter);
 * when handed over they recolour from "busywork" to "reclaimed — yours". Other blocks
 * are HUMAN-ONLY: the people, the deciding, the final call — these can NEVER be handed
 * over, and the figure says so out loud. A live reclaimed-hours counter, a "% of your
 * week" readout, and a caption that recomputes as you go. When you clear Thursday
 * morning, the payoff lands: that block is now free for the thing only you can do.
 *
 * CSP-safe (all behaviour here, no inline JS), progressive (HTML shows the idea with
 * no JS), pointer + keyboard accessible, motion gated behind prefers-reduced-motion.
 */
(function () {
    'use strict';

    var root = document.getElementById('your-week');
    if (!root) return;

    var svgEl = root.querySelector('[data-week-grid]');
    var hoursEl = root.querySelector('[data-hours-back]');
    var pctEl = root.querySelector('[data-week-pct]');
    var capEl = root.querySelector('[data-week-caption]');
    var liveEl = root.querySelector('[data-week-live]');
    var resetEl = root.querySelector('[data-week-reset]');
    if (!svgEl) return;

    var SVGNS = 'http://www.w3.org/2000/svg';

    /* ---- The week. Each cell is one hour. -----------------------------------
       type:
         'busy'  — repetitive busywork you can hand to the AI (the only handable kind)
         'human' — the part that needs a person; can NEVER be handed over
         'free'  — already free / lunch (inert backdrop)
       The Thursday-morning busywork blocks are tagged so we can spot the payoff. */
    var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    var START_HOUR = 9;          // 9am
    var ROWS = 8;                // 9am..5pm, one block per hour
    var LUNCH_ROW = 3;           // the 12pm row reads as lunch

    // grid[col][row]; built from a compact spec so it's easy to read/tune.
    // b = busywork, h = human-only, f = free/lunch. Labels added for the human ones.
    var SPEC = [
        // Mon            Tue            Wed            Thu            Fri
        ['b', 'b', 'b', 'b', 'b'], // 9am  — inbox / admin
        ['b', 'h', 'b', 'b', 'h'], // 10am
        ['h', 'h', 'b', 'b', 'h'], // 11am
        ['f', 'f', 'f', 'f', 'f'], // 12pm — lunch
        ['b', 'b', 'h', 'h', 'b'], // 1pm
        ['b', 'h', 'h', 'h', 'b'], // 2pm
        ['h', 'b', 'b', 'h', 'b'], // 3pm
        ['b', 'b', 'b', 'b', 'b']  // 4pm
    ];
    // Which human blocks carry an out-loud label (the lesson: what stays yours).
    var HUMAN_LABELS = {
        '1,1': 'talk', '2,1': 'talk',   // Tue 10–11 mentoring
        '4,2': 'decide', '4,3': 'decide', '4,4': 'decide', // Thu afternoon: the call
        '2,4': 'talk', '2,5': 'talk'    // Wed afternoon people time
    };

    // Build cell objects. Short codes map to full type names used throughout.
    var TYPE = { b: 'busy', h: 'human', f: 'free' };
    var cells = [];
    for (var c = 0; c < DAYS.length; c++) {
        for (var r = 0; r < ROWS; r++) {
            var code = SPEC[r][c];
            if (r === LUNCH_ROW) code = 'f';
            cells.push({
                col: c, row: r, type: TYPE[code] || 'free',
                given: false,                       // handed to AI?
                label: HUMAN_LABELS[c + ',' + r] || null,
                hour: START_HOUR + r
            });
        }
    }
    function cellAt(col, row) {
        for (var i = 0; i < cells.length; i++) if (cells[i].col === col && cells[i].row === row) return cells[i];
        return null;
    }

    var TOTAL_BUSY = cells.filter(function (x) { return x.type === 'busy'; }).length;
    var WORK_HOURS = cells.filter(function (x) { return x.type !== 'free'; }).length; // your working week

    // Thursday = column index 3; "morning" = rows above lunch.
    var THU = 3;
    var thuMorningBusy = cells.filter(function (x) { return x.col === THU && x.row < LUNCH_ROW && x.type === 'busy'; });

    /* ---- Geometry ---------------------------------------------------------- */
    var PAD_L = 78, PAD_T = 34, PAD_R = 14, PAD_B = 14;
    var GAP = 6;
    var CW = 96, CH = 40;        // cell footprint (incl. gap handled in layout)
    var VW = PAD_L + DAYS.length * CW + PAD_R;
    var VH = PAD_T + ROWS * CH + PAD_B;
    svgEl.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH);

    function cellX(col) { return PAD_L + col * CW; }
    function cellY(row) { return PAD_T + row * CH; }

    function el(name, attrs) {
        var n = document.createElementNS(SVGNS, name);
        if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
        return n;
    }

    function hourLabel(row) {
        var h = START_HOUR + row;
        if (row === LUNCH_ROW) return 'lunch';
        var ampm = h < 12 ? 'am' : 'pm';
        var hh = h <= 12 ? h : h - 12;
        return hh + ampm;
    }

    /* ---- Build the static chrome (axes, day labels) once -------------------- */
    function buildChrome() {
        // day headers
        for (var c = 0; c < DAYS.length; c++) {
            var tx = el('text', {
                x: cellX(c) + (CW - GAP) / 2, y: PAD_T - 12,
                'text-anchor': 'middle', 'font-size': 13, fill: 'var(--color-fg)',
                'font-weight': 700
            });
            tx.textContent = DAYS[c];
            tx.setAttribute('class', 'yw-day' + (c === THU ? ' yw-day--thu' : ''));
            svgEl.appendChild(tx);
        }
        // hour labels (left axis)
        for (var r = 0; r < ROWS; r++) {
            var ty = el('text', {
                x: PAD_L - 12, y: cellY(r) + (CH - GAP) / 2 + 4,
                'text-anchor': 'end', 'font-size': 11, fill: 'var(--color-muted)'
            });
            ty.textContent = hourLabel(r);
            svgEl.appendChild(ty);
        }
    }

    /* ---- Build interactive cells ------------------------------------------- */
    // Keep a render handle on each cell.
    var focusIndex = -1; // index into `handable` for keyboard roving focus

    function makeCell(cell) {
        var x = cellX(cell.col), y = cellY(cell.row);
        var w = CW - GAP, h = CH - GAP;
        var g = el('g', { transform: 'translate(' + x + ',' + y + ')', 'class': 'yw-cell yw-cell--' + cell.type });
        var rect = el('rect', { x: 0, y: 0, width: w, height: h, rx: 7, 'class': 'yw-rect' });
        g.appendChild(rect);

        var label = el('text', {
            x: w / 2, y: h / 2 + 4, 'text-anchor': 'middle', 'font-size': 10.5,
            'class': 'yw-label', 'pointer-events': 'none'
        });
        g.appendChild(label);

        if (cell.type === 'busy') {
            g.setAttribute('tabindex', '-1');
            g.setAttribute('role', 'button');
            g.style.cursor = 'pointer';
            g.style.touchAction = 'none';
        } else if (cell.type === 'human') {
            // a small lock mark so the "never handable" rule is visible, not just colour
            g.setAttribute('aria-hidden', 'true');
            var lock = el('text', {
                x: w - 10, y: 14, 'text-anchor': 'middle', 'font-size': 10,
                'class': 'yw-lock', 'pointer-events': 'none'
            });
            lock.textContent = '●'; // solid dot marker; styled, never relies on emoji
            g.appendChild(lock);
        } else {
            g.setAttribute('aria-hidden', 'true');
        }

        cell.g = g; cell.rect = rect; cell.labelEl = label;
        svgEl.appendChild(g);
        return g;
    }

    buildChrome();
    cells.forEach(makeCell);

    // The list of handable (busywork) cells, in reading order, for keyboard nav.
    var handable = cells.filter(function (x) { return x.type === 'busy'; });

    /* ---- Per-cell visual state -------------------------------------------- */
    function paintCell(cell) {
        var g = cell.g, lab = cell.labelEl;
        if (cell.type === 'busy') {
            g.setAttribute('class', 'yw-cell yw-cell--busy' + (cell.given ? ' is-given' : ''));
            lab.textContent = cell.given ? 'yours' : 'busywork';
            g.setAttribute('aria-pressed', String(cell.given));
            g.setAttribute('aria-label',
                hourLabel(cell.row) + ' ' + DAYS[cell.col] + ': ' +
                (cell.given ? 'reclaimed — handed to AI. Press Enter to take it back.'
                            : 'busywork. Press Enter to hand it to the AI.'));
        } else if (cell.type === 'human') {
            lab.textContent = cell.label || 'yours';
            lab.setAttribute('class', 'yw-label yw-label--human');
        } else {
            lab.textContent = cell.row === LUNCH_ROW ? '' : '';
        }
    }

    /* ---- Recompute the live readouts + caption ----------------------------- */
    var reachedPayoff = false;

    function announce(msg) {
        if (liveEl) liveEl.textContent = msg;
    }

    function update(opts) {
        opts = opts || {};
        var given = handable.filter(function (x) { return x.given; });
        var hours = given.length;
        var pct = WORK_HOURS ? Math.round((hours / WORK_HOURS) * 100) : 0;

        if (hoursEl) hoursEl.textContent = hours;
        if (pctEl) pctEl.textContent = pct + '%';
        root.setAttribute('data-given', String(hours));

        // Caption recomputes from the actual grid — never canned text.
        var humanHours = cells.filter(function (x) { return x.type === 'human'; }).length;
        var cap;
        if (hours === 0) {
            cap = 'This is a real working week. The <strong>green</strong> blocks are repetitive busywork — ' +
                'hand them to the AI. The <strong>outlined</strong> blocks (talk, decide, the final call) ' +
                'are the part that needs you: they can never be handed over.';
        } else if (hours < TOTAL_BUSY) {
            cap = '<strong>' + hours + ' hour' + (hours === 1 ? '' : 's') + ' back</strong> so far — ' +
                pct + '% of your working week handed off. Notice what is left: every block that needs a ' +
                'person is still here. You are not doing less of <em>you</em>; you are doing less busywork.';
        } else {
            cap = 'Every bit of busywork is gone — <strong>' + hours + ' hours back</strong>, ' + pct +
                '% of your week. What remains is ' + humanHours + ' hours of the part only you can do: ' +
                'the people, the calls, the judgment. <strong>That</strong> is why working with AI is worth it.';
        }

        // The unmissable payoff: Thursday morning is now clear.
        var thuDone = thuMorningBusy.length > 0 && thuMorningBusy.every(function (x) { return x.given; });
        var payoffEl = root.querySelector('[data-week-payoff]');
        if (payoffEl) {
            if (thuDone) {
                payoffEl.hidden = false;
                payoffEl.classList.add('is-lit');
                if (!reachedPayoff && !opts.silent) {
                    reachedPayoff = true;
                    announce('Thursday morning is now free — three hours for the thing only you can do.');
                }
            } else {
                payoffEl.hidden = true;
                payoffEl.classList.remove('is-lit');
                if (reachedPayoff) reachedPayoff = false;
            }
        }
        // highlight the Thursday column header once cleared
        var thuHead = svgEl.querySelector('.yw-day--thu');
        if (thuHead) thuHead.classList.toggle('is-clear', thuDone);

        if (capEl) capEl.innerHTML = cap;
        if (!opts.silent && !thuDone && hours > 0) {
            announce(hours + ' hours reclaimed, ' + pct + ' percent of your week.');
        }
    }

    /* ---- Toggle a cell ----------------------------------------------------- */
    function toggle(cell, force) {
        if (!cell || cell.type !== 'busy') return;
        cell.given = (typeof force === 'boolean') ? force : !cell.given;
        paintCell(cell);
        update();
    }

    /* ---- Pointer: click a block, or drag across several --------------------- */
    var dragging = false, dragVal = true, pid = null;

    function pt(clientX, clientY) {
        var p = svgEl.createSVGPoint();
        p.x = clientX; p.y = clientY;
        return p.matrixTransform(svgEl.getScreenCTM().inverse());
    }
    function hit(clientX, clientY) {
        var p = pt(clientX, clientY);
        var col = Math.floor((p.x - PAD_L) / CW);
        var row = Math.floor((p.y - PAD_T) / CH);
        if (col < 0 || col >= DAYS.length || row < 0 || row >= ROWS) return null;
        return cellAt(col, row);
    }

    svgEl.addEventListener('pointerdown', function (e) {
        var cell = hit(e.clientX, e.clientY);
        if (!cell || cell.type !== 'busy') return;
        e.preventDefault();
        dragging = true; pid = e.pointerId;
        dragVal = !cell.given;              // first cell sets the direction; drag paints the same way
        try { svgEl.setPointerCapture(pid); } catch (err) {}
        toggle(cell, dragVal);
        // move keyboard focus to the last touched cell too
        focusIndex = handable.indexOf(cell);
        if (cell.g) cell.g.setAttribute('tabindex', '0');
    });
    svgEl.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var cell = hit(e.clientX, e.clientY);
        if (cell && cell.type === 'busy' && cell.given !== dragVal) toggle(cell, dragVal);
    });
    function endDrag() {
        if (!dragging) return;
        dragging = false;
        if (pid != null) { try { svgEl.releasePointerCapture(pid); } catch (err) {} pid = null; }
    }
    svgEl.addEventListener('pointerup', endDrag);
    svgEl.addEventListener('pointercancel', endDrag);

    /* ---- Keyboard: roving focus over busywork blocks ----------------------- */
    function focusCell(i) {
        if (i < 0 || i >= handable.length) return;
        handable.forEach(function (cc, j) { if (cc.g) cc.g.setAttribute('tabindex', j === i ? '0' : '-1'); });
        focusIndex = i;
        if (handable[i].g) handable[i].g.focus();
    }
    // Make the first handable cell reachable by Tab.
    if (handable.length && handable[0].g) handable[0].g.setAttribute('tabindex', '0');

    svgEl.addEventListener('keydown', function (e) {
        var i = focusIndex < 0 ? 0 : focusIndex;
        var cur = handable[i];
        if (!cur) return;
        var col = cur.col, row = cur.row, next = null;
        switch (e.key) {
            case 'Enter': case ' ': case 'Spacebar':
                e.preventDefault(); toggle(cur); return;
            case 'ArrowRight': next = nearestHandable(col + 1, row, 1, 0); break;
            case 'ArrowLeft': next = nearestHandable(col - 1, row, -1, 0); break;
            case 'ArrowDown': next = nearestHandable(col, row + 1, 0, 1); break;
            case 'ArrowUp': next = nearestHandable(col, row - 1, 0, -1); break;
            case 'Home': next = handable[0]; break;
            case 'End': next = handable[handable.length - 1]; break;
            default: return;
        }
        if (next) { e.preventDefault(); focusCell(handable.indexOf(next)); }
    });
    svgEl.addEventListener('focusin', function (e) {
        var g = e.target;
        for (var k = 0; k < handable.length; k++) if (handable[k].g === g) { focusIndex = k; break; }
    });

    // Walk in (dx,dy) until we find a busywork cell or fall off the grid.
    function nearestHandable(col, row, dx, dy) {
        while (col >= 0 && col < DAYS.length && row >= 0 && row < ROWS) {
            var cc = cellAt(col, row);
            if (cc && cc.type === 'busy') return cc;
            col += dx || 0; row += dy || 0;
            if (!dx && !dy) break;
        }
        return null;
    }

    /* ---- Reset ------------------------------------------------------------- */
    if (resetEl) {
        resetEl.addEventListener('click', function () {
            handable.forEach(function (x) { if (x.given) { x.given = false; paintCell(x); } });
            reachedPayoff = false;
            update({ silent: true });
            announce('Reset. The week is back to busywork.');
        });
    }

    /* ---- Go ---------------------------------------------------------------- */
    cells.forEach(paintCell);
    update({ silent: true });
})();
