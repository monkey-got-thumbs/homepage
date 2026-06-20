/* "Spot the made-up one" explorable — the core AI pitfall made visceral. Three confident
 * claims, one invented; you hunt for it, then learn the real point: confidence tells you
 * nothing about truth, so verify what matters. CSP-safe, progressive-enhanced.
 */
(function () {
    const root = document.getElementById('spot-it');
    if (!root) return;
    const opts = Array.prototype.slice.call(root.querySelectorAll('[data-claim]'));
    const result = root.querySelector('[data-spot-result]');
    if (!opts.length) return;
    let done = false;

    function reveal(picked) {
        if (done) return; done = true;
        opts.forEach(function (o) {
            const fake = o.dataset.fake === 'true';
            o.classList.add(fake ? 'is-fake' : 'is-true');
            if (o === picked) o.classList.add('is-picked');
            o.setAttribute('aria-pressed', String(o === picked));
            o.disabled = true;
        });
        const caughtIt = picked && picked.dataset.fake === 'true';
        if (result) {
            result.hidden = false;
            result.innerHTML = (caughtIt ? '<strong>Nice — you caught it.</strong> ' : '<strong>Tricky, isn’t it?</strong> ')
                + 'The made-up one (a single bee makes only about a twelfth of a teaspoon of honey in its whole life) was stated with the <em>exact same confidence</em> as the true ones. Nothing in how the AI spoke flagged it. That’s the catch: confidence tells you nothing about truth — so check anything that matters.';
        }
        root.setAttribute('data-done', 'true');
    }

    opts.forEach(function (o) { o.addEventListener('click', function () { reveal(o); }); });
})();
