/**
 * Accessibility Utilities
 * Shared accessibility functions for web components
 */

/**
 * Trap focus within an element
 * @param {HTMLElement} element - The element to trap focus in
 * @returns {Function} Cleanup function to remove listeners
 */
export function trapFocus(element) {
  const focusableElements = element.querySelectorAll(
    'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );

  if (focusableElements.length === 0) return () => {};

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleKeydown = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  };

  element.addEventListener('keydown', handleKeydown);

  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleKeydown);
  };
}

/**
 * Announce a message to screen readers
 * @param {string} message - The message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
export function announceToScreenReader(message, priority = 'polite') {
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
 * Apply ARIA labels and attributes to an element
 * @param {HTMLElement} element - The element to apply ARIA to
 * @param {Object} options - ARIA options
 * @param {string} options.role - ARIA role
 * @param {string} options.label - aria-label
 * @param {string} options.labelledBy - aria-labelledby
 * @param {string} options.describedBy - aria-describedby
 * @param {boolean} options.hidden - aria-hidden
 * @param {string} options.expanded - aria-expanded
 * @param {string} options.controls - aria-controls
 */
export function applyAriaAttributes(element, options = {}) {
  if (options.role) element.setAttribute('role', options.role);
  if (options.label) element.setAttribute('aria-label', options.label);
  if (options.labelledBy) element.setAttribute('aria-labelledby', options.labelledBy);
  if (options.describedBy) element.setAttribute('aria-describedby', options.describedBy);
  if (options.hidden !== undefined) {
    element.setAttribute('aria-hidden', options.hidden.toString());
  }
  if (options.expanded !== undefined) {
    element.setAttribute('aria-expanded', options.expanded.toString());
  }
  if (options.controls) element.setAttribute('aria-controls', options.controls);
  if (options.current) element.setAttribute('aria-current', options.current);
}

/**
 * Make an element focusable
 * @param {HTMLElement} element - The element to make focusable
 * @param {number} tabindex - The tabindex value (default 0)
 */
export function makeFocusable(element, tabindex = 0) {
  element.setAttribute('tabindex', tabindex.toString());
}

/**
 * Remove focus from an element
 * @param {HTMLElement} element - The element to make non-focusable
 */
export function makeNotFocusable(element) {
  element.setAttribute('tabindex', '-1');
}

/**
 * Check if an element is keyboard accessible
 * @param {HTMLElement} element - The element to check
 * @returns {boolean} Whether the element is keyboard accessible
 */
export function isKeyboardAccessible(element) {
  const focusableSelectors = [
    'a[href]',
    'button',
    'textarea',
    'input',
    'select',
    '[tabindex]:not([tabindex="-1"])',
  ];

  return focusableSelectors.some((selector) =>
    element.matches(selector) || element.querySelector(selector)
  );
}

/**
 * Get focusable elements within a container
 * @param {HTMLElement} container - The container element
 * @returns {HTMLElement[]} Array of focusable elements
 */
export function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => {
    return !el.hasAttribute('disabled') && el.offsetParent !== null;
  });
}

/**
 * Focus an element and announce focus to screen readers
 * @param {HTMLElement} element - The element to focus
 * @param {string} announcement - Optional message to announce
 */
export function focusElement(element, announcement) {
  element.focus();

  if (announcement) {
    announceToScreenReader(announcement);
  }
}

/**
 * Check contrast ratio between two colors
 * @param {string} color1 - First color (hex, rgb, or named)
 * @param {string} color2 - Second color (hex, rgb, or named)
 * @returns {number} Contrast ratio
 */
export function getContrastRatio(color1, color2) {
  const getLuminance = (color) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance <= 0.5 ? luminance + 0.05 : luminance + 0.05;
  };

  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color combination meets WCAG AA standards
 * @param {string} foreground - Foreground color
 * @param {string} background - Background color
 * @param {boolean} largeText - Whether the text is large (18pt+)
 * @returns {boolean} Whether the colors meet WCAG AA
 */
export function meetsWCAG_AA(foreground, background, largeText = false) {
  const ratio = getContrastRatio(foreground, background);
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if a color combination meets WCAG AAA standards
 * @param {string} foreground - Foreground color
 * @param {string} background - Background color
 * @param {boolean} largeText - Whether the text is large (18pt+)
 * @returns {boolean} Whether the colors meet WCAG AAA
 */
export function meetsWCAG_AAA(foreground, background, largeText = false) {
  const ratio = getContrastRatio(foreground, background);
  return largeText ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Debounce a function with screen reader announcement
 * @param {Function} callback - The function to debounce
 * @param {number} delay - The delay in milliseconds
 * @param {string} announcement - Optional screen reader announcement
 * @returns {Function} The debounced function
 */
export function debounceWithA11y(callback, delay = 250, announcement) {
  let timeoutId;

  return function (...args) {
    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      callback.apply(this, args);

      if (announcement) {
        announceToScreenReader(announcement);
      }
    }, delay);
  };
}

/**
 * Skip to main content (for skip links)
 * @param {string} mainSelector - CSS selector for main content
 */
export function skipToMain(mainSelector = 'main') {
  const main = document.querySelector(mainSelector);
  if (main) {
    main.setAttribute('tabindex', '-1');
    main.focus();
    main.addEventListener('blur', () => {
      main.removeAttribute('tabindex');
    });
  }
}

/**
 * Create a screen reader only element
 * @param {string} text - The text to display to screen readers only
 * @returns {HTMLElement} The created element
 */
export function createSROnly(text) {
  const element = document.createElement('span');
  element.className = 'sr-only';
  element.textContent = text;
  return element;
}

export default {
  trapFocus,
  announceToScreenReader,
  applyAriaAttributes,
  makeFocusable,
  makeNotFocusable,
  isKeyboardAccessible,
  getFocusableElements,
  focusElement,
  getContrastRatio,
  meetsWCAG_AA,
  meetsWCAG_AAA,
  debounceWithA11y,
  skipToMain,
  createSROnly,
};
