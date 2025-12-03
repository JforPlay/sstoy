/**
 * Resources Module - Data Loading
 */

import { loadCoreData, loadFeatureData, loadLanguageData } from '../shared/data-loader';
import { GameData } from '../shared/game-data';
import { resourcesState } from './resources-state';

export async function loadResourcesData(): Promise<void> {
  try {
    const gameLang = window.i18n?.currentLang || 'KR';
    console.log(`[Resources] Loading data for language: ${gameLang}`);

    await loadCoreData();
    await loadFeatureData('characterBuilder');
    await loadFeatureData('discSystem');

    await loadLanguageData(gameLang, ['Character.json', 'DiscIP.json', 'Item.json']);

    resourcesState.characters = GameData.characters || {};
    resourcesState.characterNames = (GameData.charactersKR || {}) as any;
    resourcesState.characterUpgrade = (GameData.characterUpgrade || {}) as any;
    resourcesState.characterSkillUpgrade = (GameData.characterSkillUpgrade || {}) as any;
    resourcesState.characterAdvance = (GameData.characterAdvance || {}) as any;
    resourcesState.charItemExp = GameData.charItemExp || {};
    resourcesState.charGem = GameData.charGem || {};
    resourcesState.discs = GameData.discs || {};
    resourcesState.discStrengthen = (GameData.discStrengthen || {}) as any;
    resourcesState.discPromote = (GameData.discPromote || {}) as any;
    resourcesState.discItemExp = GameData.discItemExp || {};
    resourcesState.discIP = GameData.discIP || {};
    resourcesState.discIPNames = (GameData.discIPKR || {}) as any;
    resourcesState.gameEnums = (GameData.gameEnums || {}) as any;
    resourcesState.items = GameData.items || {};
    resourcesState.itemNames = (GameData.itemsKR || {}) as any;

    // Initialize Fuse.js for character search
    initializeCharacterSearch();
  } catch (error) {
    console.error('Error loading resources data:', error);
    throw error;
  }
}

function initializeCharacterSearch(): void {
  // Prepare character data for search
  const characterList = Object.entries(resourcesState.characters)
    .filter(([, char]) => char.Visible && char.Available)
    .map(([id, char]) => ({
      id,
      Name: resourcesState.characterNames[char.Name as string] || char.Name,
    }));

  // Initialize Fuse.js if available
  if (typeof (window as any).Fuse !== 'undefined') {
    resourcesState.characterSelectorFuse = new (window as any).Fuse(characterList, {
      keys: ['Name'],
      threshold: 0.3,
    });
  }
}
