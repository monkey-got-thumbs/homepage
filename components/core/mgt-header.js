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
          position: sticky;
          top: 0;
          z-index: 101;
          backdrop-filter: saturate(120%) blur(6px);
          background: var(--header-bg);
          border-bottom: 1px solid var(--header-border);
          transition: all 250ms ease;
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
