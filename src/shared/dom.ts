/**
 * @module shared/dom
 * @description DOM manipulation utilities, image optimization with WebP support, and text processing.
 *
 * Key Features:
 * - Type-safe DOM element selection helpers
 * - WebP image generation with fallback support
 * - Lazy loading configuration for images
 * - Image error handling utilities
 * - Element tag parsing for styled game text (##tag#iconId# format)
 * - Color tag stripping and newline processing
 *
 * @see {@link createResponsiveImage} - Generate WebP images with fallback
 * @see {@link parseElementTags} - Parse game description tags with icons
 * @see {@link processDescriptionText} - Full text processing pipeline
 * @see {@link createOptimizedImage} - Generate lazy-loaded images
 *
 * @example
 * ```typescript
 * // Type-safe element selection
 * const input = getElement<HTMLInputElement>('search-input');
 *
 * // WebP with fallback
 * const imgHtml = createResponsiveImage('assets/char/hero.png', 'Hero Portrait');
 * // <picture><source srcset="assets/char/hero.webp" type="image/webp">
 * //   <img src="assets/char/hero.png" alt="Hero Portrait" loading="lazy"></picture>
 *
 * // Parse game tags
 * const desc = parseElementTags('##빛 속성 표식#1015#');
 * // <span class="element-tag" style="color: #FFD700">빛 속성 표식<img...></span>
 * ```
 */

// =============================================================================
// DOM UTILITIES
// =============================================================================

/**
 * Safely get element by ID with type assertion.
 *
 * @template T - HTMLElement subtype
 * @param {string} id - Element ID
 * @returns {T | null} Element or null if not found
 *
 * @example
 * ```typescript
 * const input = getElement<HTMLInputElement>('search-input');
 * if (input) {
 *   input.value = 'query'; // TypeScript knows it's an input
 * }
 * ```
 */
export function getElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Safely query selector with type assertion.
 *
 * @template T - HTMLElement subtype
 * @param {string} selector - CSS selector
 * @param {ParentNode} [parent=document] - Parent element to search within
 * @returns {T | null} First matching element or null
 *
 * @example
 * ```typescript
 * const container = querySelector<HTMLDivElement>('.container');
 * const button = querySelector<HTMLButtonElement>('.btn', container);
 * ```
 */
export function querySelector<T extends HTMLElement>(
  selector: string,
  parent: ParentNode = document
): T | null {
  return parent.querySelector(selector) as T | null;
}

/**
 * Safely query all elements with type assertion.
 *
 * @template T - HTMLElement subtype
 * @param {string} selector - CSS selector
 * @param {ParentNode} [parent=document] - Parent element to search within
 * @returns {NodeListOf<T>} List of matching elements
 *
 * @example
 * ```typescript
 * const buttons = querySelectorAll<HTMLButtonElement>('.filter-btn');
 * buttons.forEach(btn => btn.disabled = false);
 * ```
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
 * Handle image loading errors by hiding the element.
 *
 * @param {HTMLImageElement} img - Image element that failed to load
 *
 * @example
 * ```typescript
 * const img = document.createElement('img');
 * img.onerror = () => handleImageError(img);
 * ```
 */
export function handleImageError(img: HTMLImageElement): void {
  img.style.display = 'none';
}

/**
 * Inline onerror handler string for use in HTML templates.
 * Hides images that fail to load.
 *
 * @constant {string}
 * @example
 * ```typescript
 * const html = `<img src="${path}" onerror="${IMAGE_ERROR_HANDLER}">`;
 * ```
 */
export const IMAGE_ERROR_HANDLER = "this.style.display='none'";

/**
 * Generate optimized image HTML with lazy loading.
 *
 * @param {string} src - Image source path
 * @param {string} alt - Alt text for accessibility
 * @param {string} [className=''] - Optional CSS class
 * @param {boolean} [eager=false] - Set true to disable lazy loading (for above-the-fold)
 * @returns {string} HTML string for image element
 *
 * @example
 * ```typescript
 * // Lazy-loaded image (default)
 * const lazyImg = createOptimizedImage('assets/icon.png', 'Icon');
 *
 * // Above-the-fold image (eager loading)
 * const heroImg = createOptimizedImage('assets/hero.png', 'Hero', 'hero-img', true);
 * ```
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
 * Generate responsive image HTML with WebP format and fallback.
 *
 * Automatically creates a <picture> element with WebP source and original fallback.
 * Browsers that support WebP will use the optimized format; others fall back to the original.
 *
 * @param {string} basePath - Original image path (e.g., 'assets/hero.png')
 * @param {string} alt - Alt text for accessibility
 * @param {string} [className=''] - Optional CSS class
 * @param {boolean} [eager=false] - Set true to disable lazy loading
 * @returns {string} HTML string for picture element with WebP and fallback
 *
 * @example
 * ```typescript
 * const img = createResponsiveImage('assets/char/hero.png', 'Hero Portrait');
 * // Generates:
 * // <picture>
 * //   <source srcset="assets/char/hero.webp" type="image/webp">
 * //   <img src="assets/char/hero.png" alt="Hero Portrait" loading="lazy">
 * // </picture>
 * ```
 */
export function createResponsiveImage(
  basePath: string,
  alt: string,
  className = '',
  eager = false,
  width?: number,
  height?: number
): string {
  const loading = eager ? 'eager' : 'lazy';
  const classes = className ? ` class="${className}"` : '';
  const widthAttr = width ? ` width="${width}"` : '';
  const heightAttr = height ? ` height="${height}"` : '';

  // Extract path and extension
  const lastDot = basePath.lastIndexOf('.');
  const pathWithoutExt = basePath.substring(0, lastDot);
  // const ext = basePath.substring(lastDot); // Unused but good for reference

  // Generate WebP path
  const webpPath = `${pathWithoutExt}.webp`;

  return `
    <picture>
      <source srcset="${webpPath}" type="image/webp">
      <img src="${basePath}" alt="${alt}"${classes} loading="${loading}"${widthAttr}${heightAttr} onerror="${IMAGE_ERROR_HANDLER}">
    </picture>
  `.trim();
}

/**
 * Preload critical images for faster initial rendering.
 *
 * Use for above-the-fold images that should load immediately.
 *
 * @param {string} src - Image source URL to preload
 *
 * @example
 * ```typescript
 * // Preload hero image on page load
 * preloadImage('assets/hero-banner.webp');
 * ```
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
 * Add lazy loading attribute to all images in a container.
 *
 * Useful for dynamically loaded content where images don't have loading attribute.
 *
 * @param {HTMLElement} container - Container element with images
 *
 * @example
 * ```typescript
 * const modal = document.querySelector('#modal');
 * // After loading content dynamically
 * enableLazyLoadingInContainer(modal);
 * ```
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
 * Parse element tags in game descriptions and convert to styled HTML.
 *
 * Parses tags in format: ##text content#iconId#
 * Converts to styled spans with element-specific colors and icons.
 *
 * Supported icon IDs:
 * - 1015, 2016: Light (gold)
 * - 1016, 2013: Fire (red)
 * - 1017, 2017: Wind (green)
 * - 1018, 2008: Water (blue)
 * - 1019, 2018: Dark (purple)
 * - 1020, 2029: Earth (brown)
 *
 * @param {string} description - Raw description text with element tags
 * @returns {string} HTML string with styled element spans
 *
 * @example
 * ```typescript
 * const raw = '스킬은 ##빛 속성 표식#1015#을 부여합니다.';
 * const parsed = parseElementTags(raw);
 * // <span class="element-tag" style="color: #FFD700; font-weight: 600;">
 * //   빛 속성 표식
 * //   <img src="assets/common/Icon_ElementTagTrigger_Light.png" alt="Light" class="element-tag-icon">
 * // </span>
 * ```
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
      const iconPath = `assets/common/${elementInfo.icon}.png`;
      return `<span class="element-tag" style="color: ${elementInfo.color}; font-weight: 600;">${textContent}<img src="${iconPath}" alt="${elementInfo.name}" class="element-tag-icon" style="width: 20px; height: 20px; vertical-align: middle; margin-left: 4px;" onerror="this.style.display='none'"></span>`;
    } else {
      return `<span class="element-tag">${textContent}</span>`;
    }
  });
}

/**
 * Process game description text with full formatting pipeline.
 *
 * Performs the following transformations:
 * 1. Converts vertical tabs (\u000b) to <br> tags for newlines
 * 2. Strips Unity-style color tags (<color=#hex> and </color>)
 * 3. Parses element tags (##text#iconId#) into styled HTML
 *
 * @param {string} description - Raw description text from game data
 * @returns {string} Fully processed HTML string
 *
 * @example
 * ```typescript
 * const raw = '<color=#0abec5>스킬\u000b##빛 속성 표식#1015#</color>';
 * const processed = processDescriptionText(raw);
 * // '스킬<br><span class="element-tag" style="color: #FFD700">빛 속성 표식<img...></span>'
 * ```
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
