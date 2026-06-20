/* "The coffee problem" explorable — drag specificity, watch a keen AI's interpretation
 * narrow from absurd to spot-on. External module (CSP script-src 'self'),
 * progressive enhancement: the static markup shows the vague case if JS never runs.
 */
(function () {
    const root = document.getElementById('coffee-dial');
    if (!root) return;
    const slider = root.querySelector('input[type="range"]');
    const askEl = root.querySelector('[data-ask]');
    const gotEl = root.querySelector('[data-got]');
    const faceEl = root.querySelector('[data-face]');
    const fillEl = root.querySelector('[data-match]');
    if (!slider) return;

    const LEVELS = [
        { ask: '“coffee”', got: 'buys you a coffee plantation in Colombia.', face: '😵', match: 6 },
        { ask: '“get me a coffee”', got: 'orders 100 cups… for delivery next month.', face: '😬', match: 24 },
        { ask: '“get me a coffee, now”', got: 'grabs the nearest cup — out of a stranger’s hand.', face: '😅', match: 45 },
        { ask: '“get me a coffee from a café”', got: 'brings one from across town. It’s gone cold.', face: '🤔', match: 72 },
        { ask: '“a flat white from the café next door, please”', got: 'hands you a flat white from next door.', face: '😄', match: 100 },
    ];

    function render() {
        const lvl = LEVELS[+slider.value] || LEVELS[0];
        if (askEl) askEl.textContent = lvl.ask;
        if (gotEl) gotEl.textContent = lvl.got;
        if (faceEl) faceEl.textContent = lvl.face;
        if (fillEl) {
            fillEl.style.width = lvl.match + '%';
            const m = fillEl.closest('[role="progressbar"]');
            if (m) m.setAttribute('aria-valuenow', String(lvl.match));
        }
        root.setAttribute('data-level', slider.value);
    }

    slider.addEventListener('input', render);
    render();
})();
