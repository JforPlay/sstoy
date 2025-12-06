/**
 * @module shared/virtual-scroll
 * @description Virtual scrolling components for efficiently rendering large lists and grids.
 *
 * Key Features:
 * - VirtualScroller class for 1D lists (renders only visible items)
 * - VirtualGrid class for 2D grids (responsive column layout)
 * - Configurable overscan buffer for smooth scrolling
 * - Automatic height calculation and viewport management
 * - Debounced scroll handling for performance
 * - Dynamic item updates without full re-render
 *
 * @see {@link VirtualScroller} - Efficiently render large lists (1000+ items)
 * @see {@link VirtualGrid} - Efficiently render large grids
 *
 * @example
 * ```typescript
 * // List with 10,000 items - only renders ~20 visible items
 * const scroller = new VirtualScroller({
 *   container: document.getElementById('list'),
 *   items: characters, // Array of 10,000 characters
 *   itemHeight: 100,
 *   renderItem: (char, index) => `
 *     <div class="char-item">${char.name}</div>
 *   `,
 *   overscan: 3 // Render 3 extra items above/below viewport
 * });
 *
 * // Update items
 * scroller.updateItems(filteredCharacters);
 *
 * // Scroll to specific item
 * scroller.scrollToIndex(50);
 *
 * // Cleanup
 * scroller.destroy();
 * ```
 */

import { debounce } from './utils';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface VirtualScrollConfig<T> {
  container: HTMLElement;
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => string;
  overscan?: number; // Number of extra items to render above/below viewport
}

// =============================================================================
// VIRTUAL SCROLLER (1D LIST)
// =============================================================================

/**
 * VirtualScroller - Efficiently renders large lists by only rendering visible items.
 *
 * Handles 1000+ items smoothly by rendering only the visible portion plus overscan buffer.
 * Typical viewport shows ~20 items instead of thousands, dramatically improving performance.
 *
 * @template T - Item type
 *
 * @example
 * ```typescript
 * const scroller = new VirtualScroller({
 *   container: document.getElementById('list'),
 *   items: largeArray,
 *   itemHeight: 80,
 *   renderItem: (item, i) => `<div class="item">${item.name}</div>`,
 *   overscan: 5
 * });
 * ```
 */
export class VirtualScroller<T> {
  private container: HTMLElement;
  private items: T[];
  private itemHeight: number;
  private renderItem: (item: T, index: number) => string;
  private overscan: number;
  private viewport: HTMLElement;
  private content: HTMLElement;
  private visibleRange: { start: number; end: number } = { start: 0, end: 0 };
  private onScroll: (() => void) | null = null;

  constructor(config: VirtualScrollConfig<T>) {
    this.container = config.container;
    this.items = config.items;
    this.itemHeight = config.itemHeight;
    this.renderItem = config.renderItem;
    this.overscan = config.overscan ?? 3;

    this.viewport = this.container;
    this.content = document.createElement('div');
    this.content.className = 'virtual-scroll-content';

    this.init();
  }

  private init(): void {
    // Clear container
    this.container.innerHTML = '';
    this.container.classList.add('virtual-scroll-container');

    // Set up viewport
    this.viewport.style.position = 'relative';
    this.viewport.style.overflow = 'auto';

    // Set up content
    const totalHeight = this.items.length * this.itemHeight;
    this.content.style.height = `${totalHeight}px`;
    this.content.style.position = 'relative';

    this.viewport.appendChild(this.content);

    // Set up scroll listener
    this.onScroll = debounce(() => this.render(), 16);
    this.viewport.addEventListener('scroll', this.onScroll, { passive: true });

    // Initial render
    this.render();
  }

  private render(): void {
    const scrollTop = this.viewport.scrollTop;
    const viewportHeight = this.viewport.clientHeight;

    // Calculate visible range with overscan
    const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan);
    const end = Math.min(
      this.items.length,
      Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.overscan
    );

    // Only re-render if range changed
    if (start === this.visibleRange.start && end === this.visibleRange.end) {
      return;
    }

    this.visibleRange = { start, end };

    // Render visible items
    const visibleItems = this.items.slice(start, end);
    const offset = start * this.itemHeight;

    this.content.innerHTML = `
      <div style="transform: translateY(${offset}px); position: absolute; width: 100%;">
        ${visibleItems.map((item, i) => this.renderItem(item, start + i)).join('')}
      </div>
    `;
  }

  /**
   * Update items and re-render.
   *
   * @param {T[]} items - New items array
   *
   * @example
   * ```typescript
   * // Update after filtering
   * scroller.updateItems(filteredCharacters);
   * ```
   */
  public updateItems(items: T[]): void {
    this.items = items;
    const totalHeight = items.length * this.itemHeight;
    this.content.style.height = `${totalHeight}px`;
    this.render();
  }

  /**
   * Scroll to specific item index.
   *
   * @param {number} index - Item index to scroll to
   *
   * @example
   * ```typescript
   * // Scroll to 100th item
   * scroller.scrollToIndex(100);
   * ```
   */
  public scrollToIndex(index: number): void {
    const offset = index * this.itemHeight;
    this.viewport.scrollTop = offset;
  }

  /**
   * Get current scroll position in pixels.
   *
   * @returns {number} Scroll position
   */
  public getScrollTop(): number {
    return this.viewport.scrollTop;
  }

  /**
   * Destroy scroller and clean up event listeners.
   *
   * @example
   * ```typescript
   * // Cleanup when component unmounts
   * scroller.destroy();
   * ```
   */
  public destroy(): void {
    if (this.onScroll) {
      this.viewport.removeEventListener('scroll', this.onScroll);
    }
    this.content.remove();
  }
}

// =============================================================================
// VIRTUAL GRID (2D GRID)
// =============================================================================

/**
 * VirtualGrid - Efficiently renders large grids with responsive column layout.
 *
 * Automatically calculates columns based on container width and handles resize.
 * Uses VirtualScroller internally to render rows of items.
 *
 * @template T - Item type
 *
 * @example
 * ```typescript
 * const grid = new VirtualGrid({
 *   container: document.getElementById('grid'),
 *   items: characters,
 *   itemWidth: 150,
 *   itemHeight: 200,
 *   renderItem: (char, i) => `<div class="char-card">${char.name}</div>`
 * });
 *
 * // Automatically handles window resize
 * // Cleanup
 * grid.destroy();
 * ```
 */
export class VirtualGrid<T> {
  private container: HTMLElement;
  private items: T[];
  private itemWidth: number;
  private itemHeight: number;
  private columns: number;
  private renderItem: (item: T, index: number) => string;
  private scroller: VirtualScroller<T[]>;
  private onResize: (() => void) | null = null;

  constructor(config: {
    container: HTMLElement;
    items: T[];
    itemWidth: number;
    itemHeight: number;
    renderItem: (item: T, index: number) => string;
  }) {
    this.container = config.container;
    this.items = config.items;
    this.itemWidth = config.itemWidth;
    this.itemHeight = config.itemHeight;
    this.renderItem = config.renderItem;

    // Calculate columns based on container width
    this.columns = Math.floor(this.container.clientWidth / this.itemWidth) || 1;

    // Group items into rows
    const rows = this.groupIntoRows(this.items, this.columns);

    // Create virtual scroller for rows
    this.scroller = new VirtualScroller({
      container: this.container,
      items: rows,
      itemHeight: this.itemHeight,
      renderItem: (row, rowIndex) => this.renderRow(row, rowIndex),
      overscan: 2,
    });

    // Re-calculate columns on resize
    this.onResize = debounce(() => this.handleResize(), 150);
    window.addEventListener('resize', this.onResize);
  }

  private groupIntoRows(items: T[], columns: number): T[][] {
    const rows: T[][] = [];
    for (let i = 0; i < items.length; i += columns) {
      rows.push(items.slice(i, i + columns));
    }
    return rows;
  }

  private renderRow(row: T[], rowIndex: number): string {
    const startIndex = rowIndex * this.columns;
    return `
      <div class="virtual-grid-row" style="display: flex; gap: 10px; padding: 5px;">
        ${row.map((item, i) => this.renderItem(item, startIndex + i)).join('')}
      </div>
    `;
  }

  private handleResize(): void {
    const newColumns = Math.floor(this.container.clientWidth / this.itemWidth) || 1;
    if (newColumns !== this.columns) {
      this.columns = newColumns;
      const rows = this.groupIntoRows(this.items, this.columns);
      this.scroller.updateItems(rows);
    }
  }

  /**
   * Update grid items and re-render.
   *
   * @param {T[]} items - New items array
   *
   * @example
   * ```typescript
   * grid.updateItems(filteredCharacters);
   * ```
   */
  public updateItems(items: T[]): void {
    this.items = items;
    const rows = this.groupIntoRows(items, this.columns);
    this.scroller.updateItems(rows);
  }

  /**
   * Destroy grid and clean up event listeners.
   *
   * @example
   * ```typescript
   * grid.destroy();
   * ```
   */
  public destroy(): void {
    this.scroller.destroy();
    if (this.onResize) {
      window.removeEventListener('resize', this.onResize);
    }
  }
}
