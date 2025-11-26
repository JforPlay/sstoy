/**
 * Main Page Module
 * Handles landing page functionality including patch notes
 */

// Import shared utilities
import '@/shared';
import '@/i18n';

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
        '<p style="color: var(--text-secondary); padding: 2rem; text-align: center;">패치 노트를 불러오는데 실패했습니다.</p>';
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
 * Initialize carousel functionality
 */
function initCarousel(): void {
  const navItems = document.querySelectorAll('.nav-item');
  const carousel = document.getElementById('carousel');
  const slides = document.querySelectorAll('.carousel-slide');
  const scrollDots = document.querySelectorAll('.scroll-dot');

  if (!carousel || slides.length === 0) return;

  // Click navigation to scroll carousel
  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const slideIndex = parseInt(item.getAttribute('data-slide') || '0');
      const targetSlide = slides[slideIndex];

      if (targetSlide) {
        // Scroll to slide
        targetSlide.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Update active states
        updateActiveStates(slideIndex);
      }
    });
  });

  // Update active states on scroll
  carousel.addEventListener('scroll', () => {
    const scrollPosition = carousel.scrollTop;
    const windowHeight = window.innerHeight;

    let currentSlide = 0;
    slides.forEach((slide, index) => {
      const slideTop = (slide as HTMLElement).offsetTop;
      if (scrollPosition >= slideTop - windowHeight / 2) {
        currentSlide = index;
      }
    });

    updateActiveStates(currentSlide);
  });

  // Click scroll dots to navigate
  scrollDots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      const targetSlide = slides[index];
      if (targetSlide) {
        targetSlide.scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateActiveStates(index);
      }
    });
  });

  function updateActiveStates(index: number): void {
    // Update navigation
    navItems.forEach((item, i) => {
      if (i === index) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update scroll dots
    scrollDots.forEach((dot, i) => {
      if (i === index) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    // Update active slide for animation
    slides.forEach((slide, i) => {
      if (i === index) {
        slide.classList.add('active-slide');
      } else {
        slide.classList.remove('active-slide');
      }
    });
  }

  // Initialize first slide as active
  updateActiveStates(0);

  // Mouse wheel navigation for smoother scrolling
  carousel.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      carousel.scrollBy({
        top: e.deltaY,
        behavior: 'smooth',
      });
    },
    { passive: false }
  );
}

/**
 * Initialize main page
 */
async function initMainPage(): Promise<void> {
  // Initialize theme first
  if (typeof window.initTheme === 'function') {
    window.initTheme();
  }

  // Then initialize i18n
  await window.i18n?.init();

  // Initialize carousel
  initCarousel();

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
    initTheme?: () => void;
    openPatchNotesModal: () => Promise<void>;
    closePatchNotesModal: () => void;
  }
}

export { openPatchNotesModal, closePatchNotesModal };
