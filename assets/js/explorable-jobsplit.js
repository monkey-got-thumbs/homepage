/* "Who should do this job?" explorable — the heart of augmented intelligence made obvious
 * by doing it. Three ways to turn 400 comments into a report; only "both" fills BOTH meters
 * (fast AND right). External module (CSP script-src 'self'), progressive-enhanced.
 */
(function () {
    const root = document.getElementById('job-split');
    if (!root) return;
    const btns = Array.prototype.slice.call(root.querySelectorAll('[data-mode]'));
    const timeEl = root.querySelector('[data-time]');
    const capEl = root.querySelector('[data-caption]');
    const speedBar = root.querySelector('[data-speed-bar]');
    const accBar = root.querySelector('[data-acc-bar]');
    if (!btns.length) return;

    const MODES = {
        maria: { time: 'a full day', speed: 14, acc: 100, accLow: false,
            cap: 'Accurate — but reading 400 comments by hand ate the whole day, and the report is late.' },
        ai: { time: '2 minutes', speed: 100, acc: 34, accLow: true,
            cap: 'Instant — but it confidently mislabelled comments, and with no one checking, the mistakes go straight into the report.' },
        both: { time: 'about an hour', speed: 84, acc: 100, accLow: false,
            cap: 'AI sorted the 400 in seconds; Maria read the themes, caught the mislabels, and made the call. Neither could do this alone — that is augmented intelligence.' },
    };

    function set(mode) {
        const m = MODES[mode] || MODES.maria;
        btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
        if (timeEl) timeEl.textContent = m.time;
        if (capEl) capEl.textContent = m.cap;
        if (speedBar) speedBar.style.width = m.speed + '%';
        if (accBar) { accBar.style.width = m.acc + '%'; accBar.classList.toggle('is-low', !!m.accLow); }
        root.setAttribute('data-mode', mode);
    }

    btns.forEach(function (b) { b.addEventListener('click', function () { set(b.dataset.mode); }); });
    set('maria'); // start human-alone so clicking through tells the story
})();
