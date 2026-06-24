/* "Spot the made-up one" — the core AI pitfall, made visceral over several rounds.
 *
 * Each round shows a few claims that all SOUND equally sure (every one carries an
 * identical, maxed-out "confidence" bar — that's the whole point you can see). One
 * claim is invented; you hunt for it. Pick → instant ✓/✗ by colour + icon (never a
 * flash), plus WHY it was made up and a one-line way you'd verify it. A live score
 * ("you caught X of Y") sits beside a sobering counter ("an AI stated all N of these
 * with equal confidence"). Later rounds slip in a plausible half-truth to make the
 * true ones harder to trust. A closing insight lands when you finish.
 *
 * CSP-safe: every behaviour is wired here with addEventListener — no inline JS.
 * Progressive: if this script never runs, the <noscript>/static markup in the page
 * still states the idea. Accessible: claims are real <button>s, reveal is colour +
 * text + icon (not colour alone), reduced-motion is respected by the CSS.
 */
(function () {
    'use strict';
    const root = document.getElementById('spot-it');
    if (!root) return;

    /* ---- the rounds. fake:true is the invented claim. ``why`` says why it's made up;
       ``check`` is the one-line "how you'd verify". ``note`` (optional) on a true claim
       flags a plausible half-truth so we can teach that "sounds shaky" ≠ "is false". ---- */
    const ROUNDS = [
        {
            topic: 'honey',
            prompt: 'Three “quick facts about honey.” The AI sounds equally sure of all three — but one is invented. Which?',
            claims: [
                { text: 'Honey never really spoils — sealed pots thousands of years old have been dug up still edible.' },
                { text: 'Bees make honey from nectar they gather from flowers.' },
                {
                    text: 'A single worker bee makes about a full jar of honey in its lifetime.',
                    fake: true,
                    why: 'One bee makes only about a twelfth of a teaspoon of honey in its whole life. The “full jar” is a tidy, satisfying number — exactly the kind of thing that gets invented because it sounds right.',
                    check: 'Search “how much honey does one bee make in its lifetime” — beekeeping sites agree it’s a tiny fraction of a teaspoon.'
                }
            ]
        },
        {
            topic: 'the human body',
            prompt: 'Three claims about the human body. Same calm, certain voice for each. One is made up.',
            claims: [
                { text: 'Your body has more bacterial cells living in it than it has human cells.' },
                {
                    text: 'The human stomach grows a new lining every few days because acid would otherwise digest it.',
                    note: 'sounds shaky — but it’s true'
                },
                {
                    text: 'You use only about ten percent of your brain; the rest sits idle in reserve.',
                    fake: true,
                    why: 'A famous myth. Brain scans show you use virtually all of your brain across a day — there’s no idle 90%. It survives because it’s a neat story, not because it’s true.',
                    check: 'Look up “ten percent of the brain myth” — neuroscientists and the scans behind them debunk it plainly.'
                }
            ]
        },
        {
            topic: 'space',
            prompt: 'Now it gets slipperier. One of these is a half-truth dressed as fact. Spot the made-up one.',
            claims: [
                {
                    text: 'The Great Wall of China is the only human-made object visible from space with the naked eye.',
                    fake: true,
                    why: 'Half-truth. The Wall is real and long, but it’s too thin to pick out by eye from orbit — astronauts say you can’t. The “only object visible from space” line is the invented part bolted onto a true thing.',
                    check: 'Search “can you see the Great Wall from space” — NASA and astronauts have addressed this directly.'
                },
                { text: 'In the vacuum of space there’s no air to carry sound, so it’s silent.' },
                { text: 'A day on Venus is longer than its year — it spins slower than it orbits the Sun.' }
            ]
        },
        {
            topic: 'everyday science',
            prompt: 'Last one. Four claims this time, and the AI is just as confident about each. Which did it invent?',
            claims: [
                { text: 'Hot water can freeze faster than cold water under the right conditions — it even has a name, the Mpemba effect.', note: 'sounds made up — but it’s real' },
                { text: 'Honey, lemon and warmth soothe a sore throat but won’t cure the cold causing it.' },
                {
                    text: 'Cracking your knuckles wears down the joint and causes arthritis over time.',
                    fake: true,
                    why: 'Long-running studies — including one doctor who cracked the knuckles of only one hand for 60 years — found no link to arthritis. It’s repeated so often it sounds settled, but it was never true.',
                    check: 'Search “does cracking knuckles cause arthritis” — medical sources say no; the sound is just gas bubbles.'
                },
                { text: 'Lightning can and often does strike the same place twice — tall towers get hit many times a year.' }
            ]
        }
    ];

    const TOTAL_ROUNDS = ROUNDS.length;
    const TOTAL_CLAIMS = ROUNDS.reduce((s, r) => s + r.claims.length, 0);

    /* state */
    let idx = 0;          // current round
    let caught = 0;       // fakes you correctly identified
    let answered = 0;     // rounds resolved (right or wrong)
    let seenClaims = 0;   // claims shown so far (drives the sober counter)

    /* ---- build the shell once ---- */
    root.innerHTML = '';

    const cap = document.createElement('figcaption');
    cap.textContent = 'Spot the made-up one';
    root.appendChild(cap);

    // progress rail of round dots
    const rail = document.createElement('div');
    rail.className = 'spot-rail';
    rail.setAttribute('aria-hidden', 'true');
    const dots = ROUNDS.map(function (_, i) {
        const d = document.createElement('span');
        d.className = 'spot-dot';
        rail.appendChild(d);
        return d;
    });
    root.appendChild(rail);

    // scoreboard: caught X of Y  +  the sobering counter
    const board = document.createElement('div');
    board.className = 'spot-board';
    board.innerHTML =
        '<p class="spot-score" data-score role="status" aria-live="polite">Round 1 of ' + TOTAL_ROUNDS + ' — find the invented one.</p>' +
        '<p class="spot-sober" data-sober><span class="spot-sober-n" data-sober-n>0</span> claims so far, and an AI stated <strong>every one</strong> with the same confidence.</p>';
    root.appendChild(board);

    // the question for the current round
    const qEl = document.createElement('p');
    qEl.className = 'spot-q';
    root.appendChild(qEl);

    // the claims list
    const list = document.createElement('div');
    list.className = 'spot-opts';
    root.appendChild(list);

    // per-round result panel (why + how to verify)
    const result = document.createElement('div');
    result.className = 'spot-result';
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');
    result.hidden = true;
    root.appendChild(result);

    // next / restart control
    const nav = document.createElement('div');
    nav.className = 'spot-nav';
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'spot-next';
    nextBtn.hidden = true;
    nav.appendChild(nextBtn);
    root.appendChild(nav);

    function updateBoard(roundResolved) {
        const score = root.querySelector('[data-score]');
        const soberN = root.querySelector('[data-sober-n]');
        if (soberN) soberN.textContent = String(seenClaims);
        if (!score) return;
        if (answered === 0) {
            score.textContent = 'Round ' + (idx + 1) + ' of ' + TOTAL_ROUNDS + ' — find the invented one.';
        } else if (idx < TOTAL_ROUNDS) {
            score.innerHTML = 'You’ve caught <strong>' + caught + ' of ' + answered + '</strong> so far. ' +
                'Round ' + (idx + 1) + ' of ' + TOTAL_ROUNDS + '.';
        } else {
            score.innerHTML = 'Final score: you caught <strong>' + caught + ' of ' + TOTAL_ROUNDS + '</strong> invented claims.';
        }
    }

    function renderRound() {
        const r = ROUNDS[idx];
        result.hidden = true;
        result.className = 'spot-result';
        nextBtn.hidden = true;
        qEl.innerHTML = r.prompt;

        // dots
        dots.forEach(function (d, i) {
            d.classList.toggle('is-now', i === idx);
            d.classList.toggle('is-done', i < idx);
        });

        list.innerHTML = '';
        r.claims.forEach(function (c, i) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'spot-opt';
            btn.setAttribute('aria-pressed', 'false');

            const claimText = document.createElement('span');
            claimText.className = 'spot-opt-text';
            claimText.textContent = c.text;
            btn.appendChild(claimText);

            // optional half-truth flag (visible, teaches "shaky ≠ false")
            if (c.note) {
                const flag = document.createElement('span');
                flag.className = 'spot-opt-note';
                flag.textContent = c.note;
                btn.appendChild(flag);
            }

            // identical confidence meter on EVERY claim — the visible "aha"
            const meter = document.createElement('span');
            meter.className = 'spot-meter';
            meter.setAttribute('aria-hidden', 'true');
            meter.innerHTML = '<span class="spot-meter-lbl">AI’s confidence</span>' +
                '<span class="spot-meter-track"><span class="spot-meter-fill"></span></span>' +
                '<span class="spot-meter-val">very high</span>';
            btn.appendChild(meter);

            btn.addEventListener('click', function () { pick(i, btn); });
            list.appendChild(btn);
        });

        seenClaims += r.claims.length;
        updateBoard(false);
    }

    function pick(i, btn) {
        const r = ROUNDS[idx];
        if (root.dataset.locked === String(idx)) return; // already answered this round
        root.dataset.locked = String(idx);

        const opts = Array.prototype.slice.call(list.querySelectorAll('.spot-opt'));
        let fakeClaim = null;
        opts.forEach(function (o, j) {
            const c = r.claims[j];
            o.disabled = true;
            if (c.fake) { o.classList.add('is-fake'); fakeClaim = c; }
            else o.classList.add('is-true');
            if (j === i) {
                o.classList.add('is-picked');
                o.setAttribute('aria-pressed', 'true');
            }
            // swap the meter caption to reinforce the point on reveal
            const val = o.querySelector('.spot-meter-val');
            if (val) val.textContent = c.fake ? 'identical — yet false' : 'identical — and true';
        });

        const gotIt = r.claims[i] && r.claims[i].fake === true;
        if (gotIt) caught++;
        answered++;
        idx++; // advance pointer now; board reads "so far"

        result.hidden = false;
        result.className = 'spot-result ' + (gotIt ? 'is-right' : 'is-wrong');
        result.innerHTML =
            '<p class="spot-verdict">' +
                '<span class="spot-icon" aria-hidden="true">' + (gotIt ? '✓' : '✗') + '</span>' +
                (gotIt ? '<strong>Caught it.</strong>' : '<strong>That one was real.</strong> The invented claim was the highlighted red one.') +
            '</p>' +
            '<p class="spot-why"><span class="spot-why-lbl">Why it was made up</span>' + fakeClaim.why + '</p>' +
            '<p class="spot-check"><span class="spot-check-lbl">How you’d verify it</span>' + fakeClaim.check + '</p>';

        updateBoard(true);

        if (idx < TOTAL_ROUNDS) {
            nextBtn.hidden = false;
            nextBtn.textContent = 'Next round ▸';
        } else {
            nextBtn.hidden = false;
            nextBtn.textContent = 'Start over';
            finish();
        }
        // move focus to the result so screen-reader users land on the explanation
        result.setAttribute('tabindex', '-1');
        result.focus({ preventScroll: true });
    }

    function finish() {
        root.setAttribute('data-done', 'true');
        const insight = document.createElement('div');
        insight.className = 'spot-insight';
        const allCaught = caught === TOTAL_ROUNDS;
        insight.innerHTML =
            '<p class="spot-insight-line">' +
            (allCaught
                ? 'You caught all ' + TOTAL_ROUNDS + '. '
                : 'You caught ' + caught + ' of ' + TOTAL_ROUNDS + '. ') +
            'But look at the bars: every single claim — the ' + TOTAL_CLAIMS + ' true ones <em>and</em> the made-up ones — wore the <strong>exact same confidence</strong>. ' +
            'Nothing in how the AI spoke told you which was which.</p>' +
            '<p class="spot-insight-line">That’s the whole catch. Fluency isn’t truth. The fix isn’t to distrust everything — it’s the one-line check beside each answer. <strong>Verify what matters.</strong></p>';
        result.appendChild(insight);
    }

    nextBtn.addEventListener('click', function () {
        if (idx >= TOTAL_ROUNDS) {
            // restart
            idx = 0; caught = 0; answered = 0; seenClaims = 0;
            delete root.dataset.locked;
            root.removeAttribute('data-done');
        }
        delete root.dataset.locked;
        renderRound();
        // keep the question in view when advancing
        qEl.setAttribute('tabindex', '-1');
        qEl.focus({ preventScroll: true });
    });

    renderRound();
})();
