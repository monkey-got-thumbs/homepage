/**
 * Monkey Got Thumbs - Main Application
 * Initializes web components and sets up global event listeners
 */

// ===== IMPORT COMPONENTS =====
// Components will be imported as they are created
// import { MGTHeader } from '../components/core/mgt-header.js';
// import { MGTFooter } from '../components/core/mgt-footer.js';

// ===== GLOBAL CONFIGURATION =====

const CONFIG = {
  siteTitle: 'Monkey Got Thumbs',
  siteDescription: 'Augmented Intelligence Amplifies Time',
  rootUrl: '/',
  debounceDelay: 250,
  focusOutlineWidth: '3px',
  focusOutlineColor: '#A6FF4D',
};

// ===== UTILITY FUNCTIONS =====

/**
 * Announce message to screen readers
 * @param {string} message - The message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
function announceToScreenReader(message, priority = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);

  setTimeout(() => announcement.remove(), 1000);
}

/**
 * Debounce function to limit rate of callback execution
 * @param {Function} callback
 * @param {number} delay
 * @returns {Function}
 */
function debounce(callback, delay = CONFIG.debounceDelay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback.apply(this, args), delay);
  };
}

/**
 * Add focus visible styles to interactive elements
 */
function setupAccessibilityBaseline() {
  const style = document.createElement('style');
  style.textContent = `
    :focus-visible {
      outline: ${CONFIG.focusOutlineWidth} solid ${CONFIG.focusOutlineColor};
      outline-offset: 2px;
      border-radius: 6px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Setup skip-to-content link
 */
function setupSkipLink() {
  // Ensure main content has the skip target id (every page's static link points here)
  const main = document.querySelector('main');
  if (main && !main.id) {
    main.id = 'main-content';
  }
  // Pages already ship a static .skip-link in the HTML — don't add a duplicate
  if (document.querySelector('.skip-link')) return;
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.textContent = 'Skip to main content';
  skipLink.className = 'skip-link';
  document.body.insertBefore(skipLink, document.body.firstChild);
}

/**
 * Setup keyboard navigation
 */
function setupKeyboardNavigation() {
  // Escape key to close modals/dropdowns
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Dispatch custom event for components to listen to
      const escapeEvent = new CustomEvent('escape-pressed', {
        bubbles: true,
        detail: { keyboardEvent: e },
      });
      document.dispatchEvent(escapeEvent);
    }
  });
}

/**
 * Setup smooth scroll behavior
 */
function setupSmoothScroll() {
  // Respect the user's reduced-motion preference (don't force smooth)
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.style.scrollBehavior = 'smooth';
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    const targetId = link.getAttribute('href');
    if (targetId === '#') return;

    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Make non-interactive targets (e.g. an <h2>) focusable so focus() actually lands
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  });
}

/**
 * Detect dark/light mode preference and set accordingly
 */
function setupThemePreference() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)');

  // Currently dark mode is default, but prepare for future theme toggle
  document.documentElement.setAttribute('data-theme', 'dark');

  // Listen for system theme changes
  prefersDark.addEventListener('change', (e) => {
    if (e.matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  });

  prefersLight.addEventListener('change', (e) => {
    if (e.matches) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  });
}

/**
 * Setup reduced motion support
 */
function setupReducedMotion() {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  if (prefersReducedMotion.matches) {
    document.documentElement.style.scrollBehavior = 'auto';
  }

  prefersReducedMotion.addEventListener('change', (e) => {
    if (e.matches) {
      document.documentElement.style.scrollBehavior = 'auto';
    } else {
      document.documentElement.style.scrollBehavior = 'smooth';
    }
  });
}

/**
 * Setup viewport meta tag for responsive design
 */
function ensureViewportMeta() {
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content =
      'width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover';
    document.head.appendChild(viewport);
  }
}

/**
 * Inject the chatyman support widget site-wide.
 * chatyman is our own in-browser chatbot product (see /chatty/). It self-mounts
 * a floating launcher and reads /chatyman.json; the model only loads once a user
 * opens the chat, so this is free until engaged. Pages that embed their own
 * chatyman instance (e.g. the /chatty live demo) are left alone.
 */
function loadChatyman() {
  if (window.__chatymanLoaded) return;
  if (document.querySelector('script[src*="chatyman.js"]')) return;
  const s = document.createElement('script');
  s.src = '/chatyman.js';
  s.defer = true;
  document.body.appendChild(s);
}

/**
 * Check if browser supports required features
 */
function checkBrowserSupport() {
  const features = {
    webComponents: 'customElements' in window,
    shadowDOM: 'attachShadow' in Element.prototype,
    templates: 'content' in document.createElement('template'),
    cssVariables: 'registerProperty' in CSS,
  };

  const unsupported = Object.entries(features)
    .filter(([, supported]) => !supported)
    .map(([feature]) => feature);

  if (unsupported.length > 0) {
    console.warn('Missing browser features:', unsupported);
    // Some features might not be available, but core functionality should work
  }

  return features;
}

/**
 * Initialize analytics (privacy-focused)
 */
function initializeAnalytics() {
  // Analytics will be set up here when configured
  // Using privacy-focused service like Plausible or Fathom
}

// ===== INITIALIZATION FUNCTION =====

async function init() {
  try {
    // Step 1: Check browser support
    const support = checkBrowserSupport();
    if (!support.webComponents) {
      console.warn(
        'Web Components not fully supported. Some features may be limited.'
      );
    }

    // Step 2: Ensure viewport meta tag
    ensureViewportMeta();

    // Step 3: Set up accessibility features
    setupAccessibilityBaseline();
    setupSkipLink();
    setupKeyboardNavigation();

    // Step 4: Set up theme and motion preferences
    setupThemePreference();
    setupReducedMotion();

    // Step 5: Set up scroll behavior
    setupSmoothScroll();

    // Step 6: Initialize analytics
    initializeAnalytics();

    // Step 8: Inject the site-wide chatyman support widget
    loadChatyman();

    // Step 8: Dispatch initialization complete event
    const initEvent = new CustomEvent('app-initialized', {
      detail: { config: CONFIG, browserSupport: support },
    });
    document.dispatchEvent(initEvent);

    console.log('Monkey Got Thumbs initialized successfully');
  } catch (error) {
    console.error('Error during app initialization:', error);
  }
}

// ===== STARTUP =====

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ===== EXPORTS FOR GLOBAL USE =====

window.MGT = {
  config: CONFIG,
  announceToScreenReader,
  debounce,
};

export { CONFIG, announceToScreenReader, debounce };
