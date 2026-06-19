/**
 * <mgt-newsletter> — Newsletter signup web component
 *
 * Usage: <mgt-newsletter></mgt-newsletter>
 * Optional attributes:
 *   heading="Custom Heading"
 *   description="Custom description text"
 *   compact  (renders a smaller inline version)
 */
class MGTNewsletter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupForm();
  }

  get heading() {
    return this.getAttribute('heading') || 'Stay Ahead of AI';
  }

  get description() {
    return this.getAttribute('description') || 'Get practical augmented intelligence insights delivered to your inbox. No spam, no hype — just real strategies for working with AI.';
  }

  get compact() {
    return this.hasAttribute('compact');
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .newsletter {
          background: var(--color-bg-secondary, #17122B);
          border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
          border-radius: var(--radius, 12px);
          padding: ${this.compact ? '1.5rem' : '2.5rem 2rem'};
          text-align: center;
        }

        h2 {
          font-family: var(--font-display, 'Bangers', cursive);
          font-size: ${this.compact ? '1.5rem' : '2rem'};
          color: var(--color-accent, #A6FF4D);
          margin: 0 0 0.5rem 0;
          letter-spacing: 0.02em;
        }

        .desc {
          color: var(--color-fg-secondary, #F3F2FA);
          font-size: 1rem;
          line-height: 1.6;
          margin: 0 0 1.5rem 0;
          max-width: 32rem;
          margin-left: auto;
          margin-right: auto;
        }

        form {
          display: flex;
          gap: 0.75rem;
          max-width: 28rem;
          margin: 0 auto;
          flex-wrap: wrap;
          justify-content: center;
        }

        label {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }

        input[type="email"] {
          flex: 1;
          min-width: 200px;
          padding: 0.75rem 1rem;
          border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
          border-radius: var(--radius-sm, 8px);
          background: var(--color-bg, #0E0B1A);
          color: var(--color-fg, #EDECF6);
          font-family: var(--font-sans, 'Montserrat', sans-serif);
          font-size: 1rem;
        }

        input[type="email"]::placeholder {
          color: var(--color-muted, #B9B5D3);
        }

        input[type="email"]:focus {
          outline: 3px solid var(--color-accent, #A6FF4D);
          outline-offset: 2px;
          border-color: var(--color-accent, #A6FF4D);
        }

        .honeypot {
          position: absolute;
          left: -9999px;
          opacity: 0;
          height: 0;
          width: 0;
          overflow: hidden;
        }

        button {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: var(--radius-sm, 8px);
          background: linear-gradient(135deg, var(--color-brand-light, #6A55C0), var(--color-brand, #503E94));
          color: #fff;
          font-family: var(--font-sans, 'Montserrat', sans-serif);
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: transform 150ms ease, box-shadow 150ms ease;
          white-space: nowrap;
        }

        button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(80, 62, 148, 0.4);
        }

        button:focus-visible {
          outline: 3px solid var(--color-accent, #A6FF4D);
          outline-offset: 2px;
        }

        button:active {
          transform: translateY(0);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .status {
          margin-top: 1rem;
          font-size: 0.875rem;
          min-height: 1.5rem;
        }

        .status.success {
          color: var(--color-success, #4ADE80);
        }

        .status.error {
          color: var(--color-error, #F87171);
        }

        @media (prefers-reduced-motion: reduce) {
          button { transition: none; }
        }
      </style>

      <div class="newsletter">
        <h2>${this.heading}</h2>
        ${this.compact ? '' : `<p class="desc">${this.description}</p>`}
        <form novalidate>
          <label for="nl-email">Email address</label>
          <input type="email" id="nl-email" name="email" placeholder="you@example.com" required autocomplete="email" aria-describedby="nl-status" />
          <div class="honeypot" aria-hidden="true">
            <label for="nl-website">Website</label>
            <input type="text" id="nl-website" name="website" tabindex="-1" autocomplete="off" />
          </div>
          <button type="submit">Subscribe</button>
        </form>
        <div class="status" id="nl-status" role="status" aria-live="polite" aria-atomic="true"></div>
      </div>
    `;
  }

  setupForm() {
    const form = this.shadowRoot.querySelector('form');
    const emailInput = this.shadowRoot.querySelector('input[type="email"]');
    const honeypot = this.shadowRoot.querySelector('input[name="website"]');
    const button = this.shadowRoot.querySelector('button');
    const status = this.shadowRoot.querySelector('.status');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput.value.trim();
      if (!email || !email.includes('@') || !email.includes('.')) {
        status.textContent = 'Please enter a valid email address.';
        status.className = 'status error';
        emailInput.focus();
        return;
      }

      if (honeypot.value) {
        status.textContent = 'Thanks for subscribing!';
        status.className = 'status success';
        return;
      }

      button.disabled = true;
      button.textContent = 'Subscribing...';
      status.textContent = '';
      status.className = 'status';

      try {
        if (window.MGT_TRACKING && window.MGT_TRACKING.submitSignup) {
          await window.MGT_TRACKING.submitSignup(email);
        }

        if (window.MGT_TRACKING && window.MGT_TRACKING.trackEvent) {
          window.MGT_TRACKING.trackEvent('newsletter_signup', { page: window.location.pathname });
        }

        status.textContent = 'You\'re in! Check your inbox for a welcome email.';
        status.className = 'status success';
        emailInput.value = '';
        form.style.display = 'none';
      } catch (err) {
        status.textContent = 'Something went wrong. Please try again.';
        status.className = 'status error';
        button.disabled = false;
        button.textContent = 'Subscribe';
      }
    });
  }
}

customElements.define('mgt-newsletter', MGTNewsletter);
