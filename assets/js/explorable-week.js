/* "Your week, reshaped" explorable — why working with AI is worth it, made personal.
 * Tick the busywork you'd hand to AI; watch the hours come back and your week become
 * the part only a person can do. Encouraging, not fear-based. CSP-safe, progressive.
 */
(function () {
    const root = document.getElementById('your-week');
    if (!root) return;
    const boxes = Array.prototype.slice.call(root.querySelectorAll('input[type="checkbox"][data-hours]'));
    const hoursEl = root.querySelector('[data-hours-back]');
    const barEl = root.querySelector('[data-hours-bar]');
    const capEl = root.querySelector('[data-week-caption]');
    if (!boxes.length) return;

    const TOTAL = boxes.reduce(function (s, b) { return s + Number(b.dataset.hours || 0); }, 0);

    function update() {
        let hours = 0, n = 0;
        boxes.forEach(function (b) { if (b.checked) { hours += Number(b.dataset.hours || 0); n++; } });
        if (hoursEl) hoursEl.textContent = hours;
        if (barEl) barEl.style.width = (TOTAL ? Math.round((hours / TOTAL) * 100) : 0) + '%';
        if (capEl) {
            capEl.textContent = n === 0
                ? 'Tick the repetitive jobs above. Notice none of them is the part that needs you.'
                : n < boxes.length
                    ? 'AI takes the busywork; the calls stay yours. ' + hours + ' hours back so far.'
                    : 'AI took ~' + hours + ' hours of busywork. Your week is now mostly the part that needs a person — plus ' + hours + ' hours you did not have. That is why it is worth learning.';
        }
        root.setAttribute('data-picked', String(n));
    }

    boxes.forEach(function (b) { b.addEventListener('change', update); });
    update();
})();
