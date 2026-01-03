/**
 * Damage Calculator - Tab Management
 * Handles tab navigation and content rendering
 *
 * @module dmgcalc/ui/tabs
 */

import { getState, updateState } from '../core/state';
import { TAB_IDS } from '../constants';
import type { TabId } from '../types';

// Tab component imports
import { renderCurrentTab } from './tabs/current';
import { renderLimitbreakTab } from './tabs/limitbreak';
import { renderComparisonTab } from './tabs/comparison';
import { renderManualTab } from './tabs/manual';

// =============================================================================
// TAB CONFIGURATION
// =============================================================================

interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
  render: () => string;
}

const TAB_CONFIGS: TabConfig[] = [
  {
    id: TAB_IDS.CURRENT as TabId,
    label: '현재 빌드', // Current Build
    icon: 'calculator',
    render: renderCurrentTab
  },
  {
    id: TAB_IDS.LIMITBREAK as TabId,
    label: '한계 돌파', // Limit Break
    icon: 'chart-line',
    render: renderLimitbreakTab
  },
  {
    id: TAB_IDS.COMPARISON as TabId,
    label: '빌드 비교', // Build Comparison
    icon: 'code-compare',
    render: renderComparisonTab
  },
  {
    id: TAB_IDS.MANUAL as TabId,
    label: '수동 입력', // Manual Input
    icon: 'sliders',
    render: renderManualTab
  }
];

// =============================================================================
// TAB NAVIGATION RENDERING
// =============================================================================

/**
 * Renders the tab navigation bar
 */
export function renderTabNavigation(): string {
  const state = getState();
  const activeTab = state.activeTab || TAB_IDS.CURRENT;

  return `
    <div class="dmgcalc-tabs">
      <div class="dmgcalc-tabs-nav">
        ${TAB_CONFIGS.map(tab => `
          <button
            class="dmgcalc-tab-btn ${activeTab === tab.id ? 'active' : ''}"
            data-action="switch-tab"
            data-tab-id="${tab.id}"
          >
            <i class="fa-solid fa-${tab.icon}"></i>
            <span>${tab.label}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// =============================================================================
// TAB CONTENT RENDERING
// =============================================================================

/**
 * Renders the active tab's content
 */
export function renderTabContent(): string {
  const state = getState();
  const activeTab = state.activeTab || TAB_IDS.CURRENT;

  const tabConfig = TAB_CONFIGS.find(tab => tab.id === activeTab);

  if (!tabConfig) {
    console.warn(`[DmgCalc] Unknown tab: ${activeTab}, defaulting to CURRENT`);
    return renderCurrentTab();
  }

  return `
    <div class="dmgcalc-tab-content" data-tab-id="${activeTab}">
      ${tabConfig.render()}
    </div>
  `;
}

// =============================================================================
// TAB SWITCHING
// =============================================================================

/**
 * Switch to a different tab
 * Called by event delegation in utils/events.ts
 */
export function switchTab(tabId: string): void {
  const state = getState();

  // Validate tab ID
  const validTab = TAB_CONFIGS.find(tab => tab.id === tabId);
  if (!validTab) {
    console.warn(`[DmgCalc] Invalid tab ID: ${tabId}`);
    return;
  }

  // Update state
  updateState({ activeTab: tabId as TabId });

  // The main render function will be called by the event handler
  // No need to trigger re-render here
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the label for a tab ID
 */
export function getTabLabel(tabId: TabId): string {
  const tab = TAB_CONFIGS.find(t => t.id === tabId);
  return tab?.label || tabId;
}

/**
 * Get all available tab IDs
 */
export function getAllTabIds(): TabId[] {
  return TAB_CONFIGS.map(tab => tab.id);
}
