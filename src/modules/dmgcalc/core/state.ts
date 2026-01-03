/**
 * State Management for Damage Calculator
 * Handles initialization, getters, setters, and persistence
 */

import type { DamageCalcState, EnemyConfig } from '../types';
import { DEFAULT_ENEMY_CONFIG } from '../constants';

// =============================================================================
// STATE INSTANCE
// =============================================================================

let state: DamageCalcState;

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize damage calculator state
 */
export function init(): void {
  state = {
    stats: new Map(),
    buffs: [],
    enemy: { ...DEFAULT_ENEMY_CONFIG },
    results: {},
    manualMode: false
  };

  // Try to load saved state from localStorage
  loadStateFromStorage();
}

/**
 * Reset state to default values
 */
export function resetState(): void {
  init();
}

// =============================================================================
// STATE ACCESSORS
// =============================================================================

/**
 * Get current state (read-only reference)
 */
export function getState(): DamageCalcState {
  if (!state) {
    init();
  }
  return state;
}

/**
 * Update state with partial updates
 */
export function updateState(updates: Partial<DamageCalcState>): void {
  if (!state) {
    init();
  }

  Object.assign(state, updates);

  // Auto-save to localStorage
  saveStateToStorage();
}

/**
 * Update enemy configuration
 */
export function updateEnemyConfig(config: Partial<EnemyConfig>): void {
  if (!state) {
    init();
  }

  Object.assign(state.enemy, config);
  saveStateToStorage();
}

/**
 * Toggle manual mode
 */
export function toggleManualMode(enabled: boolean): void {
  if (!state) {
    init();
  }

  state.manualMode = enabled;
  saveStateToStorage();
}

// =============================================================================
// PERSISTENCE
// =============================================================================

/**
 * Save state to localStorage
 */
function saveStateToStorage(): void {
  if (!state) return;

  try {
    const serialized = JSON.stringify({
      enemy: state.enemy,
      manualMode: state.manualMode
      // Note: Don't save stats or results - they're recalculated from build
    });

    localStorage.setItem('dmgcalc_state', serialized);
  } catch (e) {
    console.warn('[DmgCalc] Failed to save state to localStorage', e);
  }
}

/**
 * Load state from localStorage
 */
function loadStateFromStorage(): void {
  if (!state) return;

  try {
    const saved = localStorage.getItem('dmgcalc_state');
    if (!saved) return;

    const parsed = JSON.parse(saved);

    // Merge saved state with default state
    if (parsed.enemy) {
      Object.assign(state.enemy, parsed.enemy);
    }

    if (typeof parsed.manualMode === 'boolean') {
      state.manualMode = parsed.manualMode;
    }
  } catch (e) {
    console.warn('[DmgCalc] Failed to load state from localStorage', e);
  }
}

/**
 * Clear saved state from localStorage
 */
export function clearSavedState(): void {
  try {
    localStorage.removeItem('dmgcalc_state');
  } catch (e) {
    console.warn('[DmgCalc] Failed to clear saved state', e);
  }
}
