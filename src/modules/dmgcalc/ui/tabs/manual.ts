/**
 * Damage Calculator - Manual Input Tab
 * Override auto-calculated values with manual inputs
 *
 * @module dmgcalc/ui/tabs/manual
 */

// =============================================================================
// MANUAL TAB RENDERING
// =============================================================================

/**
 * Renders the Manual Input tab content (placeholder)
 *
 * Future implementation (Requirement #5):
 * - Separate sections for Stats, Buffs, Effects
 * - Manual inputs independent from auto-calculated values
 * - Delta display: Auto vs Manual with difference
 * - Visual indicators (green/red) for positive/negative deltas
 * - Toggle modes: "Auto Only", "Manual Only", "Auto + Manual"
 * - Save/load manual configurations to localStorage
 */
export function renderManualTab(): string {
  return `
    <div class="dmgcalc-manual-tab">
      <div class="dmgcalc-placeholder">
        <div class="placeholder-icon">
          <i class="fa-solid fa-sliders"></i>
        </div>
        <h3>Manual Override</h3>
        <p class="placeholder-subtitle">수동 스탯 입력 및 델타 비교</p>

        <div class="placeholder-content">
          <h4>✏️ Coming Soon</h4>
          <p>This tab will display:</p>
          <ul>
            <li>Manual stat input fields</li>
            <li>Auto vs Manual comparison display</li>
            <li>Delta calculation (+/- values & percentages)</li>
            <li>Visual indicators (green = positive, red = negative)</li>
            <li>Toggle modes: Auto Only / Auto + Manual / Manual Only</li>
            <li>Separate sections: Stats / Buffs / Effects</li>
            <li>Save/load manual configurations</li>
            <li>Reset button to clear all manual inputs</li>
          </ul>

          <div class="placeholder-mockup">
            <div class="mockup-manual-input">
              <div class="mockup-stat-name">ATK</div>
              <div class="mockup-comparison">
                <span class="auto-value">Auto: 1000</span>
                <span class="separator">|</span>
                <span class="manual-value">Manual: <input type="number" value="1200" /></span>
                <span class="separator">|</span>
                <span class="delta positive">Δ: +200 (+20.0%)</span>
              </div>
            </div>
            <div class="mockup-manual-input">
              <div class="mockup-stat-name">Crit Rate</div>
              <div class="mockup-comparison">
                <span class="auto-value">Auto: 50.0%</span>
                <span class="separator">|</span>
                <span class="manual-value">Manual: <input type="number" value="45" /></span>
                <span class="separator">|</span>
                <span class="delta negative">Δ: -5.0% (-10.0%)</span>
              </div>
            </div>
          </div>

          <div class="placeholder-tech-note">
            <strong>Implementation Note:</strong>
            <p>Extend AggregatedStat interface with: autoValue, manualValue, useManual, delta, deltaPercent</p>
            <p>Manual configs saved to localStorage with key: 'dmgcalc_manual'</p>
          </div>
        </div>

        <div class="placeholder-status">
          <span class="status-badge status-pending">⏳ Planned for Step 7</span>
        </div>
      </div>
    </div>
  `;
}
