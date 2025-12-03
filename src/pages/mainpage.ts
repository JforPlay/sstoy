/**
 * Main Page Module
 * Handles landing page functionality including patch notes
 */

// Import shared utilities
import '../shared';
import '../i18n';

let patchNotesLoaded = false;

/**
 * Load patch notes from JSON file
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
    console.error('Failed to load patch notes:', error);
    const modalBody = document.querySelector('.patch-modal-body');
    if (modalBody) {
      modalBody.innerHTML =
        '<p style="color: var(--text-secondary); padding: 2rem; text-align: center;">Failed to load patch notes.</p>';
    }
  }
}

/**
 * Open patch notes modal
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
 * Close patch notes modal
 */
function closePatchNotesModal(): void {
  const modal = document.getElementById('patch-notes-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  document.body.style.overflow = 'auto';
}

/**
 * Initialize main page animations and logic
 */
async function initMainPage(): Promise<void> {
  // Initialize i18n
  await window.i18n?.init();

  // Scroll Reveal Animation
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  const animatedElements = document.querySelectorAll('.hero-content, .hero-visual, .bento-card');
  animatedElements.forEach((el) => {
    el.classList.add('fade-in-element');
    observer.observe(el);
  });

  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    const modal = document.getElementById('patch-notes-modal');
    if (event.target === modal) {
      closePatchNotesModal();
    }
  });

  // Close modal with ESC key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePatchNotesModal();
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMainPage);
} else {
  initMainPage();
}

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