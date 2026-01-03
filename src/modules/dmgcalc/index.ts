/**
 * Damage Calculator - Main Entry Point
 * Orchestrates all dmgcalc modules and exports public API
 */

// Core modules
import { init as initState, getState } from './core/state';
import { aggregateStatsFromBuild } from './core/stats';
import { calculateAllDamage, getDamageResults } from './core/calc';
import { setupEventDelegation } from './utils/events';

// UI modules
import { renderTabNavigation, renderTabContent } from './ui/tabs';

// Types
import type { DamageCalcState } from './types';

// =============================================================================
// INITIALIZATION
// =============================================================================

let initialized = false;

/**
 * Initialize the damage calculator module
 * Call this once when the app loads
 */
export function init(): void {
  if (initialized) return;

  // Initialize state
  initState();

  // Setup event delegation
  setupEventDelegation();

  initialized = true;
  console.log('[DmgCalc] Module initialized');
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Main render function - aggregates stats, calculates damage, and renders UI
 * Call this whenever the build changes or on page navigation
 */
export async function render(): Promise<void> {
  console.log('[DmgCalc] Starting damage calculation and render');

  const container = document.getElementById('dmgcalc-container');
  if (!container) {
    console.error('[DmgCalc] Container #dmgcalc-container not found');
    return;
  }

  // Check if master character is selected
  if (!window.state?.party?.master || typeof window.state.party.master === 'string') {
    container.innerHTML = `
      <div class="dmgcalc-empty-state">
        <div class="empty-state-icon">
          <i class="fa-solid fa-calculator"></i>
        </div>
        <h3>데미지 계산기</h3>
        <p>메인 캐릭터를 먼저 선택해주세요.</p>
        <p class="empty-state-hint">
          <i class="fa-solid fa-info-circle"></i>
          캐릭터를 선택하면 스킬 데미지와 스탯 정보를 확인할 수 있습니다.
        </p>
      </div>
    `;
    return;
  }

  // Step 1: Aggregate all stats from current build
  aggregateStatsFromBuild();

  // Step 2: Calculate damage for all skills
  calculateAllDamage();

  // Step 3: Render UI to DOM (tab navigation + active tab content)
  const html = `
    ${renderTabNavigation()}
    ${renderTabContent()}
  `;
  container.innerHTML = html;

  console.log('[DmgCalc] Render complete', {
    results: getDamageResults()
  });
}

/**
 * Get current calculation state
 */
export function getCurrentState(): DamageCalcState {
  return getState();
}

/**
 * Recalculate damage without re-aggregating stats
 * Useful when only enemy config changes
 */
export function recalculate(): void {
  calculateAllDamage();
}

// =============================================================================
// WINDOW EXPORTS (Temporary - for compatibility with app-dmgcalc.ts)
// =============================================================================

if (typeof window !== 'undefined') {
  // Export main functions to window for now
  // These will be removed once full migration is complete
  (window as any).dmgcalc = {
    init,
    render,
    getCurrentState,
    recalculate
  };

  // COMPATIBILITY: Export as window.renderDamageCalculator for tab switching
  // This matches the old app-dmgcalc.ts interface
  (window as any).renderDamageCalculator = render;
}

// =============================================================================
// RE-EXPORTS (for convenient importing)
// =============================================================================

export { aggregateStatsFromBuild } from './core/stats';
export { calculateAllDamage, getDamageResults } from './core/calc';
export { getState, updateState } from './core/state';
export * from './types';
export * from './constants';
