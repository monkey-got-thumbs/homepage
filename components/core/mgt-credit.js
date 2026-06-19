/**
 * <mgt-credit> — a small, in-context attribution note.
 *
 * Drop it at the foot of any feature that implements someone else's idea, to
 * credit the mechanism (in our own words) and link to the full Influences page.
 * The lineage of augmented intelligence deserves naming — not quiet borrowing.
 *
 *   <mgt-credit>Inline recall is our take on the <strong>mnemonic medium</strong>
 *   by Andy Matuschak &amp; Michael Nielsen.</mgt-credit>
 *
 * External module (CSP `script-src 'self'`). Progressive enhancement: with JS
 * off, the authored text still reads (and the Influences page is linked in the footer).
 */
class MGTCredit extends HTMLElement {
    connectedCallback() {
        if (this._init) return; this._init = true;
        const root = this.attachShadow({ mode: 'open' });
        root.innerHTML = `<style>
            :host { display: block; margin: 1.5rem 0; }
            .c { display: flex; gap: 0.6rem; align-items: flex-start;
                background: color-mix(in srgb, var(--color-brand, #503E94) 12%, transparent);
                border: 1px solid var(--color-border, rgba(255,255,255,.08)); border-radius: 12px;
                padding: 0.75rem 1rem; font: 400 0.85rem/1.55 "Montserrat", system-ui, sans-serif;
                color: var(--color-muted, #B9B5D3); }
            .i { flex-shrink: 0; }
            a { color: var(--color-accent, #A6FF4D); text-decoration: none; }
            a:hover { text-decoration: underline; }
            ::slotted(strong) { color: var(--color-fg, #EDECF6); }
            ::slotted(a) { color: var(--color-accent, #A6FF4D); }
        </style>
        <div class="c"><span class="i" aria-hidden="true">↳</span><span><slot></slot> <a href="/learn/influences.html">Influences &amp; credits&nbsp;→</a></span></div>`;
    }
}
customElements.define('mgt-credit', MGTCredit);
export { MGTCredit };
