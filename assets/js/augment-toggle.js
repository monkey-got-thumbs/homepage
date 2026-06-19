/* "Replace vs Augment" explorable: make the human-in-the-loop distinction manipulable and visible.
 * External file (CSP `script-src 'self'`). Progressive enhancement: a <noscript> fallback states both modes. */
(function () {
    const root = document.getElementById('augtoggle');
    if (!root) return;
    const flow = root.querySelector('.flow');
    const cap = root.querySelector('.augtoggle__caption');
    const btns = root.querySelectorAll('.augtoggle__btns button');
    const modes = {
        augment: {
            html: '<span class="node you">You</span><span class="arrow">→ direct →</span><span class="node ai">AI drafts</span><span class="arrow">→</span><span class="node you">You verify &amp; decide</span><span class="arrow">→</span><span class="node">Outcome</span>',
            cap: 'Augmented intelligence: you stay in the loop. The machine does the volume; you make the call — so when it’s wrong, you catch it.'
        },
        replace: {
            html: '<span class="node you muted">You</span><span class="arrow">✕</span><span class="node ai">AI decides</span><span class="arrow">→</span><span class="node">Outcome</span>',
            cap: 'Full automation: the human is removed. Faster — but no one catches the model’s mistakes, and the judgment is gone.'
        }
    };
    function set(m) {
        flow.innerHTML = modes[m].html;
        cap.textContent = modes[m].cap;
        btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    }
    btns.forEach(b => b.addEventListener('click', () => set(b.dataset.mode)));
    set('augment');
})();
