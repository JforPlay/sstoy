/**
 * Event Delegation for Damage Calculator
 * Handles all user interactions using event delegation pattern
 */

import { aggregateStatsFromBuild } from '../core/stats';
import { calculateAllDamage } from '../core/calc';
import { getState, updateState } from '../core/state';
import { switchTab } from '../ui/tabs';
import { analyzeLimitBreakProgression } from '../core/limitbreak';
import { initializeLimitBreakChart } from '../ui/tabs/limitbreak';
import type { SkillType } from '../types';

// =============================================================================
// EVENT SETUP
// =============================================================================

/**
 * Sets up event delegation for all damage calculator interactions
 * Uses event delegation pattern to avoid global namespace pollution
 */
export function setupEventDelegation(): void {
  // Click events
  document.addEventListener('click', handleClick);

  // Change events for checkboxes
  document.addEventListener('change', handleChange);

  // Input events for number inputs
  document.addEventListener('input', handleInput);
}

// =============================================================================
// CLICK HANDLERS
// =============================================================================

function handleClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;

  // Tab switching
  const tabBtn = target.closest('[data-action="switch-tab"]') as HTMLElement;
  if (tabBtn) {
    const tabId = tabBtn.dataset.tabId;
    if (tabId) {
      switchTab(tabId);
      // Re-render to show the new tab
      if (typeof window.renderDamageCalculator === 'function') {
        window.renderDamageCalculator();
      }
    }
    return;
  }

  // Recalculate button
  if (target.closest('[data-action="recalculate"]')) {
    aggregateStatsFromBuild();
    calculateAllDamage();
    // Re-render will be called by parent
    return;
  }

  // Export CSV button
  if (target.closest('[data-action="export-csv"]')) {
    // CSV export will be handled by parent module
    return;
  }

  // Limitbreak: Select skill for analysis
  const selectLbSkill = target.closest('[data-action="select-lb-skill"]') as HTMLElement;
  if (selectLbSkill) {
    const skillType = selectLbSkill.dataset.skill as SkillType;
    if (skillType) {
      const state = getState();
      if (!state.limitbreak) {
        state.limitbreak = {
          skillType,
          selectedSkill: skillType,
          dataPoints: [],
          chartData: null
        };
      } else {
        state.limitbreak.selectedSkill = skillType;
        state.limitbreak.skillType = skillType;
      }

      // Re-render to update selected skill highlight
      if (typeof window.renderDamageCalculator === 'function') {
        window.renderDamageCalculator();
      }
    }
    return;
  }

  // Limitbreak: Run analysis
  const analyzeLbBtn = target.closest('[data-action="analyze-limitbreak"]') as HTMLElement;
  if (analyzeLbBtn) {
    handleLimitBreakAnalysis();
    return;
  }

  // Toggle manual mode button
  if (target.closest('[data-action="toggle-manual-mode"]')) {
    const state = getState();
    state.manualMode = !state.manualMode;
    return;
  }

  // Toggle stat category (collapse/expand category sections)
  const categoryToggle = target.closest('[data-action="toggle-category"]') as HTMLElement;
  if (categoryToggle) {
    const category = categoryToggle.dataset.category;
    if (!category) return;

    const categoryBody = document.querySelector(`[data-category-body="${category}"]`);
    const chevron = categoryToggle.querySelector('.category-chevron');

    if (categoryBody && chevron) {
      categoryBody.classList.toggle('collapsed');
      chevron.classList.toggle('rotated');
    }
    return;
  }

  // Toggle stat sources (show/hide individual stat details)
  const statSourceToggle = target.closest('[data-action="toggle-stat-sources"]') as HTMLElement;
  if (statSourceToggle) {
    const statKey = statSourceToggle.dataset.stat;
    if (!statKey) return;

    const sourcesDiv = document.querySelector(`[data-stat-sources="${statKey}"]`) as HTMLElement;
    const chevron = statSourceToggle.querySelector('.stat-chevron');

    if (sourcesDiv && chevron) {
      const isVisible = sourcesDiv.style.display !== 'none';
      sourcesDiv.style.display = isVisible ? 'none' : 'block';
      chevron.classList.toggle('rotated');
    }
    return;
  }

  // Toggle stat details (legacy handler, keeping for compatibility)
  const statToggle = target.closest('[data-action="toggle-stat-details"]') as HTMLElement;
  if (statToggle) {
    const statKey = statToggle.dataset.statKey;
    if (!statKey) return;

    const statItem = document.querySelector(`[data-stat="${statKey}"]`);
    if (!statItem) return;

    const details = statItem.querySelector('.stat-details');
    const icon = statItem.querySelector('.stat-expand-icon');

    if (details && icon) {
      details.classList.toggle('hidden');
      icon.classList.toggle('rotated');
    }
    return;
  }

  // Toggle breakdown sections (damage calculation details)
  const breakdownToggle = target.closest('.breakdown-toggle') as HTMLElement;
  if (breakdownToggle) {
    const breakdownId = breakdownToggle.dataset.breakdownId;
    if (!breakdownId) return;

    const breakdownContent = document.getElementById(breakdownId);
    const toggleIcon = breakdownToggle.querySelector('.breakdown-toggle-icon');
    const toggleHint = breakdownToggle.querySelector('.breakdown-toggle-hint');

    if (breakdownContent) {
      const isVisible = breakdownContent.style.display !== 'none';
      breakdownContent.style.display = isVisible ? 'none' : 'block';

      if (toggleIcon) {
        toggleIcon.classList.toggle('rotated', !isVisible);
      }
      if (toggleHint) {
        toggleHint.textContent = isVisible ? '펼치기' : '접기';
      }
    }
    return;
  }

  // Toggle contribution details section
  const contributionToggle = target.closest('[data-action="toggle-contribution-details"]') as HTMLElement;
  if (contributionToggle) {
    const detailsBody = contributionToggle.nextElementSibling as HTMLElement;
    const chevron = contributionToggle.querySelector('.details-chevron');

    if (detailsBody && chevron) {
      const isVisible = detailsBody.style.display !== 'none';
      detailsBody.style.display = isVisible ? 'none' : 'block';
      chevron.classList.toggle('rotated', !isVisible);
    }
    return;
  }
}

// =============================================================================
// CHANGE HANDLERS
// =============================================================================

function handleChange(e: Event): void {
  const target = e.target as HTMLElement;
  const state = getState();

  // Stat source checkboxes
  if (target.classList.contains('stat-source-checkbox')) {
    const checkbox = target as HTMLInputElement;
    const statKey = checkbox.dataset.statKey;
    const sourceIndex = parseInt(checkbox.dataset.sourceIndex || '');

    if (!statKey || isNaN(sourceIndex)) return;

    const stat = state.stats.get(statKey);
    if (!stat || !stat.sources[sourceIndex]) return;

    stat.sources[sourceIndex]!.active = checkbox.checked;
    aggregateStatsFromBuild();
    calculateAllDamage();
    return;
  }

  // Buff checkboxes
  if (target.classList.contains('buff-checkbox')) {
    const checkbox = target as HTMLInputElement;
    const index = parseInt(checkbox.dataset.buffIndex || '');

    if (isNaN(index) || !state.buffs[index]) return;

    state.buffs[index]!.active = checkbox.checked;
    aggregateStatsFromBuild();
    calculateAllDamage();
    return;
  }

  // Enemy toughness checkbox
  if (target.classList.contains('enemy-toughness-checkbox')) {
    const checkbox = target as HTMLInputElement;
    state.enemy.toughness = checkbox.checked ? 0 : 1;
    calculateAllDamage();

    // Re-render to update damage values
    if (typeof window.renderDamageCalculator === 'function') {
      window.renderDamageCalculator();
    }
    return;
  }
}

// =============================================================================
// INPUT HANDLERS
// =============================================================================

function handleInput(e: Event): void {
  const target = e.target as HTMLElement;
  const state = getState();

  // Manual stat adjustment inputs
  if (target.classList.contains('stat-manual-input')) {
    const input = target as HTMLInputElement;
    const statKey = input.dataset.statKey;

    if (!statKey) return;

    const stat = state.stats.get(statKey);
    if (stat) {
      stat.manualAdjustment = parseFloat(input.value) || 0;
      aggregateStatsFromBuild();
      calculateAllDamage();
    }
    return;
  }

  // Enemy property inputs
  if (target.classList.contains('enemy-level-input') ||
      target.classList.contains('enemy-defense-input') ||
      target.classList.contains('enemy-resistance-input')) {
    const input = target as HTMLInputElement;
    const prop = input.dataset.enemyProp as 'level' | 'defense' | 'resistance';

    if (!prop) return;

    const value = parseInt(input.value);
    if (isNaN(value)) return;

    if (prop === 'level') {
      state.enemy.level = Math.max(1, Math.min(100, value));
    } else if (prop === 'defense') {
      state.enemy.defense = Math.max(0, value);
    } else if (prop === 'resistance') {
      state.enemy.resistance = Math.max(-10000, Math.min(10000, value));
    }

    calculateAllDamage();

    // Re-render to update damage values
    if (typeof window.renderDamageCalculator === 'function') {
      window.renderDamageCalculator();
    }
    return;
  }
}

// =============================================================================
// LIMITBREAK ANALYSIS HANDLER
// =============================================================================

/**
 * Handle limit break analysis
 * Runs the analysis and updates the UI
 */
async function handleLimitBreakAnalysis(): Promise<void> {
  const state = getState();
  const skillType = state.limitbreak?.selectedSkill || state.limitbreak?.skillType || 'skill';

  // Set loading state
  state.limitbreak = {
    skillType,
    selectedSkill: skillType,
    dataPoints: [],
    chartData: null,
    loading: true
  };

  // Re-render to show loading state
  if (typeof window.renderDamageCalculator === 'function') {
    window.renderDamageCalculator();
  }

  try {
    // Run analysis
    const analysis = await analyzeLimitBreakProgression(skillType as SkillType);

    // Update state with results
    state.limitbreak = {
      ...analysis,
      loading: false
    };

    // Re-render to show results
    if (typeof window.renderDamageCalculator === 'function') {
      window.renderDamageCalculator();
    }

    // Initialize Chart.js chart after render
    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      initializeLimitBreakChart();
    }, 50);

    console.log('[DmgCalc] Limitbreak analysis complete', analysis);
  } catch (error) {
    console.error('[DmgCalc] Limitbreak analysis failed:', error);

    // Update state to clear loading
    state.limitbreak = {
      skillType,
      selectedSkill: skillType,
      dataPoints: [],
      chartData: null,
      loading: false
    };

    // Show error to user
    alert(`분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);

    // Re-render to clear loading state
    if (typeof window.renderDamageCalculator === 'function') {
      window.renderDamageCalculator();
    }
  }
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Remove event listeners (call on module unload)
 */
export function cleanupEventDelegation(): void {
  document.removeEventListener('click', handleClick);
  document.removeEventListener('change', handleChange);
  document.removeEventListener('input', handleInput);
}
