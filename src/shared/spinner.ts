/**
 * Simple, minimalistic loading spinner utility
 * Provides a clean loading indicator for data fetching operations
 */

/**
 * Show a simple loading spinner in the specified container
 * @param container - The container element to show spinner in
 * @param message - Optional loading message
 * @returns Function to hide the spinner
 */
export function showSpinner(container: HTMLElement, message = 'Loading...'): () => void {
  const spinner = document.createElement('div');
  spinner.className = 'spinner-container';
  spinner.innerHTML = `
    <div class="spinner">
      <div class="spinner-circle"></div>
    </div>
    <div class="spinner-text">${message}</div>
  `;

  container.innerHTML = '';
  container.appendChild(spinner);

  // Return function to hide spinner
  return () => {
    if (spinner.parentNode === container) {
      spinner.remove();
    }
  };
}

/**
 * Show a full-page overlay spinner
 * @param message - Optional loading message
 * @returns Function to hide the spinner
 */
export function showOverlaySpinner(message = 'Loading...'): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'spinner-overlay';
  overlay.innerHTML = `
    <div class="spinner-container">
      <div class="spinner">
        <div class="spinner-circle"></div>
      </div>
      <div class="spinner-text">${message}</div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Return function to hide spinner
  return () => {
    if (overlay.parentNode) {
      overlay.remove();
    }
  };
}

/**
 * Create spinner HTML string (for template literals)
 * @param message - Optional loading message
 */
export function createSpinnerHTML(message = 'Loading...'): string {
  return `
    <div class="spinner-container">
      <div class="spinner">
        <div class="spinner-circle"></div>
      </div>
      <div class="spinner-text">${message}</div>
    </div>
  `;
}

/**
 * Wrap an async operation with spinner
 * @param container - Container to show spinner in
 * @param operation - Async operation to execute
 * @param message - Optional loading message
 */
export async function withSpinner<T>(
  container: HTMLElement,
  operation: () => Promise<T>,
  message = 'Loading...'
): Promise<T> {
  const hideSpinner = showSpinner(container, message);
  try {
    return await operation();
  } finally {
    hideSpinner();
  }
}
