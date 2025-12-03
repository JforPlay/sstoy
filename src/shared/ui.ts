/**
 * UI Utilities Module
 * Themes, Icons, Toasts, and Navbar
 */

// =============================================================================
// ICON SYSTEM
// =============================================================================

export const ICONS: Record<string, string> = {
  // Navigation & Core
  logo: 'fa-solid fa-star',
  characterDB: 'fa-solid fa-book',
  pottery: 'fa-solid fa-medal',
  tasks: 'fa-solid fa-clipboard-list',
  resources: 'fa-solid fa-box',
  guide: 'fa-solid fa-book-open',
  // Positions & Characters
  people: 'fa-solid fa-users',
  master: 'fa-solid fa-crown',
  assist: 'fa-solid fa-chess-pawn',
  // Features & Sections
  dating: 'fa-solid fa-heart',
  images: 'fa-solid fa-image',
  archive: 'fa-solid fa-book-bookmark',
  stats: 'fa-solid fa-chart-bar',
  disc: 'fa-solid fa-compact-disc',
  summary: 'fa-solid fa-list-check',
  chat: 'fa-solid fa-message',
  comments: 'fa-solid fa-comments',
  // UI Elements
  search: 'fa-solid fa-magnifying-glass',
  filter: 'fa-solid fa-filter',
  star: 'fa-solid fa-star',
  plus: 'fa-solid fa-plus',
  remove: 'fa-solid fa-xmark',
  change: 'fa-solid fa-arrow-rotate-right',
  memo: 'fa-solid fa-sticky-note',
  share: 'fa-solid fa-share-nodes',
  download: 'fa-solid fa-download',
  upload: 'fa-solid fa-upload',
  // Stats & Numbers
  attackPower: 'fa-solid fa-gavel',
  critPower: 'fa-solid fa-burst',
  impactPower: 'fa-solid fa-bolt',
  // Character Stats (for characterdb stats display)
  attack: 'fa-solid fa-hand-fist',
  hp: 'fa-solid fa-heart',
  defense: 'fa-solid fa-shield',
  accuracy: 'fa-solid fa-bullseye',
  critRate: 'fa-solid fa-star-half-stroke',
  // Toast Notifications
  error: 'fa-solid fa-circle-exclamation',
  warning: 'fa-solid fa-triangle-exclamation',
  success: 'fa-solid fa-circle-check',
  info: 'fa-solid fa-circle-info',
  //Misc
  sun: 'fa-solid fa-sun',
  moon: 'fa-solid fa-moon',
  birthday: 'fa-solid fa-cake-candles',
};

/**
 * Get icon HTML string
 */
export function getIcon(iconName: string, additionalClasses = ''): string {
  const iconClass = ICONS[iconName] || ICONS.star;
  return `<i class="${iconClass} ${additionalClasses}"></i>`;
}

/**
 * Create icon element
 */
export function createIconElement(iconName: string, additionalClasses = ''): HTMLElement {
  const i = document.createElement('i');
  const iconClass = ICONS[iconName] || ICONS.star;
  i.className = `${iconClass} ${additionalClasses}`.trim();
  return i;
}

// =============================================================================
// THEME MANAGEMENT
// =============================================================================

/**
 * Set theme
 */
export function setTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);

  // Update theme toggle button icon and text
  // Show the mode it will switch TO (opposite of current)
  const themeToggles = document.querySelectorAll('#theme-toggle');
  themeToggles.forEach((toggle) => {
    const icon = toggle.querySelector('.theme-icon') as HTMLElement;
    const text = toggle.querySelector('.theme-text') as HTMLElement;
    if (icon) {
      if (theme === 'dark') {
        // Currently dark, will switch to light
        icon.className = `theme-icon ${ICONS.sun}`;
        if (text) {
          text.setAttribute('data-i18n', 'nav.themeLight');
          text.textContent = window.i18n?.t('nav.themeLight') ?? 'Light';
        }
      } else {
        // Currently light, will switch to dark
        icon.className = `theme-icon ${ICONS.moon}`;
        if (text) {
          text.setAttribute('data-i18n', 'nav.themeDark');
          text.textContent = window.i18n?.t('nav.themeDark') ?? 'Dark';
        }
      }
    }
  });
}

/**
 * Toggle theme
 */
export function toggleTheme(): void {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

// Initialize theme on load
if (typeof document !== 'undefined') {
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
  setTheme(savedTheme || 'dark');
}

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
}

/**
 * Show a toast notification
 * Supports both: showToast("message") and showToast("message", "type") for backwards compatibility
 */
export function showToast(config: ToastConfig | string, typeOverride?: ToastType): void {
  let message: string;
  let type: ToastType = 'info';
  let duration = 3000;

  if (typeof config === 'string') {
    message = config;
    if (typeOverride) {
      type = typeOverride;
    }
  } else {
    message = config.message;
    type = config.type || 'info';
    duration = config.duration || 3000;
  }

  // Find or create toast container
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Add icon based on type (matching legacy implementation)
  const iconMap: Record<ToastType, string> = {
    error: 'error',
    warning: 'warning',
    success: 'success',
    info: 'info',
  };

  toast.innerHTML = `
    <span class="toast-icon">${getIcon(iconMap[type])}</span>
    <span class="toast-message">${message}</span>
  `;

  // Add click to dismiss
  toast.addEventListener('click', () => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  // Trigger animation on next frame (for CSS transition to work)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });
  });

  // Auto dismiss
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

export const showSuccess = (msg: string): void => showToast({ message: msg, type: 'success' });
export const showError = (msg: string): void => showToast({ message: msg, type: 'error' });
export const showWarning = (msg: string): void => showToast({ message: msg, type: 'warning' });
export const showInfo = (msg: string): void => showToast({ message: msg, type: 'info' });

// =============================================================================
// NAVBAR
// =============================================================================

export function initNavbarToggle(): void {
  const hamburger = document.getElementById('navbar-hamburger');
  const menu = document.getElementById('navbar-menu');

  if (!hamburger || !menu) return;

  const closeMenu = (): void => {
    menu.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  };

  const toggleMenu = (): void => {
    const isOpen = !menu.classList.contains('open');
    if (isOpen) {
      menu.classList.add('open');
    } else {
      menu.classList.remove('open');
    }
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  hamburger.addEventListener('click', toggleMenu);
  hamburger.setAttribute('aria-expanded', 'false');

  menu.querySelectorAll('a.navbar-link').forEach((link) => {
    link.addEventListener('click', () => {
      // Close menu after navigation on mobile
      closeMenu();
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMenu();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavbarToggle);
} else {
  initNavbarToggle();
}

// =============================================================================
// EMPTY STATE HELPERS
// =============================================================================

/**
 * Create an empty state HTML element
 */
export function createEmptyState(iconName: string, message: string): string {
  const icon = getIcon(iconName);
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-text">${message}</div>
    </div>
  `;
}

/**
 * Create a loading state HTML element
 */
export function createLoadingState(message: string = 'Loading...'): string {
  return createEmptyState('spinner', message);
}

// =============================================================================
// SCROLL TO TOP BUTTON
// =============================================================================

/**
 * Initialize scroll-to-top button
 */
export function initScrollToTop(): void {
  // Create button
  const button = document.createElement('button');
  button.className = 'scroll-to-top';
  button.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
  button.setAttribute('aria-label', 'Scroll to top');
  button.setAttribute('title', 'Scroll to top');

  // Add click handler
  button.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  });

  // Add to body
  document.body.appendChild(button);

  // Show/hide based on scroll position
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  const handleScroll = () => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    scrollTimeout = setTimeout(() => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      if (scrollTop > 300) {
        button.classList.add('visible');
      } else {
        button.classList.remove('visible');
      }
      scrollTimeout = null;
    }, 100);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  // Initial check
  handleScroll();
}
