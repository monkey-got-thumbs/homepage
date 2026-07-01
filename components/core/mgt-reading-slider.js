/**
 * MGTReadingSlider - inline reading-level (cognitive-load) control
 * A labelled measure bar — "simpler ⟷ denser" — with the monkey-face handle.
 * Continuous 0–100% (stored as a11y.levelpct); the discrete reading level 1–5
 * is derived from it and drives the shared engine (window.__A11Y). Sits in
 * normal document flow (scrolls with the page, unlike the fixed header) and
 * stays in sync if the level is changed elsewhere (accessibility panel/Reset).
 */

class MGTReadingSlider extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setup();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --accent: var(--color-accent, #A6FF4D);
        }

        .wrap {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .end {
          flex: none;
          font: 700 0.62rem/1 var(--font-mono, monospace);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: color-mix(in srgb, var(--accent) 82%, #fff 18%);
          white-space: nowrap;
        }

        input {
          flex: 1 1 auto;
          min-inline-size: 0;
          block-size: 32px;
          margin: 0;
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
          --mk-invert: 0.5;
          /* the measure bar: a faint→bright ruled line, ticked at the five
             reading-level stops, that the monkey handle slides along. */
          --cog-line: linear-gradient(90deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--accent) 80%, transparent));
          --cog-tick: color-mix(in srgb, var(--accent) 55%, transparent);
        }
        input::-webkit-slider-runnable-track {
          block-size: 100%;
          background:
            var(--cog-line) 0 50% / 100% 2px no-repeat,
            repeating-linear-gradient(90deg, var(--cog-tick) 0 2px, transparent 2px 25%) 0 50% / 100% 12px no-repeat;
        }
        input::-moz-range-track {
          block-size: 100%;
          background:
            var(--cog-line) 0 50% / 100% 2px no-repeat,
            repeating-linear-gradient(90deg, var(--cog-tick) 0 2px, transparent 2px 25%) 0 50% / 100% 12px no-repeat;
        }
        input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          inline-size: 30px; block-size: 30px; border-radius: 50%;
          box-sizing: border-box;
          background: var(--color-bg-secondary, #17122B) url("/favicon.png") center/cover no-repeat;
          border: 2px solid var(--accent);
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
          filter: invert(var(--mk-invert));
          margin-top: 1px;
        }
        input::-moz-range-thumb {
          inline-size: 30px; block-size: 30px; border-radius: 50%;
          box-sizing: border-box;
          background: var(--color-bg-secondary, #17122B) url("/favicon.png") center/cover no-repeat;
          border: 2px solid var(--accent);
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
          filter: invert(var(--mk-invert));
        }
        input:focus-visible { outline: none; }
        input:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px var(--accent); }
        input:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 3px var(--accent); }
      </style>

      <div class="wrap">
        <span class="end" aria-hidden="true">simpler</span>
        <input type="range" id="s" min="0" max="100" step="any" value="50"
          aria-label="Reading level — slide left for the simplest version, right for the densest"
          title="Reading level — left: simplest · right: densest" />
        <span class="end" aria-hidden="true">denser</span>
      </div>
    `;
  }

  setup() {
    const s = this.shadowRoot.getElementById('s');
    if (!s) return;
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const PCTKEY = 'a11y.levelpct';
    const pctToLevel = (pct) => clamp(Math.round(1 + (pct / 100) * 4), 1, 5);   // 0%→1 … 100%→5
    const levelToPct = (lvl) => ((lvl - 1) / 4) * 100;
    const curLevel = () => {
      const v = parseInt(document.documentElement.getAttribute('data-level') || '3', 10);
      return v >= 1 && v <= 5 ? v : 3;
    };
    const setInvert = (pct) => s.style.setProperty('--mk-invert', (pct / 100).toFixed(4));
    const place = (pct) => {
      s.value = String(pct);
      setInvert(pct);
      s.setAttribute('aria-valuetext', 'Reading level ' + pctToLevel(pct) + ' of 5 (' + Math.round(pct) + '%)');
    };

    // Initial position: prefer the stored % if it still maps to the active level
    // (so the exact continuous position is preserved across reloads); else derive
    // it from the level (which a11y-init set pre-paint, and which Reset can change).
    const lvl0 = curLevel();
    const storedPct = parseFloat(localStorage.getItem(PCTKEY));
    place(Number.isFinite(storedPct) && pctToLevel(storedPct) === lvl0 ? storedPct : levelToPct(lvl0));

    s.addEventListener('input', () => {
      const pct = clamp(parseFloat(s.value) || 0, 0, 100);
      setInvert(pct);
      try { localStorage.setItem(PCTKEY, String(pct)); } catch (e) {}
      const lvl = pctToLevel(pct);
      if (window.__A11Y && typeof window.__A11Y.set === 'function') window.__A11Y.set('level', String(lvl));
      else document.documentElement.setAttribute('data-level', String(lvl));
    });

    // External level change (panel buttons / Reset / another slider instance):
    // only re-place the handle if the slider's current % maps to a DIFFERENT
    // level — otherwise keep the exact continuous position the user dragged to.
    if (window.MutationObserver) {
      new MutationObserver(() => {
        const lvl = curLevel();
        if (pctToLevel(parseFloat(s.value) || 0) !== lvl) place(levelToPct(lvl));
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-level'] });
    }
  }
}

customElements.define('mgt-reading-slider', MGTReadingSlider);

export { MGTReadingSlider };
