/**
 * Simple virtual scrolling component
 * Renders only visible items for better performance with large lists
 */

import { debounce } from './utils';

export interface VirtualScrollConfig<T> {
  container: HTMLElement;
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => string;
  overscan?: number; // Number of extra items to render above/below viewport
}

/**
 * VirtualScroller - Efficiently renders large lists by only rendering visible items
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
   * Update items and re-render
   */
  public updateItems(items: T[]): void {
    this.items = items;
    const totalHeight = items.length * this.itemHeight;
    this.content.style.height = `${totalHeight}px`;
    this.render();
  }

  /**
   * Scroll to specific index
   */
  public scrollToIndex(index: number): void {
    const offset = index * this.itemHeight;
    this.viewport.scrollTop = offset;
  }

  /**
   * Get current scroll position
   */
  public getScrollTop(): number {
    return this.viewport.scrollTop;
  }

  /**
   * Destroy and clean up
   */
  public destroy(): void {
    if (this.onScroll) {
      this.viewport.removeEventListener('scroll', this.onScroll);
    }
    this.content.remove();
  }
}

/**
 * Simple helper to enable virtual scrolling on a grid
 * For character/disc selection grids
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

  public updateItems(items: T[]): void {
    this.items = items;
    const rows = this.groupIntoRows(items, this.columns);
    this.scroller.updateItems(rows);
  }

  public destroy(): void {
    this.scroller.destroy();
    if (this.onResize) {
      window.removeEventListener('resize', this.onResize);
    }
  }
}
