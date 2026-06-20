/**
 * MGTFooter - Site Footer Component
 * Displays footer content, links, and copyright information
 * Accessible and semantic HTML structure
 */

class MGTFooter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupAccessibility();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --fg: #EDECF6;
          --fg-secondary: #F3F2FA;
          --muted: #E0DDEF;
          --accent: #A6FF4D;
          --bg-secondary: #17122B;
          --border: rgba(255, 255, 255, 0.06);
        }

        footer {
          margin-top: 3rem;
          padding-block: 3rem;
          background: #0a0814;
          border-top: 1px solid var(--border);
          color: var(--muted);
          font-size: 0.875rem;
          text-align: left;
        }

        .footer-container {
          max-width: var(--container-wide, 90rem);
          margin: 0 auto;
          padding-inline: var(--gutter, 1rem);
          box-sizing: border-box;
        }

        .footer-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 2rem;
          margin-bottom: 2rem;
        }

        h2 {
          margin: 0 0 0.75rem;
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--fg-secondary);
          font-weight: 700;
        }

        p {
          margin: 0 0 0.5rem;
          color: var(--muted);
          font-size: 0.875rem;
          line-height: 1.6;
        }

        ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        li {
          margin-bottom: 0.5rem;
        }

        a {
          color: var(--color-link, var(--accent));
          text-decoration: none;
          transition: all 150ms ease;
          text-decoration-thickness: 2px;
          text-underline-offset: 4px;
        }

        a:hover {
          text-decoration: none;
          color: var(--color-accent, #b8ff5c);
        }

        a:focus-visible {
          outline: 3px solid var(--accent);
          outline-offset: 2px;
          border-radius: 4px;
        }

        .footer-bottom {
          border-top: 1px solid var(--border);
          padding-top: 2rem;
          text-align: center;
          color: var(--muted);
          font-size: 0.75rem;
        }

        .footer-bottom p {
          margin: 0.25rem 0;
        }

        @media (max-width: 768px) {
          footer {
            padding-block: 2rem;
          }

          .footer-content {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }

          .footer-bottom {
            text-align: center;
          }
        }
      </style>

      <footer role="contentinfo">
        <div class="footer-container">
          <div class="footer-content">
            <section aria-labelledby="footer-about">
              <h2 id="footer-about">About</h2>
              <p>
                <strong>Monkey Got Thumbs</strong> helps everyday people get
                comfortable with AI and make little helpers of their own — no
                coding, no jargon, at your own pace, with a friendly community
                alongside you.
              </p>
            </section>

            <section aria-labelledby="footer-products">
              <h2 id="footer-products">Products</h2>
              <ul>
                <li><a href="/chatty/">chatyman</a></li>
                <li><a href="/build/advisor/">Agent Builder Advisor</a></li>
                <li><a href="/products/">All products</a></li>
                <li><a href="/build/">Make AI helpers</a></li>
              </ul>
            </section>

            <section aria-labelledby="footer-learning">
              <h2 id="footer-learning">Learning</h2>
              <ul>
                <li><a href="/learn/foundations/">Foundations</a></li>
                <li><a href="/learn/frameworks/">Frameworks</a></li>
                <li><a href="/learn/human-factors/">Human Factors</a></li>
                <li><a href="/notes/">Notes</a></li>
                <li><a href="/learn/influences.html">Influences &amp; Credits</a></li>
              </ul>
            </section>

            <section aria-labelledby="footer-community">
              <h2 id="footer-community">Community</h2>
              <ul>
                <li><a href="/community/">Get Involved</a></li>
                <li><a href="/resources/case-studies/">Case Studies</a></li>
                <li><a href="/resources/">External Resources</a></li>
                <li><a href="/contact/">Contact Us</a></li>
              </ul>
            </section>
          </div>

          <div class="footer-bottom">
            <p>&copy; 2026 Monkey Got Thumbs. All rights reserved.</p>
            <p>
              <a href="/accessibility/">Accessibility Statement</a> •
              <a href="/privacy/">Privacy Policy</a> •
              <a href="/terms/">Terms of Use</a>
            </p>
          </div>
        </div>
      </footer>
    `;
  }

  setupAccessibility() {
    const footer = this.shadowRoot.querySelector('footer');
    if (!footer.getAttribute('role')) {
      footer.setAttribute('role', 'contentinfo');
    }

    // Ensure all sections have proper heading structure
    const sections = this.shadowRoot.querySelectorAll('section');
    sections.forEach((section) => {
      const heading = section.querySelector('h2');
      if (heading && !section.getAttribute('aria-labelledby')) {
        section.setAttribute('aria-labelledby', heading.id || heading.textContent);
      }
    });
  }
}

// Register the component
customElements.define('mgt-footer', MGTFooter);

export { MGTFooter };
