/**
 * Main Landing Page Module - Entry Point
 *
 * Entry point for the main landing page (index.html). Handles scroll-based
 * reveal animations, patch notes modal, and hero section interactions.
 * Features optimized IntersectionObserver implementation with automatic cleanup.
 *
 * Key Features:
 * - Scroll-based reveal animations for hero content and bento cards
 * - Patch notes modal with lazy loading from JSON
 * - Automatic observer cleanup after all elements are revealed
 * - Event listener management with proper cleanup
 * - Keyboard shortcuts (ESC to close modal)
 * - Click-outside-to-close modal behavior
 *
 * Performance Optimizations:
 * - IntersectionObserver auto-disconnect when all elements observed
 * - Patch notes loaded only once (cached after first load)
 * - Event listener cleanup on page unload
 *
 * @module pages/mainpage
 * @see {@link shared/i18n} For internationalization
 */

// Import shared utilities
import '../shared';
import '../i18n';

// =============================================================================
// STATE
// =============================================================================

/** Tracks whether patch notes have been loaded to avoid redundant fetches */
let patchNotesLoaded = false;

// =============================================================================
// PATCH NOTES
// =============================================================================

/**
 * Loads and displays patch notes from JSON file
 *
 * Fetches patchnotes.json and renders entries in the modal body.
 * Only loads once - subsequent calls return immediately.
 *
 * Format: Array of { version, date, changes[] } objects
 *
 * @throws {Error} If fetch fails (displays error message in modal)
 */
async function loadPatchNotes(): Promise<void> {
  if (patchNotesLoaded) return;

  try {
    const response = await fetch('patchnotes.json');
    const patchNotes = await response.json();

    const modalBody = document.querySelector('.patch-modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = patchNotes
      .map(
        (entry: { version: string; date: string; changes: { category: string; items: string[] }[] }) => `
        <div class="patch-entry">
            <div class="patch-version">${entry.version}</div>
            <div class="patch-date">${entry.date}</div>
            <div class="patch-changes">
                ${entry.changes
                  .map(
                    (change) => `
                    <h4>${change.category}</h4>
                    <ul>
                        ${change.items.map((item) => `<li>${item}</li>`).join('')}
                    </ul>
                `
                  )
                  .join('')}
            </div>
        </div>
    `
      )
      .join('');

    patchNotesLoaded = true;
  } catch (error) {
    console.error('[MainPage] Failed to load patch notes:', error);
    const modalBody = document.querySelector('.patch-modal-body');
    if (modalBody) {
      modalBody.innerHTML =
        '<p style="color: var(--text-secondary); padding: 2rem; text-align: center;">Failed to load patch notes.</p>';
    }
  }
}

/**
 * Opens patch notes modal and loads content
 *
 * Triggers lazy loading of patch notes on first open.
 * Prevents body scrolling while modal is open.
 */
async function openPatchNotesModal(): Promise<void> {
  await loadPatchNotes();
  const modal = document.getElementById('patch-notes-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
  document.body.style.overflow = 'hidden';
}

/**
 * Closes patch notes modal and restores body scrolling
 */
function closePatchNotesModal(): void {
  const modal = document.getElementById('patch-notes-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  document.body.style.overflow = 'auto';
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initializes main page animations and event handlers
 *
 * Implements IntersectionObserver-based scroll reveal animations with
 * automatic cleanup. Observer disconnects after all elements are revealed
 * to improve performance.
 *
 * Event Handlers:
 * - Click outside modal to close
 * - ESC key to close modal
 * - Automatic cleanup on page unload
 */
async function initMainPage(): Promise<void> {
  // Initialize i18n
  await window.i18n?.init();

  // Scroll Reveal Animation - with proper cleanup
  let observedCount = 0;
  const animatedElements = document.querySelectorAll('.hero-content, .hero-visual, .bento-card');
  observedCount = animatedElements.length;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
          observedCount--;

          // Disconnect observer when all elements are observed
          if (observedCount === 0) {
            observer.disconnect();
          }
        }
      });
    },
    { threshold: 0.1 }
  );

  animatedElements.forEach((el) => {
    el.classList.add('fade-in-element');
    observer.observe(el);
  });

  // Event handlers - defined separately for cleanup
  const handleModalClick = (event: MouseEvent) => {
    const modal = document.getElementById('patch-notes-modal');
    if (event.target === modal) {
      closePatchNotesModal();
    }
  };

  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closePatchNotesModal();
    }
  };

  // Add event listeners
  window.addEventListener('click', handleModalClick);
  document.addEventListener('keydown', handleEscapeKey);

  // Cleanup on page unload (if needed in future SPA navigation)
  window.addEventListener('beforeunload', () => {
    window.removeEventListener('click', handleModalClick);
    document.removeEventListener('keydown', handleEscapeKey);
    observer.disconnect();
  }, { once: true });
}

// =============================================================================
// ENTRY POINT
// =============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMainPage);
} else {
  initMainPage();
}

// =============================================================================
// GLOBAL EXPORTS (for HTML onclick handlers)
// =============================================================================

// Export for global access
window.openPatchNotesModal = openPatchNotesModal;
window.closePatchNotesModal = closePatchNotesModal;

// Extend Window interface
declare global {
  interface Window {
    openPatchNotesModal: () => Promise<void>;
    closePatchNotesModal: () => void;
  }
}

export { openPatchNotesModal, closePatchNotesModal };