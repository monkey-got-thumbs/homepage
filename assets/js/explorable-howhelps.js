/* "Three ways it helps" explorable — tap a way, see the slog shrink and what stays yours.
 * Teaches the three help-modes (speed / offload / think-with-you) by doing, not telling.
 * CSP-safe external module, progressive-enhanced.
 */
(function () {
    const root = document.getElementById('how-helps');
    if (!root) return;
    const btns = Array.prototype.slice.call(root.querySelectorAll('[data-mode]'));
    const beforeEl = root.querySelector('[data-before]');
    const afterEl = root.querySelector('[data-after]');
    const yoursEl = root.querySelector('[data-yours]');
    const aiBar = root.querySelector('[data-ai-bar]');
    if (!btns.length) return;

    const MODES = {
        speed: {
            before: 'Writing the monthly report from a blank page — a whole afternoon gone.',
            after: 'AI hands you a solid first draft in minutes. You shape it into the real thing.',
            yours: 'you keep the angle and the final wording.', effort: 16,
        },
        boring: {
            before: 'Sorting 200 receipts into categories, one by one.',
            after: 'AI sorts them in seconds. You just glance over the few odd ones.',
            yours: 'you keep the spot-check.', effort: 10,
        },
        think: {
            before: 'Stuck on a plan, staring at a blank page.',
            after: 'AI offers three angles to react to. You pick the right one and build on it.',
            yours: 'you keep the judgment about which way is right.', effort: 30,
        },
    };

    function set(mode) {
        const m = MODES[mode] || MODES.speed;
        btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
        if (beforeEl) beforeEl.textContent = m.before;
        if (afterEl) afterEl.textContent = m.after;
        if (yoursEl) yoursEl.textContent = m.yours;
        if (aiBar) aiBar.style.width = m.effort + '%';
        root.setAttribute('data-mode', mode);
    }

    btns.forEach(function (b) { b.addEventListener('click', function () { set(b.dataset.mode); }); });
    set('speed');
})();
