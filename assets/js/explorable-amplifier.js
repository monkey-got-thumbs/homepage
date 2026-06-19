/* Explorable: reclaimed hours, reinvested, compound (illustrative model). "Show the data."
 * External file (not inline) so it satisfies the site CSP `script-src 'self'`. */
(function () {
    const $ = s => document.querySelector(s);
    const hours = $('#amp-hours'); if (!hours) return;
    const hv = $('#amp-hours-val'), yEl = $('#amp-year'), mEl = $('#amp-mult'), rEl = $('#amp-rate'),
        chart = $('#amp-chart'), desc = $('#amp-chart-desc');
    const W = 320, H = 120, pad = 10, months = 12, weeks = 52;
    function pts(rate, maxv) {
        const x = i => pad + i * (W - 2 * pad) / months;
        const y = v => H - pad - ((v - 1) / (maxv - 1)) * (H - 2 * pad);
        let base = [], aug = [];
        for (let m = 0; m <= months; m++) {
            const wk = m * weeks / months;
            base.push(x(m) + ',' + y(1));
            aug.push(x(m) + ',' + y(Math.pow(1 + rate, wk)));
        }
        return { base: base.join(' '), aug: aug.join(' ') };
    }
    function render() {
        const h = +hours.value;
        const rate = h * 0.002;                 // weekly compounding rate (illustrative)
        const mult = Math.pow(1 + rate, weeks);
        const maxv = Math.max(2, mult);
        hv.textContent = h;
        yEl.textContent = h * 48;
        mEl.innerHTML = mult.toFixed(1) + '&times;';
        rEl.textContent = (rate * 100).toFixed(1) + '%';
        const p = pts(rate, maxv);
        chart.innerHTML =
            '<polyline fill="none" stroke="#6A55C0" stroke-width="2" stroke-dasharray="4 4" points="' + p.base + '"></polyline>' +
            '<polyline fill="none" stroke="#A6FF4D" stroke-width="2.5" points="' + p.aug + '"></polyline>';
        desc.textContent = h === 0
            ? 'With nothing reclaimed, capacity stays flat — the dashed line.'
            : 'Reinvest ' + h + ' h/week and effective capacity (lime) grows to about ' + mult.toFixed(1) + '× the flat baseline (dashed) over a year — in this simple model.';
    }
    hours.addEventListener('input', render);
    render();
})();
