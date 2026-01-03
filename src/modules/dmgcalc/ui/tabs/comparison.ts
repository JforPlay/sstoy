/**
 * Damage Calculator - Build Comparison Tab
 * Compare multiple build snapshots side-by-side
 *
 * @module dmgcalc/ui/tabs/comparison
 */

// =============================================================================
// COMPARISON TAB RENDERING
// =============================================================================

/**
 * Renders the Build Comparison tab content (placeholder)
 *
 * Future implementation (Requirement #3):
 * - Store 2-3 build snapshots
 * - Side-by-side comparison view
 * - Diff highlighting for stat differences
 * - Visual indicators (arrows, colors) for better/worse
 * - Export comparison data to CSV
 * - URL sharing support via compression
 */
export function renderComparisonTab(): string {
  return `
    <div class="dmgcalc-comparison-tab">
      <div class="dmgcalc-placeholder">
        <div class="placeholder-icon">
          <i class="fa-solid fa-code-compare"></i>
        </div>
        <h3>Build Comparison</h3>
        <p class="placeholder-subtitle">빌드 간 성능 비교</p>

        <div class="placeholder-content">
          <h4>🔄 Coming Soon</h4>
          <p>This tab will display:</p>
          <ul>
            <li>Snapshot management (save/load builds)</li>
            <li>Side-by-side comparison (2-3 builds)</li>
            <li>Stat difference highlighting</li>
            <li>Damage output comparison per skill</li>
            <li>Visual indicators (↑↓ arrows, colors)</li>
            <li>Export comparison as CSV</li>
            <li>Share comparison via URL</li>
          </ul>

          <div class="placeholder-mockup">
            <div class="mockup-row">
              <div class="mockup-label">Stat</div>
              <div class="mockup-build">Build 1</div>
              <div class="mockup-build">Build 2</div>
              <div class="mockup-diff">Diff</div>
            </div>
            <div class="mockup-row">
              <div class="mockup-label">ATK</div>
              <div class="mockup-build">1000</div>
              <div class="mockup-build highlight-better">1200</div>
              <div class="mockup-diff positive">+200 ↑</div>
            </div>
            <div class="mockup-row">
              <div class="mockup-label">Crit Rate</div>
              <div class="mockup-build">50%</div>
              <div class="mockup-build highlight-worse">45%</div>
              <div class="mockup-diff negative">-5% ↓</div>
            </div>
          </div>

          <div class="placeholder-tech-note">
            <strong>Implementation Note:</strong>
            <p>Will use deep copy of AppState and DiscState for snapshots</p>
            <p>Compression via fflate + Base91 (similar to saveload.ts)</p>
          </div>
        </div>

        <div class="placeholder-status">
          <span class="status-badge status-pending">⏳ Planned for Step 6</span>
        </div>
      </div>
    </div>
  `;
}
