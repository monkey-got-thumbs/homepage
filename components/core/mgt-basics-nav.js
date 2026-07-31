/**
 * MGTBasicsNav — left section-nav for the Basics wing.
 * Renders the list of Basics pages and highlights the current one automatically
 * (same self-registering, open-shadow-DOM convention as mgt-header/mgt-footer).
 * Sits as the left rail of the `.basics-shell` grid; the top nav stays above it.
 */
class MGTBasicsNav extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const items = [
      ['/basics/', 'The essay'],
      ['/basics/what-is-ai/', 'What is AI?'],
      ['/basics/llms/', "What's an LLM?"],
      ['/basics/agents/', "What's an agent?"],
      ['/basics/augmented-intelligence/', 'Augmented intelligence'],
      ['/basics/augmented-reality/', 'Augmented reality'],
      ['/basics/memory/', 'Your memory'],
    ];
    // normalise so "/basics", "/basics/" and "/basics/index.html" all match the essay
    let path = window.location.pathname.replace(/index\.html$/, '');
    if (!path.endsWith('/')) path += '/';

    const links = items.map(([href, label]) => {
      const active = href === path;
      return `<a href="${href}"${active ? ' aria-current="page"' : ''}>${label}</a>`;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: sticky;
          top: 7.5rem;                       /* clears the fixed top nav */
        }
        nav { display: flex; flex-direction: column; gap: 0.15rem; }
        .title {
          margin: 0 0 0.6rem;
          padding-inline: 0.9rem;
          font: 700 0.72rem/1 var(--font-mono, ui-monospace, monospace);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-muted, #8a869c);
        }
        a {
          display: block;
          padding: 0.6rem 0.9rem;
          border-radius: 10px;
          color: var(--color-fg-secondary, #c9c7d6);
          text-decoration: none;
          font: 600 0.9rem/1.3 var(--font-sans, system-ui, sans-serif);
          transition: background 0.15s ease, color 0.15s ease;
        }
        a:hover { background: color-mix(in srgb, var(--color-fg, #fff) 7%, transparent); color: var(--color-fg, #fff); }
        a:focus-visible { outline: 3px solid var(--color-accent, #A6FF4D); outline-offset: 2px; }
        a[aria-current="page"] {
          background: color-mix(in srgb, var(--color-accent, #A6FF4D) 14%, transparent);
          color: var(--color-accent, #A6FF4D);
        }
        @media (max-width: 60rem) {
          :host { position: static; margin-block-end: 1.5rem; }
          nav { flex-direction: row; flex-wrap: wrap; }
        }
      </style>
      <nav aria-label="Basics sections">
        <p class="title">Basics</p>
        ${links}
      </nav>
    `;
  }
}

customElements.define('mgt-basics-nav', MGTBasicsNav);

export { MGTBasicsNav };
