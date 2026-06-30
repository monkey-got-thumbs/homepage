/**
 * MGTHeader - Main Header Navigation Component
 * Sticky header with logo and navigation menu
 * Fully accessible with keyboard support and ARIA labels
 */

class MGTHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isMenuOpen = false;
  }

  connectedCallback() {
    this.render();
    this.setupAccessibility();
    this.attachEventListeners();
    this.setupCogSlider();
    // Header is position:fixed, so reserve its height on the page so content
    // doesn't slide underneath it. Re-measure after the logo/fonts settle.
    this.syncHeight();
    requestAnimationFrame(() => this.syncHeight());
    const logo = this.shadowRoot.querySelector('.brand-logo');
    if (logo) logo.addEventListener('load', () => this.syncHeight());
    window.addEventListener('load', () => this.syncHeight());
  }

  syncHeight() {
    const header = this.shadowRoot && this.shadowRoot.querySelector('header');
    if (header) document.body.style.paddingBlockStart = header.offsetHeight + 'px';
  }

  // Reading-level slider — drives the shared accessibility engine (window.__A11Y),
  // ramps the monkey-handle inversion from 0 (level 1) to 1 (level 5), and stays
  // in sync if the level is changed elsewhere (e.g. the panel or Reset).
  setupCogSlider() {
    const s = this.shadowRoot && this.shadowRoot.getElementById('cogSlider');
    if (!s) return;
    const curLevel = () => {
      const v = parseInt(document.documentElement.getAttribute('data-level') || '3', 10);
      return v >= 1 && v <= 5 ? v : 3;
    };
    const setInvert = (v) => s.style.setProperty('--mk-invert', ((v - 1) / 4).toFixed(3));
    const reflect = () => {
      const v = curLevel();
      if (s.value !== String(v)) s.value = String(v);
      setInvert(v);
      s.setAttribute('aria-valuetext', 'Reading level ' + v + ' of 5');
    };
    reflect();
    s.addEventListener('input', () => {
      const v = parseInt(s.value, 10) || 3;
      setInvert(v);
      if (window.__A11Y && typeof window.__A11Y.set === 'function') {
        window.__A11Y.set('level', String(v)); // string keeps it consistent with the panel buttons
      } else {
        document.documentElement.setAttribute('data-level', String(v));
        try { localStorage.setItem('a11y.level', String(v)); } catch (e) {}
      }
    });
    if (window.MutationObserver) {
      new MutationObserver(reflect).observe(document.documentElement, { attributes: true, attributeFilter: ['data-level'] });
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --header-bg: color-mix(in srgb, #000 60%, transparent);
          --header-border: rgba(255, 255, 255, 0.08);
          --accent: #A6FF4D;
        }

        header {
          position: fixed;
          top: 0;
          inset-inline: 0;
          z-index: 101;
          backdrop-filter: saturate(120%) blur(6px);
          background: var(--header-bg);
          border-bottom: 1px solid var(--header-border);
          transition: background 250ms ease, border-color 250ms ease;
        }

        .header-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: var(--container-wide, 90rem);
          margin: 0 auto;
          padding: 0.75rem var(--gutter, 1rem);
          box-sizing: border-box;   /* shadow DOM doesn't inherit the page's border-box */
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          font-weight: 700;
          color: var(--accent);
          transition: all 150ms ease;
        }

        .brand:hover {
          opacity: 0.9;
        }

        .brand:focus-visible {
          outline: 3px solid var(--accent);
          outline-offset: 2px;
          border-radius: 8px;
        }

        .brand-logo {
          width: 80px;
          height: 80px;
          object-fit: contain;   /* logo is 200x300 — contain prevents squashing into the square box */
          border-radius: 8px;
          flex-shrink: 0;
          filter: var(--logo-filter, none);   /* per-scheme adaptation (custom props pierce shadow DOM) */
        }

        .brand-text {
          display: none;   /* logo only — wordmark removed */
        }

        .nav-toggle {
          display: none;
          appearance: none;
          border: none;
          background: none;
          cursor: pointer;
          padding: 0.5rem;
          color: var(--accent);
          font-size: 1.5rem;
          z-index: 102;
        }

        .nav-toggle:hover {
          opacity: 0.8;
        }

        .nav-toggle:focus-visible {
          outline: 3px solid var(--accent);
          outline-offset: 2px;
          border-radius: 6px;
        }

        @media (max-width: 767px) {
          .nav-toggle {
            display: block;
          }
        }

        nav {
          display: flex;
          align-items: center;
          gap: 2rem;
        }

        @media (max-width: 767px) {
          nav {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            flex-direction: column;
            gap: 0;
            background: color-mix(in srgb, #000 85%, transparent);
            border-bottom: 1px solid var(--header-border);
            padding: 1rem;
            max-height: 0;
            overflow: hidden;
            visibility: hidden;   /* take the collapsed links out of the tab order + a11y tree (WCAG 2.4.3) */
            transition: max-height 300ms ease, padding 300ms ease;
          }

          nav.open {
            max-height: 500px;
            padding: 1rem;
            visibility: visible;
          }
        }

        nav a {
          color: #EDECF6;
          text-decoration: none;
          font-weight: 600;
          transition: color 150ms ease;
          padding: 0.5rem 0;
        }

        nav a:hover {
          color: var(--accent);
        }

        nav a:focus-visible {
          outline: 3px solid var(--accent);
          outline-offset: 4px;
          border-radius: 4px;
        }

        nav a[aria-current="page"] {
          color: var(--accent);
          position: relative;
        }

        nav a[aria-current="page"]::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--accent);
        }

        nav a.nav-cta {
          color: #11210a;
          background: var(--accent);
          padding: 0.4rem 0.85rem;
          border-radius: 999px;
          font-weight: 700;
        }

        nav a.nav-cta:hover {
          color: #11210a;
          filter: brightness(1.08);
        }

        nav a.nav-cta[aria-current="page"]::after {
          display: none;
        }

        @media (max-width: 767px) {
          nav a.nav-cta {
            display: inline-block;
            margin-top: 0.5rem;
          }
        }

        /* ===== Reading-level (cognitive-load) slider — the monkey-face handle
           rides the header's bottom line. Left = simplest (level 1, lowest load),
           right = densest (level 5, highest load); the monkey inverts across. ===== */
        .cog-slider {
          position: absolute;
          inset-inline: clamp(1rem, 6vw, 5rem);
          bottom: 0;
          transform: translateY(50%);
          block-size: 28px;
          margin: 0;
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
          z-index: 102;
          --mk-invert: 0.5;
        }
        .cog-slider::-webkit-slider-runnable-track { block-size: 2px; background: transparent; }
        .cog-slider::-moz-range-track { block-size: 2px; background: transparent; }
        .cog-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          inline-size: 28px; block-size: 28px; border-radius: 50%;
          box-sizing: border-box;
          background: var(--header-bg) url("/favicon.png") center/cover no-repeat;
          border: 2px solid var(--accent);
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
          filter: invert(var(--mk-invert));
          margin-top: -13px;
        }
        .cog-slider::-moz-range-thumb {
          inline-size: 28px; block-size: 28px; border-radius: 50%;
          box-sizing: border-box;
          background: var(--header-bg) url("/favicon.png") center/cover no-repeat;
          border: 2px solid var(--accent);
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
          filter: invert(var(--mk-invert));
        }
        .cog-slider:focus-visible { outline: none; }
        .cog-slider:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px var(--accent); }
        .cog-slider:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 3px var(--accent); }
        @media (max-width: 767px) { .cog-slider { inset-inline: 1rem 4rem; } }
      </style>

      <header role="banner">
        <div class="header-container">
          <a class="brand" href="/" aria-label="Monkey Got Thumbs home">
            <img
              src="/logo.png"
              alt="Monkey Got Thumbs logo"
              class="brand-logo"
              width="80"
              height="80"
              decoding="async"
              loading="eager"
            />
            <span class="brand-text">Monkey Got Thumbs</span>
          </a>

          <button
            class="nav-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded="false"
            aria-controls="main-nav"
          >
            ☰
          </button>

          <nav id="main-nav" role="navigation" aria-label="Primary">
            <a href="/">Home</a>
            <a href="/basics/">Basics</a>
            <a href="/discover/">Discover</a>
            <a href="/explore/">Explore</a>
            <a href="/build/">Build</a>
          </nav>
        </div>
        <input type="range" class="cog-slider" id="cogSlider" min="1" max="5" step="1" value="3"
          aria-label="Reading level — slide left for the simplest version, right for the densest"
          title="Reading level — left: simplest · right: densest" />
      </header>
    `;
  }

  setupAccessibility() {
    // Get interactive elements
    this.navToggle = this.shadowRoot.querySelector('.nav-toggle');
    this.nav = this.shadowRoot.querySelector('nav');

    // Ensure proper ARIA roles
    const header = this.shadowRoot.querySelector('header');
    if (!header.getAttribute('role')) {
      header.setAttribute('role', 'banner');
    }

    // Trap focus when the mobile menu is open (handler self-gates at runtime)
    this.setupFocusTrap();
  }

  attachEventListeners() {
    if (!this.navToggle) return;

    // Toggle menu on button click
    this.navToggle.addEventListener('click', () => {
      this.toggleMenu();
    });

    // Close menu when link is clicked
    const navLinks = this.shadowRoot.querySelectorAll('nav a');
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        this.closeMenu();
      });
    });

    // Close menu on Escape key
    document.addEventListener('escape-pressed', () => {
      this.closeMenu();
    });

    // Update active link based on current page
    this.updateActiveLink();

    // Listen for navigation changes
    window.addEventListener('popstate', () => {
      this.updateActiveLink();
    });

    // Handle resize
    const resizeHandler = () => {
      if (window.innerWidth >= 768) {
        this.closeMenu();
      }
      this.syncHeight();
    };

    window.addEventListener('resize', resizeHandler);
  }

  toggleMenu() {
    if (this.isMenuOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    this.isMenuOpen = true;
    this.nav.classList.add('open');
    this.navToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  closeMenu() {
    this.isMenuOpen = false;
    this.nav.classList.remove('open');
    this.navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  setupFocusTrap() {
    // Attach once; only traps while the mobile menu is actually open.
    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !this.isMenuOpen || window.innerWidth >= 768) return;
      const focusable = this.shadowRoot.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && this.shadowRoot.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && this.shadowRoot.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  updateActiveLink() {
    const currentPath = window.location.pathname;
    const links = this.shadowRoot.querySelectorAll('nav a');

    links.forEach((link) => {
      const href = link.getAttribute('href');
      // Section-prefix match so deep pages (e.g. /basics/memory/) light their nav item.
      // Discover/Explore are section roots that front /infographics/ and /explorables/.
      const isCurrentPage = href === currentPath ||
                           (href !== '/' && currentPath.startsWith(href)) ||
                           (href === '/discover/' && currentPath.startsWith('/infographics')) ||
                           (href === '/explore/' && currentPath.startsWith('/explorables'));

      if (isCurrentPage) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  // Public methods for external control
  toggle() {
    this.toggleMenu();
  }

  open() {
    this.openMenu();
  }

  close() {
    this.closeMenu();
  }
}

// Register the component
customElements.define('mgt-header', MGTHeader);

export { MGTHeader };
