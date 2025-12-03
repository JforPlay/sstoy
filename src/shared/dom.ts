/**
 * DOM Utilities Module
 * DOM helpers, Image optimization, and Text processing
 */

// =============================================================================
// DOM UTILITIES
// =============================================================================

/**
 * Safely get element by ID with type assertion
 */
export function getElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Safely query selector with type assertion
 */
export function querySelector<T extends HTMLElement>(
  selector: string,
  parent: ParentNode = document
): T | null {
  return parent.querySelector(selector) as T | null;
}

/**
 * Safely query all with type assertion
 */
export function querySelectorAll<T extends HTMLElement>(
  selector: string,
  parent: ParentNode = document
): NodeListOf<T> {
  return parent.querySelectorAll(selector) as NodeListOf<T>;
}

// =============================================================================
// IMAGE OPTIMIZATION & ERROR HANDLING
// =============================================================================

/**
 * Handle image error by hiding the element
 */
export function handleImageError(img: HTMLImageElement): void {
  img.style.display = 'none';
}

/**
 * Create onerror handler string for inline use in templates
 */
export const IMAGE_ERROR_HANDLER = "this.style.display='none'";

/**
 * Generate optimized image HTML with lazy loading
 * @param src - Image source path
 * @param alt - Alt text for accessibility
 * @param className - Optional CSS class
 * @param eager - Set to true to disable lazy loading (for above-the-fold images)
 */
export function createOptimizedImage(
  src: string,
  alt: string,
  className = '',
  eager = false
): string {
  const loading = eager ? 'eager' : 'lazy';
  const classes = className ? ` class="${className}"` : '';

  return `<img src="${src}" alt="${alt}"${classes} loading="${loading}" onerror="${IMAGE_ERROR_HANDLER}">`;
}

/**
 * Generate responsive image HTML with multiple sources
 * Automatically tries WebP format with fallback
 */
export function createResponsiveImage(
  basePath: string,
  alt: string,
  className = '',
  eager = false
): string {
  const loading = eager ? 'eager' : 'lazy';
  const classes = className ? ` class="${className}"` : '';

  // Extract path and extension
  const lastDot = basePath.lastIndexOf('.');
  const pathWithoutExt = basePath.substring(0, lastDot);
  // const ext = basePath.substring(lastDot); // Unused but good for reference

  // Generate WebP path
  const webpPath = `${pathWithoutExt}.webp`;

  return `
    <picture>
      <source srcset="${webpPath}" type="image/webp">
      <img src="${basePath}" alt="${alt}"${classes} loading="${loading}" onerror="${IMAGE_ERROR_HANDLER}">
    </picture>
  `.trim();
}

/**
 * Preload critical images for faster initial rendering
 * Call this for above-the-fold images
 */
export function preloadImage(src: string): void {
  if (typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  document.head.appendChild(link);
}

/**
 * Add lazy loading to all images in a container
 * Useful for dynamically loaded content
 */
export function enableLazyLoadingInContainer(container: HTMLElement): void {
  const images = container.querySelectorAll('img:not([loading])');
  images.forEach((img) => {
    (img as HTMLImageElement).loading = 'lazy';
  });
}

// =============================================================================
// ELEMENT TAG PARSING
// =============================================================================

/**
 * Parse element tags in descriptions and convert to styled HTML
 * Robust parsing using ## and #number# markers only, independent of text content
 */
export function parseElementTags(description: string): string {
  if (!description) return description;

  // Map iconId to element info (color and icon)
  const iconIdToElement: Record<string, { color: string; icon: string; name: string }> = {
    // Basic element tag icons (10xx series)
    '1015': { color: '#FFD700', icon: 'Icon_ElementTagTrigger_Light', name: 'Light' },
    '1016': { color: '#FF4444', icon: 'Icon_ElementTagTrigger_Fire', name: 'Fire' },
    '1017': { color: '#44FF44', icon: 'Icon_ElementTagTrigger_Wind', name: 'Wind' },
    '1018': { color: '#4444FF', icon: 'Icon_ElementTagTrigger_Water', name: 'Water' },
    '1019': { color: '#9944FF', icon: 'Icon_ElementTagTrigger_Dark', name: 'Dark' },
    '1020': { color: '#8B4513', icon: 'Icon_ElementTagTrigger_Earth', name: 'Earth' },
    // Extended element tag icons (20xx series)
    '2016': { color: '#FFD700', icon: 'Icon_ElementTagTrigger_Light', name: 'Light' },
    '2013': { color: '#FF4444', icon: 'Icon_ElementTagTrigger_Fire', name: 'Fire' },
    '2017': { color: '#44FF44', icon: 'Icon_ElementTagTrigger_Wind', name: 'Wind' },
    '2008': { color: '#4444FF', icon: 'Icon_ElementTagTrigger_Water', name: 'Water' },
    '2018': { color: '#9944FF', icon: 'Icon_ElementTagTrigger_Dark', name: 'Dark' },
    '2029': { color: '#8B4513', icon: 'Icon_ElementTagTrigger_Earth', name: 'Earth' }
  };

  // Robust pattern: ##AnyText#Number#
  const pattern = /##([^#]+)#(\d+)#/g;

  return description.replace(pattern, (match, textContent, iconId) => {
    const elementInfo = iconIdToElement[iconId];

    if (elementInfo) {
      const iconPath = `assets/${elementInfo.icon}.png`;
      return `<span class="element-tag" style="color: ${elementInfo.color}; font-weight: 600;">${textContent}<img src="${iconPath}" alt="${elementInfo.name}" class="element-tag-icon" style="width: 20px; height: 20px; vertical-align: middle; margin-left: 4px;" onerror="this.style.display='none'"></span>`;
    } else {
      return `<span class="element-tag">${textContent}</span>`;
    }
  });
}

/**
 * Process description text - handles newlines, color tags, and element tags
 */
export function processDescriptionText(description: string): string {
  if (!description) return '';

  let result = description;

  // Replace vertical tab (\u000b) with <br> for newlines
  if (result.includes('\u000b')) {
    result = result.replace(/\u000b/g, '<br>');
  }

  // Strip color tags like <color=#0abec5> and </color>
  result = result.replace(/<color=[^>]+>/g, '').replace(/<\/color>/g, '');

  // Parse element tags
  result = parseElementTags(result);

  return result;
}
