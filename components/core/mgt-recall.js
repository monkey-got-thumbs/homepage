/**
 * <mgt-recall> — an inline spaced-repetition recall card (the "mnemonic medium").
 *
 * Interleave these into prose, right after the idea they test. The reader reveals
 * the answer and self-grades ("I remembered" / "I forgot"); state is scheduled by
 * srs.js in their own browser. No typing, no machine grading, no backend.
 *
 * Progressive enhancement: author each card with a native <details> inside, so
 * with JavaScript OFF the question + answer are fully readable and SEO-indexable.
 * With JS on, the component upgrades it to a graded, scheduled card.
 *
 *   <mgt-recall id="ms-rag-retrieve">
 *     <details>
 *       <summary>What does RAG retrieve before the model answers?</summary>
 *       <p>Relevant chunks from your own documents (via embeddings), fed into the prompt as context.</p>
 *     </details>
 *   </mgt-recall>
 */
import * as srs from '/assets/js/srs.js';

const STYLE = `
:host { display: block; margin: 1.5rem 0; --acc: var(--color-accent, #A6FF4D); --bg: var(--color-bg-secondary, #17122B);
    --fg: var(--color-fg, #EDECF6); --muted: var(--color-muted, #B9B5D3); --brand: var(--color-brand-light, #6A55C0);
    --bd: var(--color-border, rgba(255,255,255,.08)); }
* { box-sizing: border-box; }
/* Quiet self-check — calm, but with CLEAR grouping: even internal spacing (flex+gap),
   and the answer is a visually distinct panel with its own "Answer" label so it's never
   confused with the question. No loud bar, no filled lime pill. */
.card { background: color-mix(in srgb, var(--bg) 45%, transparent); border: 1px solid var(--bd);
    border-radius: 10px; padding: 1rem 1.1rem; font-family: "Montserrat", system-ui, sans-serif;
    display: flex; flex-direction: column; gap: .8rem; }
.card > * { margin: 0; }
.tag { display: flex; align-items: center; gap: .4rem; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .12em; color: var(--muted); }
.tag::before { content: ""; width: 5px; height: 5px; border-radius: 999px; background: color-mix(in srgb, var(--acc) 70%, transparent); flex: 0 0 auto; }
.card.done .tag::before { background: var(--muted); }
.q { color: var(--fg); font-size: .98rem; font-weight: 700; line-height: 1.5; }
/* The answer = a distinct, clearly-labelled panel. Impossible to mistake for the question. */
.a { color: var(--color-fg-secondary, var(--fg)); font-size: .92rem; line-height: 1.7;
    background: color-mix(in srgb, var(--acc) 7%, transparent);
    border: 1px solid color-mix(in srgb, var(--acc) 22%, var(--bd));
    border-radius: 8px; padding: .7rem .85rem; }
.a::before { content: "Answer"; display: block; font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .1em; color: var(--acc); margin-bottom: .35rem; }
.a > :first-child { margin-top: 0; } .a > :last-child { margin-bottom: 0; }
.row { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
button { font: 600 .82rem "Montserrat", sans-serif; border-radius: 8px; padding: .42rem .85rem; cursor: pointer;
    border: 1px solid var(--bd); background: transparent; color: var(--fg);
    transition: border-color .15s ease, background .15s ease; }
button:hover { border-color: color-mix(in srgb, var(--acc) 55%, var(--bd)); }
button.primary { background: color-mix(in srgb, var(--acc) 12%, transparent); border-color: color-mix(in srgb, var(--acc) 40%, var(--bd)); }
button.primary:hover { background: color-mix(in srgb, var(--acc) 18%, transparent); }
button:focus-visible { outline: 2px solid var(--acc); outline-offset: 2px; }
.hint { color: var(--muted); font-size: 11.5px; line-height: 1.5; }
.status { color: var(--muted); font-size: 11.5px; min-height: 1em; }
@media (prefers-reduced-motion: reduce) { button { transition: none; } }
`;

class MGTRecall extends HTMLElement {
    connectedCallback() {
        if (this._init) return; this._init = true;
        this.cardId = this.getAttribute('id') || ('card-' + Math.random().toString(36).slice(2, 9));

        // Read question/answer from the light-DOM <details> (preferred, accessible) or attributes.
        let q = (this.getAttribute('question') || '').trim();
        let aHtml = this.getAttribute('answer') ? escapeText(this.getAttribute('answer')) : '';
        const details = this.querySelector('details');
        if (details) {
            const sum = details.querySelector('summary');
            if (!q && sum) q = sum.textContent.trim();
            if (!aHtml) { const clone = details.cloneNode(true); const s2 = clone.querySelector('summary'); if (s2) s2.remove(); aHtml = clone.innerHTML.trim(); }
        }
        if (!q) { return; } // nothing to show; leave light DOM as-is
        this._q = q; this._a = aHtml || '<p>(no answer provided)</p>';

        srs.ensureCard(this.cardId, { q, a: this._a, page: location.pathname });
        this.attachShadow({ mode: 'open' }); // hides the light-DOM <details>; shadow UI takes over
        this.render();
    }

    render() {
        const st = srs.getCard(this.cardId);
        const recent = st && st.last && (Date.now() - st.last < 12 * 3600 * 1000);
        this.shadowRoot.innerHTML = `<style>${STYLE}</style>
            <div class="card${recent ? ' done' : ''}">
                <div class="q"><span class="tag">Recall</span>${this._q}</div>
                <div class="a" ${recent ? '' : 'hidden'}>${this._a}</div>
                <div class="row reveal-row" ${recent ? 'hidden' : ''}>
                    <button class="primary reveal">Show answer</button>
                    <span class="hint">Test yourself before revealing — that's what makes it stick.</span>
                </div>
                <div class="row grade-row" hidden>
                    <button class="yes primary">I remembered</button>
                    <button class="no">I forgot</button>
                    <span class="hint">You grade yourself. Marking “remembered” when you didn't only fools your future self.</span>
                </div>
                <div class="status" role="status" aria-live="polite">${recent ? this._nextLabel(st) : ''}</div>
            </div>`;
        const $ = s => this.shadowRoot.querySelector(s);
        $('.reveal').addEventListener('click', () => { $('.a').hidden = false; $('.reveal-row').hidden = true; $('.grade-row').hidden = false; $('.yes').focus(); });
        $('.yes').addEventListener('click', () => this._grade(true));
        $('.no').addEventListener('click', () => this._grade(false));
    }

    _grade(ok) {
        const st = srs.recordGrade(this.cardId, ok, { q: this._q, a: this._a, page: location.pathname });
        try { window.MGT_TRACKING && window.MGT_TRACKING.trackEvent('card_reviewed', { id: this.cardId, page: location.pathname, grade: ok ? 'remembered' : 'forgot' }); } catch (_) {}
        const $ = s => this.shadowRoot.querySelector(s);
        $('.grade-row').hidden = true;
        this.shadowRoot.querySelector('.card').classList.add('done');
        $('.status').textContent = (ok ? '✓ ' : '↻ ') + this._nextLabel(st);
        this.dispatchEvent(new CustomEvent('recall-graded', { bubbles: true, composed: true, detail: { id: this.cardId, remembered: ok } }));
    }

    _nextLabel(st) {
        if (!st || !st.due) return '';
        const d = Math.max(0, Math.round((st.due - Date.now()) / srs.DAY_MS));
        return d <= 0 ? 'Due now.' : ('Next review in ' + d + ' day' + (d === 1 ? '' : 's') + '.');
    }
}

function escapeText(s) { return '<p>' + String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</p>'; }

customElements.define('mgt-recall', MGTRecall);

/* Page-level hydration: any page with cards gets its banner stat + review CTA wired
 * automatically — no per-page script needed. Idempotent; updates live as cards are graded. */
function hydratePage() {
    const stat = document.querySelector('[data-recall-stat]');
    const cta = document.querySelector('[data-recall-cta]');
    const countEl = document.querySelector('[data-recall-count]');
    const dueEl = document.querySelector('[data-recall-due]');
    const exp = document.querySelector('[data-recall-export]');
    if (!stat && !cta && !exp) return;
    const refresh = () => {
        const s = srs.stats();
        if (stat) stat.textContent = s.reviewed ? `(${s.reviewed} learned · ${s.due} due across the site)` : '';
        if (cta) {
            const onPage = srs.cardsOnPage(location.pathname).length;
            if (onPage > 0) {
                cta.hidden = false;
                if (countEl) countEl.textContent = onPage;
                if (dueEl) dueEl.textContent = s.due ? `${s.due} are due across the site.` : '';
            }
        }
    };
    if (exp && !exp._wired) { exp._wired = true; exp.addEventListener('click', () => srs.downloadCsv()); }
    document.addEventListener('recall-graded', refresh);
    refresh();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydratePage);
else hydratePage();

export { MGTRecall };
