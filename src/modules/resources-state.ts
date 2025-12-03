/**
 * Resources Module - State
 */

import { saveToLocalStorage, loadFromLocalStorage, removeFromLocalStorage } from '../utils/storage';
import type { ResourcesState, MaterialGroup, StaminaConfig, SelectedCharacter, SelectedDisc } from './resources-types';

// =============================================================================
// CONFIGURATION
// =============================================================================

export const MATERIAL_GROUPS: Record<string, MaterialGroup[]> = {
  advance: [
    { items: [20071, 20072, 20073], mergeRatio: 3 },
    { items: [20081, 20082, 20083], mergeRatio: 3 },
    { items: [20091, 20092, 20093], mergeRatio: 3 },
  ],
  skill: [
    { items: [32001, 32002, 32003], mergeRatio: 3 },
    { items: [32011, 32012, 32013], mergeRatio: 3 },
    { items: [32021, 32022, 32023], mergeRatio: 3 },
  ],
  discAdvance: [
    { items: [21071, 21072, 21073], mergeRatio: 3 },
    { items: [21081, 21082, 21083], mergeRatio: 3 },
    { items: [21091, 21092, 21093], mergeRatio: 3 },
  ],
};

export const STAMINA_CONFIG: Record<string, StaminaConfig> = {
  advance: {
    dailyTaskReward: Math.ceil(85 + 17 * 0.5),
    dungeonDrop: Math.ceil(0.5 * 3 * 3 + 0.5 * 3 + 10),
    dungeonStamina: 30,
  },
  skill: {
    dailyTaskReward: Math.ceil(29.5 + 7.5 * 0.5),
    dungeonDrop: Math.ceil(0.5 * 3 * 3 + 1.5 * 3 + 10),
    dungeonStamina: 30,
  },
  discAdvance: {
    dailyTaskReward: Math.ceil(17 + 3.5 * 0.5),
    dungeonDrop: Math.ceil(0.5 * 3 * 3 + 0.5 * 3 + 10),
    dungeonStamina: 30,
  },
};

// =============================================================================
// STATE
// =============================================================================

export const resourcesState: ResourcesState = {
  characters: {},
  characterNames: {},
  characterUpgrade: {},
  characterSkillUpgrade: {},
  characterAdvance: {},
  charItemExp: {},
  charGem: {},
  discs: {},
  discStrengthen: {},
  discPromote: {},
  discItemExp: {},
  discIP: {},
  discIPNames: {},
  gameEnums: {},
  items: {},
  itemNames: {},
  selectedCharacters: [],
  selectedDiscs: [],
  ownedMaterials: {},
  characterResources: {},
  discResources: {},
  itemUsageIndex: {},
  currentElementFilter: 'all',
  currentSearchFilter: '',
  characterSelectorFuse: null,
};

// =============================================================================
// PERSISTENCE
// =============================================================================

export function saveResourcesState(): void {
  const stateToSave = {
    selectedCharacters: resourcesState.selectedCharacters,
    selectedDiscs: resourcesState.selectedDiscs,
    ownedMaterials: resourcesState.ownedMaterials,
    timestamp: Date.now(),
  };
  saveToLocalStorage('resourcesPageState', stateToSave);
}

export function loadResourcesStateFromStorage(
  onStateLoaded: (
    chars: SelectedCharacter[],
    discs: SelectedDisc[]
  ) => void
): void {
  const data = loadFromLocalStorage<{
    selectedCharacters: SelectedCharacter[];
    selectedDiscs: SelectedDisc[];
    ownedMaterials: Record<string, number>;
    timestamp: number;
  }>('resourcesPageState');

  if (!data) return;

  // Check if data is older than 7 days
  const daysSinceUpdate = (Date.now() - (data.timestamp || 0)) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate > 7) {
    removeFromLocalStorage('resourcesPageState');
    return;
  }

  if (data.ownedMaterials) {
    resourcesState.ownedMaterials = data.ownedMaterials;
  }

  if (data.selectedCharacters && data.selectedCharacters.length > 0) {
    resourcesState.selectedCharacters = data.selectedCharacters;
  }

  if (data.selectedDiscs && data.selectedDiscs.length > 0) {
    resourcesState.selectedDiscs = data.selectedDiscs;
  }

  if (resourcesState.selectedCharacters.length > 0 || resourcesState.selectedDiscs.length > 0) {
    // Callback to recalculate resources since we moved calculation logic out
    onStateLoaded(resourcesState.selectedCharacters, resourcesState.selectedDiscs);
    
    window.showToast?.(window.i18n?.t('resources.loadedPreviousItems') || '이전 선택 항목을 불러왔습니다', 'success');
  }
}
