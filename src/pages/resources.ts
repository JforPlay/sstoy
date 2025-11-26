/**
 * Resources Page Module
 * Handles resource calculation for character and disc upgrades
 */

// Import shared utilities (auto-initializes)
import '@/shared';
import '@/i18n';
import { saveToLocalStorage, loadFromLocalStorage, removeFromLocalStorage } from '@/utils/storage';

import type { CharacterData, Disc, GameEnums } from '@/types';

// =============================================================================
// INTERFACES
// =============================================================================

interface MaterialGroup {
  items: number[];
  mergeRatio: number;
}

interface StaminaConfig {
  dailyTaskReward: number;
  dungeonDrop: number;
  dungeonStamina: number;
}

interface CharacterUpgrade {
  Exp?: number;
  [key: string]: unknown;
}

interface CharacterAdvance {
  Group?: number;
  AdvanceLvl?: number;
  GoldQty?: number;
  Tid1?: number;
  Qty1?: number;
  Tid2?: number;
  Qty2?: number;
  Tid3?: number;
  Qty3?: number;
  Tid4?: number;
  Qty4?: number;
  [key: string]: unknown;
}

interface CharacterSkillUpgrade {
  Id: number;
  Group?: number;
  AdvanceNum?: number;
  GoldQty?: number;
  Tid1?: number;
  Qty1?: number;
  Tid2?: number;
  Qty2?: number;
  Tid3?: number;
  Qty3?: number;
  Tid4?: number;
  Qty4?: number;
  [key: string]: unknown;
}

interface CharItemExp {
  ItemId: number;
  ExpValue: number;
}

interface CharGem {
  GenerateCostTid?: number;
  [key: string]: unknown;
}

interface DiscStrengthen {
  Exp?: number;
  [key: string]: unknown;
}

interface DiscPromote {
  ExpenseGold?: number;
  ItemId1?: number;
  Num1?: number;
  ItemId2?: number;
  Num2?: number;
  ItemId3?: number;
  Num3?: number;
  [key: string]: unknown;
}

interface DiscItemExp {
  ItemId: number;
  Exp: number;
}

interface DiscIP {
  StoryName?: string;
  [key: string]: unknown;
}

interface Item {
  Id: number;
  Title?: string;
  Icon?: string;
  Rarity?: number;
  [key: string]: unknown;
}

interface SelectedCharacter {
  id: string;
  name: string;
  currentLevel: number;
  targetLevel: number;
  skillLevels: {
    normal: { current: number; target: number };
    main: { current: number; target: number };
    assist: { current: number; target: number };
    ultimate: { current: number; target: number };
  };
}

interface SelectedDisc {
  id: string;
  name: string;
  rarity: number;
  currentLevel: number;
  targetLevel: number;
  data: Disc;
}

interface CharacterResources {
  exp: number;
  expItems: Record<number, number>;
  skillItems: Record<number, number>;
  advanceItems: Record<number, number>;
  gold: number;
  levelupGold: number;
}

interface DiscResources {
  exp: number;
  advanceItems: Record<number, number>;
  gold: number;
  levelupGold: number;
}

interface TotalResources {
  exp: number;
  advanceItems: Record<number, number>;
  skillItems: Record<number, number>;
  discAdvanceItems?: Record<number, number>;
  gold: number;
  levelupGold: number;
}

interface ResourcesState {
  characters: Record<string, CharacterData & { AdvanceGroup?: number; SkillsUpgradeGroup?: number[]; GemSlots?: number[] }>;
  characterNames: Record<string, string>;
  characterUpgrade: Record<string, CharacterUpgrade>;
  characterSkillUpgrade: Record<string, CharacterSkillUpgrade>;
  characterAdvance: Record<string, CharacterAdvance>;
  charItemExp: Record<string, CharItemExp>;
  charGem: Record<string, CharGem>;
  discs: Record<string, Disc & { PromoteGroupId?: number; StrengthenGroupId?: number }>;
  discStrengthen: Record<string, DiscStrengthen>;
  discPromote: Record<string, DiscPromote>;
  discItemExp: Record<string, DiscItemExp>;
  discIP: Record<string, DiscIP>;
  discIPNames: Record<string, string>;
  gameEnums: GameEnums;
  items: Record<string, Item>;
  itemNames: Record<string, string>;
  selectedCharacters: SelectedCharacter[];
  selectedDiscs: SelectedDisc[];
  ownedMaterials: Record<string, number>;
  characterResources: Record<string, CharacterResources>;
  discResources: Record<string, DiscResources>;
  itemUsageIndex: Record<string, { characters: string[]; discs: string[] }>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const MATERIAL_GROUPS: Record<string, MaterialGroup[]> = {
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

const STAMINA_CONFIG: Record<string, StaminaConfig> = {
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

const resourcesState: ResourcesState = {
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
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function showLoadingState(show: boolean): void {
  let loader = document.getElementById('resources-loader');
  if (!loader && show) {
    loader = document.createElement('div');
    loader.id = 'resources-loader';
    loader.className = 'loading-overlay';
    loader.innerHTML = `
      <div class="loading-spinner">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>데이터를 불러오는 중...</p>
      </div>
    `;
    document.body.appendChild(loader);
  }

  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
}

function saveResourcesState(): void {
  const stateToSave = {
    selectedCharacters: resourcesState.selectedCharacters,
    selectedDiscs: resourcesState.selectedDiscs,
    ownedMaterials: resourcesState.ownedMaterials,
    timestamp: Date.now(),
  };
  saveToLocalStorage('resourcesPageState', stateToSave);
}

function loadResourcesStateFromStorage(): void {
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
    data.selectedCharacters.forEach((char: SelectedCharacter) => {
      calculateCharacterResources(char.id);
    });
  }

  if (data.selectedDiscs && data.selectedDiscs.length > 0) {
    resourcesState.selectedDiscs = data.selectedDiscs;
    data.selectedDiscs.forEach((disc: SelectedDisc) => {
      calculateDiscResources(disc.id);
    });
  }

  if (resourcesState.selectedCharacters.length > 0 || resourcesState.selectedDiscs.length > 0) {
    window.showToast?.('이전 선택 항목을 불러왔습니다', 'success');
  }
}

function buildItemUsageIndex(): void {
  resourcesState.itemUsageIndex = {};

  Object.entries(resourcesState.characterResources).forEach(([charId, resources]) => {
    const allItems = {
      ...resources.advanceItems,
      ...resources.skillItems,
    };

    Object.keys(allItems).forEach((itemId) => {
      if (!resourcesState.itemUsageIndex[itemId]) {
        resourcesState.itemUsageIndex[itemId] = { characters: [], discs: [] };
      }
      resourcesState.itemUsageIndex[itemId].characters.push(charId);
    });
  });

  Object.entries(resourcesState.discResources).forEach(([discId, resources]) => {
    Object.keys(resources.advanceItems || {}).forEach((itemId) => {
      if (!resourcesState.itemUsageIndex[itemId]) {
        resourcesState.itemUsageIndex[itemId] = { characters: [], discs: [] };
      }
      resourcesState.itemUsageIndex[itemId].discs.push(discId);
    });
  });
}

function convertToLowestTier(
  itemId: string | number,
  quantity: number
): { lowestItemId: number; convertedQuantity: number } | null {
  const allGroups = [
    ...(MATERIAL_GROUPS.advance || []),
    ...(MATERIAL_GROUPS.skill || []),
    ...(MATERIAL_GROUPS.discAdvance || [])
  ];
  for (const group of allGroups) {
    const itemIndex = group.items.indexOf(parseInt(String(itemId)));
    if (itemIndex !== -1) {
      const multiplier = Math.pow(group.mergeRatio, itemIndex);
      const lowestItemId = group.items[0];
      if (lowestItemId === undefined) continue;
      return {
        lowestItemId,
        convertedQuantity: quantity * multiplier,
      };
    }
  }
  return null;
}

function calculateStaminaEstimate(
  items: Record<number | string, number>,
  type: string
): { estimatedStamina: number; estimatedDays: number; totalLowestTierCount: number } | null {
  const config = STAMINA_CONFIG[type];
  if (!config) return null;

  let totalLowestTierCount = 0;

  for (const [itemId, qty] of Object.entries(items)) {
    const conversion = convertToLowestTier(itemId, qty);
    if (conversion) {
      totalLowestTierCount += conversion.convertedQuantity;
    }
  }

  if (totalLowestTierCount === 0) return null;

  const dungeonRuns = Math.ceil(totalLowestTierCount / config.dungeonDrop);
  const estimatedStamina = dungeonRuns * config.dungeonStamina;
  const estimatedDays = Math.ceil(totalLowestTierCount / config.dailyTaskReward);

  return {
    estimatedStamina,
    estimatedDays,
    totalLowestTierCount,
  };
}

function isGroupedMaterial(itemId: string | number, type: string): boolean {
  const groups = MATERIAL_GROUPS[type];
  if (!groups) return false;
  return groups.some((group) => group.items.includes(parseInt(String(itemId))));
}

function getCharactersUsingItem(itemId: string): SelectedCharacter[] {
  if (resourcesState.itemUsageIndex[itemId]?.characters) {
    return resourcesState.itemUsageIndex[itemId].characters
      .map((charId) => resourcesState.selectedCharacters.find((c) => c.id === charId))
      .filter((c): c is SelectedCharacter => c !== undefined);
  }
  return [];
}

function getDiscsUsingItem(itemId: string): SelectedDisc[] {
  if (resourcesState.itemUsageIndex[itemId]?.discs) {
    return resourcesState.itemUsageIndex[itemId].discs
      .map((discId) => resourcesState.selectedDiscs.find((d) => d.id === discId))
      .filter((d): d is SelectedDisc => d !== undefined);
  }
  return [];
}

// =============================================================================
// DATA LOADING
// =============================================================================

async function loadResourcesData(): Promise<void> {
  try {
    const gameLang = window.i18n?.currentLang || 'KR';
    const dataPath = window.i18n?.getDataPath(gameLang) || 'data/KR';

    console.log(`[Resources] Loading data for language: ${gameLang}`);

    const [
      charactersData,
      characterNamesData,
      characterUpgradeData,
      characterSkillUpgradeData,
      characterAdvanceData,
      charItemExpData,
      charGemData,
      discsData,
      discStrengthenData,
      discPromoteData,
      discItemExpData,
      discIPData,
      discIPNamesData,
      gameEnumsData,
      itemsData,
      itemNamesData,
    ] = await Promise.all([
      fetch('data/Character.json').then((r) => r.json()),
      fetch(`${dataPath}/Character.json`).then((r) => r.json()),
      fetch('data/CharacterUpgrade.json').then((r) => r.json()),
      fetch('data/CharacterSkillUpgrade.json').then((r) => r.json()),
      fetch('data/CharacterAdvance.json').then((r) => r.json()),
      fetch('data/CharItemExp.json').then((r) => r.json()),
      fetch('data/CharGem.json').then((r) => r.json()),
      fetch('data/Disc.json').then((r) => r.json()),
      fetch('data/DiscStrengthen.json').then((r) => r.json()),
      fetch('data/DiscPromote.json').then((r) => r.json()),
      fetch('data/DiscItemExp.json').then((r) => r.json()),
      fetch('data/DiscIP.json').then((r) => r.json()),
      fetch(`${dataPath}/DiscIP.json`).then((r) => r.json()),
      fetch('data/GameEnums.json').then((r) => r.json()),
      fetch('data/Item.json').then((r) => r.json()),
      fetch(`${dataPath}/Item.json`).then((r) => r.json()),
    ]);

    resourcesState.characters = charactersData;
    resourcesState.characterNames = characterNamesData;
    resourcesState.characterUpgrade = characterUpgradeData;
    resourcesState.characterSkillUpgrade = characterSkillUpgradeData;
    resourcesState.characterAdvance = characterAdvanceData;
    resourcesState.charItemExp = charItemExpData;
    resourcesState.charGem = charGemData;
    resourcesState.discs = discsData;
    resourcesState.discStrengthen = discStrengthenData;
    resourcesState.discPromote = discPromoteData;
    resourcesState.discItemExp = discItemExpData;
    resourcesState.discIP = discIPData;
    resourcesState.discIPNames = discIPNamesData;
    resourcesState.gameEnums = gameEnumsData;
    resourcesState.items = itemsData;
    resourcesState.itemNames = itemNamesData;
  } catch (error) {
    console.error('Error loading resources data:', error);
    throw error;
  }
}

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

function calculateCharacterResources(characterId: string): void {
  const selectedChar = resourcesState.selectedCharacters.find((c) => c.id === characterId);
  const character = resourcesState.characters[characterId];

  if (!selectedChar || !character) return;

  const resources: CharacterResources = {
    exp: 0,
    expItems: {},
    skillItems: {},
    advanceItems: {},
    gold: 0,
    levelupGold: 0,
  };

  const currentLevel = selectedChar.currentLevel;
  const targetLevel = selectedChar.targetLevel;

  for (let level = currentLevel + 1; level <= targetLevel; level++) {
    const levelId = 10000 + level;
    const levelData = resourcesState.characterUpgrade[levelId];
    if (levelData && levelData.Exp) {
      resources.exp += levelData.Exp;
    }
  }

  resources.levelupGold = Math.round((resources.exp / 1000) * 150);

  const advanceLevels = [10, 20, 30, 40, 50, 60, 70, 80];
  const advanceGroup = character.AdvanceGroup;

  if (advanceGroup) {
    advanceLevels.forEach((advLevel) => {
      if (targetLevel >= advLevel && currentLevel < advLevel) {
        const advanceLvl = advLevel / 10;

        const advanceData = Object.values(resourcesState.characterAdvance).find(
          (adv) => adv.Group === advanceGroup && adv.AdvanceLvl === advanceLvl
        );

        if (advanceData) {
          if (advanceData.GoldQty) {
            resources.gold += advanceData.GoldQty;
          }

          for (let i = 1; i <= 4; i++) {
            const tidKey = `Tid${i}` as keyof CharacterAdvance;
            const qtyKey = `Qty${i}` as keyof CharacterAdvance;

            if (advanceData[tidKey] && advanceData[qtyKey]) {
              const itemId = advanceData[tidKey] as number;
              const qty = advanceData[qtyKey] as number;

              if (!resources.advanceItems[itemId]) {
                resources.advanceItems[itemId] = 0;
              }
              resources.advanceItems[itemId] += qty;
            }
          }
        }
      }
    });
  }

  const skillTypes = ['normal', 'main', 'assist', 'ultimate'] as const;
  const skillUpgradeGroups = character.SkillsUpgradeGroup || [];

  skillTypes.forEach((skillType, index) => {
    const skillGroup = skillUpgradeGroups[index];
    if (!skillGroup) return;

    const currentSkillLevel = selectedChar.skillLevels[skillType].current;
    const targetSkillLevel = selectedChar.skillLevels[skillType].target;

    const skillUpgrades = Object.values(resourcesState.characterSkillUpgrade)
      .filter((upgrade) => upgrade.Group === skillGroup)
      .sort((a, b) => a.Id - b.Id);

    for (let level = currentSkillLevel; level < targetSkillLevel; level++) {
      const upgrade = skillUpgrades[level];

      if (upgrade) {
        if (upgrade.GoldQty) {
          resources.gold += upgrade.GoldQty;
        }

        for (let i = 1; i <= 4; i++) {
          const tidKey = `Tid${i}` as keyof CharacterSkillUpgrade;
          const qtyKey = `Qty${i}` as keyof CharacterSkillUpgrade;

          if (upgrade[tidKey] && upgrade[qtyKey]) {
            const itemId = upgrade[tidKey] as number;
            const qty = upgrade[qtyKey] as number;

            if (!resources.skillItems[itemId]) {
              resources.skillItems[itemId] = 0;
            }
            resources.skillItems[itemId] += qty;
          }
        }
      }
    }
  });

  resourcesState.characterResources[characterId] = resources;
}

function calculateDiscResources(discId: string): void {
  const disc = resourcesState.selectedDiscs.find((d) => d.id === discId);
  if (!disc) return;

  const currentLevel = disc.currentLevel;
  const targetLevel = disc.targetLevel;
  const rarity = disc.rarity;

  let totalExp = 0;
  const expGroupPrefix = rarity === 5 ? 41 : rarity === 4 ? 31 : 11;

  for (let level = currentLevel; level < targetLevel; level++) {
    const strengthenId = `${expGroupPrefix}${String(level + 1).padStart(3, '0')}`;
    const strengthenData = resourcesState.discStrengthen[strengthenId];
    if (strengthenData && strengthenData.Exp) {
      totalExp += strengthenData.Exp;
    }
  }

  const advanceItems: Record<number, number> = {};
  let advanceGold = 0;
  const advanceLevels = [10, 20, 30, 40, 50, 60, 70, 80];

  advanceLevels.forEach((advLevel, index) => {
    if (currentLevel < advLevel && targetLevel >= advLevel) {
      const promoteGroupId = disc.data.PromoteGroupId;
      const advanceNum = index + 1;
      const promoteId = `${promoteGroupId}${String(advanceNum).padStart(3, '0')}`;
      const promoteData = resourcesState.discPromote[promoteId];

      if (promoteData) {
        if (promoteData.ExpenseGold) {
          advanceGold += promoteData.ExpenseGold;
        }

        for (let i = 1; i <= 3; i++) {
          const itemIdKey = `ItemId${i}` as keyof DiscPromote;
          const numKey = `Num${i}` as keyof DiscPromote;

          if (promoteData[itemIdKey]) {
            const itemId = promoteData[itemIdKey] as number;
            const qty = (promoteData[numKey] as number) || 0;

            if (qty > 0) {
              if (!advanceItems[itemId]) {
                advanceItems[itemId] = 0;
              }
              advanceItems[itemId] += qty;
            }
          }
        }
      }
    }
  });

  const levelupGold = Math.round((totalExp / 1000) * 250);

  resourcesState.discResources[discId] = {
    exp: totalExp,
    advanceItems,
    gold: advanceGold,
    levelupGold,
  };
}

function calculateNetResourcesWithMerging(
  totalResources: TotalResources,
  ownedMaterials: Record<string, number>
): TotalResources {
  const netResources: TotalResources = {
    advanceItems: { ...totalResources.advanceItems },
    skillItems: { ...totalResources.skillItems },
    discAdvanceItems: { ...(totalResources.discAdvanceItems || {}) },
    exp: totalResources.exp,
    gold: totalResources.gold,
    levelupGold: totalResources.levelupGold,
  };

  const allMaterialGroups = [
    ...(MATERIAL_GROUPS.advance || []).map((g) => ({ ...g, type: 'advanceItems' as const })),
    ...(MATERIAL_GROUPS.skill || []).map((g) => ({ ...g, type: 'skillItems' as const })),
    ...(MATERIAL_GROUPS.discAdvance || []).map((g) => ({ ...g, type: 'discAdvanceItems' as const })),
  ];

  for (const group of allMaterialGroups) {
    let leftover = 0;
    for (let i = 0; i < group.items.length; i++) {
      const itemId = group.items[i]!;
      const resourceType = netResources[group.type] as Record<number, number>;
      const required = totalResources[group.type]?.[itemId] || 0;
      if (required === 0 && !ownedMaterials[itemId]) continue;

      const owned = (ownedMaterials[itemId] || 0) + leftover;
      const net = required - owned;

      if (net > 0) {
        resourceType[itemId] = net;
        leftover = 0;
      } else {
        resourceType[itemId] = 0;
        leftover = Math.floor(-net / group.mergeRatio);
      }
    }
  }

  for (const type of ['advanceItems', 'skillItems', 'discAdvanceItems'] as const) {
    const resourceType = netResources[type] as Record<number, number> | undefined;
    if (resourceType) {
      for (const itemId in resourceType) {
        const numId = parseInt(itemId);
        if (resourceType[numId] && resourceType[numId] <= 0) {
          delete resourceType[numId];
        }
      }
    }
  }

  return netResources;
}

function calculateTotalOwnedExp(expType: 'character' | 'disc'): number {
  let totalOwnedExp = 0;
  const itemExpData =
    expType === 'character' ? resourcesState.charItemExp : resourcesState.discItemExp;
  const itemExpMap: Record<number, number> = {};

  Object.values(itemExpData).forEach((item) => {
    itemExpMap[item.ItemId] =
      expType === 'character' ? (item as CharItemExp).ExpValue : (item as DiscItemExp).Exp;
  });

  for (const itemId in resourcesState.ownedMaterials) {
    if (itemExpMap[parseInt(itemId)]) {
      const ownedQty = resourcesState.ownedMaterials[itemId] || 0;
      const expValue = itemExpMap[parseInt(itemId)];
      if (expValue !== undefined) {
        totalOwnedExp += ownedQty * expValue;
      }
    }
  }
  return totalOwnedExp;
}

// =============================================================================
// UI FUNCTIONS
// =============================================================================

function switchResourceTab(tabName: string): void {
  document.querySelectorAll('.resources-tab-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  document.querySelector(`.resources-tab-btn[data-tab="${tabName}"]`)?.classList.add('active');

  document.querySelectorAll('.resources-tab-content').forEach((content) => {
    content.classList.remove('active');
  });
  document.getElementById(`resources-tab-${tabName}`)?.classList.add('active');

  if (tabName === 'glance') {
    renderGlanceTabContent();
  }
}

function openCharacterResourceSelect(): void {
  const modal = document.getElementById('character-resource-modal');
  const grid = document.getElementById('character-resource-grid');

  if (!modal || !grid) return;

  grid.innerHTML = '';

  const availableCharacters = Object.entries(resourcesState.characters)
    .filter(([, char]) => char.Visible && char.Available)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  const fragment = document.createDocumentFragment();

  availableCharacters.forEach(([id, char]) => {
    const isSelected = resourcesState.selectedCharacters.some((c) => c.id === id);

    const charItem = document.createElement('div');
    charItem.className = `character-item ${isSelected ? 'disabled' : ''}`;
    charItem.dataset.characterId = id;

    const charName = resourcesState.characterNames[char.Name as string] || char.Name;

    charItem.innerHTML = `
      <div class="character-item-header">
        <img src="assets/char/avg1_${id}_002.png"
             alt="${charName}"
             class="character-item-image"
             loading="lazy"
             onerror="this.style.display='none'">
      </div>
      <div class="character-item-info">
        <div class="character-item-name">${charName}</div>
        ${isSelected ? '<div class="character-item-id" style="color: var(--primary-color);">선택됨</div>' : ''}
      </div>
    `;

    fragment.appendChild(charItem);
  });

  grid.appendChild(fragment);
  modal.classList.add('active');
}

function closeCharacterResourceSelect(): void {
  document.getElementById('character-resource-modal')?.classList.remove('active');
}

function selectCharacterForResources(characterId: string): void {
  const character = resourcesState.characters[characterId];
  if (!character) return;

  const charName = resourcesState.characterNames[character.Name as string] || character.Name;

  const selectedChar: SelectedCharacter = {
    id: characterId,
    name: charName as string,
    currentLevel: 1,
    targetLevel: 90,
    skillLevels: {
      normal: { current: 1, target: 10 },
      main: { current: 1, target: 10 },
      assist: { current: 1, target: 10 },
      ultimate: { current: 1, target: 10 },
    },
  };

  resourcesState.selectedCharacters.push(selectedChar);
  calculateCharacterResources(characterId);
  buildItemUsageIndex();
  closeCharacterResourceSelect();
  renderSelectedCharactersList();
  renderResourceSummary();
  saveResourcesState();

  window.showToast?.(`${charName}이(가) 추가되었습니다`, 'success');
}

function updateCharacterLevel(characterId: string, field: string, value: string): void {
  const selectedChar = resourcesState.selectedCharacters.find((c) => c.id === characterId);
  if (!selectedChar) return;

  const numValue = parseInt(value) || 1;
  const clampedValue = Math.max(1, Math.min(90, numValue));

  if (clampedValue !== numValue) {
    window.showToast?.(`값이 ${clampedValue}(으)로 조정되었습니다`, 'info');
  }

  (selectedChar as unknown as Record<string, unknown>)[field] = clampedValue;

  calculateCharacterResources(characterId);
  buildItemUsageIndex();
  renderResourceSummary();
  saveResourcesState();
}

function updateCharacterSkillLevel(
  characterId: string,
  skillType: 'normal' | 'main' | 'assist' | 'ultimate',
  field: 'current' | 'target',
  value: string
): void {
  const selectedChar = resourcesState.selectedCharacters.find((c) => c.id === characterId);
  if (!selectedChar) return;

  const numValue = parseInt(value) || 1;
  const clampedValue = Math.max(1, Math.min(10, numValue));

  if (clampedValue !== numValue) {
    window.showToast?.(`값이 ${clampedValue}(으)로 조정되었습니다`, 'info');
  }

  selectedChar.skillLevels[skillType][field] = clampedValue;

  calculateCharacterResources(characterId);
  buildItemUsageIndex();
  renderResourceSummary();
  saveResourcesState();
}

function removeCharacterFromResources(characterId: string): void {
  resourcesState.selectedCharacters = resourcesState.selectedCharacters.filter(
    (c) => c.id !== characterId
  );
  delete resourcesState.characterResources[characterId];

  buildItemUsageIndex();
  renderSelectedCharactersList();
  renderResourceSummary();
  saveResourcesState();

  window.showToast?.('캐릭터가 제거되었습니다', 'info');
}

function renderSelectedCharactersList(): void {
  const container = document.getElementById('selected-characters-list');
  if (!container) return;

  if (resourcesState.selectedCharacters.length === 0) {
    container.innerHTML = `
      <div class="empty-selection-state">
        <div class="empty-icon">${window.getIcon?.('emptyClipboard') || ''}</div>
        <p>캐릭터를 선택하여 자원 계산을 시작하세요</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  resourcesState.selectedCharacters.forEach((char) => {
    const card = document.createElement('div');
    card.className = 'character-resource-card';
    card.dataset.characterId = char.id;
    card.innerHTML = `
      <div class="character-resource-header">
        <img src="assets/char/avg1_${char.id}_002.png"
             alt="${char.name}"
             class="character-resource-avatar"
             loading="lazy"
             onerror="this.src='assets/char/${char.id}_icon.png'">
        <div class="character-resource-info">
          <div class="character-resource-name">${char.name}</div>
        </div>
        <div class="character-resource-actions">
          <button class="remove-resource-btn" type="button">
            ${window.getIcon?.('remove') || ''} 제거
          </button>
        </div>
      </div>

      <div class="character-level-controls">
        <div class="level-section">
          <div class="level-section-title">캐릭터 레벨</div>
          <div class="level-input-row">
            <div class="level-input-group">
              <label class="level-input-label">현재</label>
              <input type="number"
                     class="level-input-field"
                     value="${char.currentLevel}"
                     min="1"
                     max="90"
                     data-level-type="character"
                     data-field="currentLevel">
            </div>
            <div class="level-input-group">
              <label class="level-input-label">목표</label>
              <input type="number"
                     class="level-input-field"
                     value="${char.targetLevel}"
                     min="1"
                     max="90"
                     data-level-type="character"
                     data-field="targetLevel">
            </div>
          </div>
        </div>

        <div class="level-section">
          <div class="level-section-title">스킬 레벨</div>
          <div class="skill-level-grid">
            ${['normal', 'main', 'assist', 'ultimate']
              .map(
                (skillType) => `
              <div class="skill-level-item">
                <div class="skill-level-name">${skillType === 'normal' ? '일반' : skillType === 'main' ? '메인' : skillType === 'assist' ? '지원' : '필살기'}</div>
                <div class="skill-level-inputs">
                  <input type="number"
                         class="level-input-field compact"
                         value="${char.skillLevels[skillType as keyof typeof char.skillLevels].current}"
                         min="1"
                         max="10"
                         data-level-type="skill"
                         data-skill-type="${skillType}"
                         data-field="current">
                  <span>→</span>
                  <input type="number"
                         class="level-input-field compact"
                         value="${char.skillLevels[skillType as keyof typeof char.skillLevels].target}"
                         min="1"
                         max="10"
                         data-level-type="skill"
                         data-skill-type="${skillType}"
                         data-field="target">
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function createResourceItemElement(
  item: Item,
  netQty: number,
  requiredQty: number,
  ownedQty: number,
  itemId: string
): HTMLElement {
  const itemName = resourcesState.itemNames[item.Title || ''] || item.Title || '';
  const rarity = item.Rarity || 1;
  const bgImage = `assets/items/rare_item_a_${6 - rarity}.png`;

  let iconPath = '';
  if (item.Icon) {
    iconPath = `assets/items/${item.Icon.split('/').pop()}.png`;
  } else if (itemId) {
    iconPath = `assets/items/item_${itemId}.png`;
  }

  const charactersUsing = itemId ? getCharactersUsingItem(itemId) : [];
  const discsUsing = itemId ? getDiscsUsingItem(itemId) : [];

  const div = document.createElement('div');
  div.className = 'resource-item';
  if (netQty <= 0 && requiredQty > 0) {
    div.classList.add('completed');
    div.title = `완료!\n필요: ${requiredQty.toLocaleString()}\n보유: ${ownedQty.toLocaleString()}`;
  } else {
    div.title = `필요: ${requiredQty.toLocaleString()}\n보유: ${ownedQty.toLocaleString()}`;
  }

  let characterIconsHTML = '';
  const totalIcons = charactersUsing.length + discsUsing.length;

  if (totalIcons > 0) {
    const maxVisible = 3;
    const visibleCharacters = charactersUsing.slice(0, Math.min(maxVisible, charactersUsing.length));
    const visibleDiscs = discsUsing.slice(0, Math.max(0, maxVisible - charactersUsing.length));
    const remaining = totalIcons - visibleCharacters.length - visibleDiscs.length;

    characterIconsHTML = `
      <div class="character-icons-overlay">
        ${visibleCharacters
          .map(
            (char) => `
          <img src="assets/char/avg1_${char.id}_002.png"
               class="character-icon-small"
               alt="${char.name}"
               title="${char.name}"
               loading="lazy"
               onerror="this.style.display='none'">
        `
          )
          .join('')}
        ${visibleDiscs
          .map((disc) => {
            let discIconPath = '';
            if (disc.data.DiscBg) {
              const fileId = disc.data.DiscBg.split('/').pop();
              discIconPath = `assets/disc_icons/outfit_${fileId}.png`;
            }
            return `
            <img src="${discIconPath}"
                 class="character-icon-small"
                 alt="${disc.name}"
                 title="${disc.name}"
                 loading="lazy"
                 onerror="this.style.display='none'">
          `;
          })
          .join('')}
        ${remaining > 0 ? `<div class="character-icons-more" title="${remaining}개 더">+${remaining}</div>` : ''}
      </div>
    `;
  }

  div.innerHTML = `
    <div class="resource-item-icon-wrapper">
      <img src="${bgImage}" class="resource-item-bg" alt="" loading="lazy" onerror="this.style.display='none'">
      <img src="${iconPath}" class="resource-item-icon" alt="${itemName}" loading="lazy" onerror="this.style.display='none'">
      ${characterIconsHTML}
    </div>
    <div class="resource-item-name">${itemName}</div>
    <div class="resource-item-qty">×${netQty.toLocaleString()}</div>
  `;

  if (netQty <= 0) {
    div.style.display = 'none';
  }

  return div;
}

function renderResourceSummary(): void {
  const container = document.getElementById('resource-summary-content');
  if (!container) return;

  if (resourcesState.selectedCharacters.length === 0) {
    container.innerHTML = `
      <div class="empty-summary-state">
        <div class="empty-icon"><i class="fa-solid fa-chart-simple"></i></div>
        <p>선택된 여행가가 없습니다</p>
      </div>
    `;
    return;
  }

  const totalResources: TotalResources = {
    exp: 0,
    advanceItems: {},
    skillItems: {},
    gold: 0,
    levelupGold: 0,
  };

  Object.values(resourcesState.characterResources).forEach((resources) => {
    totalResources.exp += resources.exp;
    totalResources.gold += resources.gold;
    totalResources.levelupGold += resources.levelupGold || 0;

    Object.entries(resources.advanceItems || {}).forEach(([itemId, qty]) => {
      const numId = parseInt(itemId);
      if (!totalResources.advanceItems[numId]) {
        totalResources.advanceItems[numId] = 0;
      }
      totalResources.advanceItems[numId]! += qty;
    });

    Object.entries(resources.skillItems).forEach(([itemId, qty]) => {
      const numId = parseInt(itemId);
      if (!totalResources.skillItems[numId]) {
        totalResources.skillItems[numId] = 0;
      }
      totalResources.skillItems[numId]! += qty;
    });
  });

  const netResources = calculateNetResourcesWithMerging(totalResources, resourcesState.ownedMaterials);

  container.innerHTML = '';

  if (Object.keys(netResources.advanceItems).length > 0) {
    const advanceEstimate = calculateStaminaEstimate(netResources.advanceItems, 'advance');
    const advanceSection = document.createElement('div');
    advanceSection.className = 'resource-category';

    let estimateHTML = '';
    if (advanceEstimate) {
      estimateHTML = `
        <div class="stamina-estimate" title="남은 재료 기준">
          <span class="estimate-item"><i class="fa-solid fa-bolt"></i> ${advanceEstimate.estimatedStamina.toLocaleString()} 스태미나</span>
          <span class="estimate-separator">|</span>
          <span class="estimate-item"><i class="fa-regular fa-calendar"></i> ${advanceEstimate.estimatedDays}일</span>
        </div>
      `;
    }

    advanceSection.innerHTML = `
      <div class="resource-category-header">
        <div class="resource-category-title">승급 아이템 (여행가)</div>
        ${estimateHTML}
      </div>
      <div class="resource-items-container" id="advance-items-container"></div>
    `;
    container.appendChild(advanceSection);
    renderAdvanceItems(netResources.advanceItems, totalResources.advanceItems);
  }

  if (Object.keys(netResources.skillItems).length > 0) {
    const skillEstimate = calculateStaminaEstimate(netResources.skillItems, 'skill');
    const skillSection = document.createElement('div');
    skillSection.className = 'resource-category';

    let estimateHTML = '';
    if (skillEstimate) {
      estimateHTML = `
        <div class="stamina-estimate" title="남은 재료 기준">
          <span class="estimate-item"><i class="fa-solid fa-bolt"></i> ${skillEstimate.estimatedStamina.toLocaleString()} 스태미나</span>
          <span class="estimate-separator">|</span>
          <span class="estimate-item"><i class="fa-regular fa-calendar"></i> ${skillEstimate.estimatedDays}일</span>
        </div>
      `;
    }

    skillSection.innerHTML = `
      <div class="resource-category-header">
        <div class="resource-category-title">스킬 강화 아이템</div>
        ${estimateHTML}
      </div>
      <div class="resource-items-container" id="skill-items-container"></div>
    `;
    container.appendChild(skillSection);
    renderSkillItems(netResources.skillItems, totalResources.skillItems);
  }

  const totalRequiredGold = totalResources.gold + totalResources.levelupGold;
  const netGold = Math.max(0, totalRequiredGold - (resourcesState.ownedMaterials['1'] || 0));

  const grossExp = totalResources.exp;
  const totalOwnedExp = calculateTotalOwnedExp('character');
  const netExp = Math.max(0, grossExp - totalOwnedExp);

  if (grossExp > 0 || netGold > 0) {
    const bottomSection = document.createElement('div');
    bottomSection.className = 'resource-bottom-section';
    container.appendChild(bottomSection);

    const bottomGrid = document.createElement('div');
    bottomGrid.className = 'resource-bottom-grid';
    bottomSection.appendChild(bottomGrid);

    if (grossExp > 0) {
      const expCard = document.createElement('div');
      expCard.className = 'resource-bottom-card';

      const expSummaryContent = `
        <div>총 요구량: ${grossExp.toLocaleString()}</div>
        <div>보유: ${totalOwnedExp.toLocaleString()}</div>
        <div class="net-exp">남은 요구량: ${netExp.toLocaleString()}</div>
      `;

      expCard.innerHTML = `
        <div class="resource-category-title">경험치</div>
        <div class="exp-content-row">
          <div class="resource-items-grid" id="exp-items-grid"></div>
          <div class="exp-summary">${expSummaryContent}</div>
        </div>
      `;
      bottomGrid.appendChild(expCard);

      if (netExp > 0) {
        renderExpItems(netExp);
      }
    }

    if (netGold > 0) {
      const goldCard = document.createElement('div');
      goldCard.className = 'resource-bottom-card';

      const title = document.createElement('div');
      title.className = 'resource-category-title';
      title.textContent = '도라 (총합)';

      const grid = document.createElement('div');
      grid.className = 'resource-items-grid';

      const goldItem = resourcesState.items['1'];
      if (goldItem) {
        const goldElement = createResourceItemElement(
          goldItem,
          netGold,
          totalRequiredGold,
          resourcesState.ownedMaterials['1'] || 0,
          '1'
        );
        grid.appendChild(goldElement);
      }

      goldCard.appendChild(title);
      goldCard.appendChild(grid);
      bottomGrid.appendChild(goldCard);
    }
  }

  renderBadgeRequirements();
}

function renderAdvanceItems(
  netItems: Record<number, number>,
  totalItems: Record<number, number>
): void {
  const container = document.getElementById('advance-items-container');
  if (!container) return;
  container.innerHTML = '';

  const advanceGroups = MATERIAL_GROUPS.advance || [];
  advanceGroups.forEach((group) => {
    const hasItemInGroup = group.items.some((id) => (netItems[id] ?? 0) > 0);
    if (hasItemInGroup) {
      const groupRow = document.createElement('div');
      groupRow.className = 'resource-group-row';

      group.items.forEach((itemId) => {
        const item = resourcesState.items[itemId!];
        if (!item) return;

        const netQty = netItems[itemId] || 0;
        const requiredQty = totalItems[itemId] || 0;
        const ownedQty = resourcesState.ownedMaterials[itemId] || 0;

        if (requiredQty > 0) {
          const itemElement = createResourceItemElement(
            item,
            netQty,
            requiredQty,
            ownedQty,
            String(itemId)
          );
          groupRow.appendChild(itemElement);
        }
      });
      container.appendChild(groupRow);
    }
  });

  const ungroupedNetItems = Object.keys(netItems).filter(
    (id) => !isGroupedMaterial(id, 'advance')
  );
  if (ungroupedNetItems.length > 0) {
    const ungroupedGrid = document.createElement('div');
    ungroupedGrid.className = 'resource-items-grid';
    ungroupedNetItems.forEach((itemId) => {
      const item = resourcesState.items[itemId];
      if (!item) return;

      const netQty = netItems[parseInt(itemId)] || 0;
      const requiredQty = totalItems[parseInt(itemId)] || 0;
      const ownedQty = resourcesState.ownedMaterials[itemId] || 0;
      const itemElement = createResourceItemElement(item, netQty, requiredQty, ownedQty, itemId);
      ungroupedGrid.appendChild(itemElement);
    });
    container.appendChild(ungroupedGrid);
  }
}

function renderSkillItems(
  netItems: Record<number, number>,
  totalItems: Record<number, number>
): void {
  const container = document.getElementById('skill-items-container');
  if (!container) return;
  container.innerHTML = '';

  const skillGroups = MATERIAL_GROUPS.skill || [];
  skillGroups.forEach((group) => {
    const hasItemInGroup = group.items.some((id) => (netItems[id] ?? 0) > 0);
    if (hasItemInGroup) {
      const groupRow = document.createElement('div');
      groupRow.className = 'resource-group-row';
      group.items.forEach((itemId) => {
        const item = resourcesState.items[itemId];
        if (!item) return;

        const netQty = netItems[itemId] || 0;
        const requiredQty = totalItems[itemId] || 0;
        const ownedQty = resourcesState.ownedMaterials[itemId] || 0;

        if (requiredQty > 0) {
          const itemElement = createResourceItemElement(
            item,
            netQty,
            requiredQty,
            ownedQty,
            String(itemId)
          );
          groupRow.appendChild(itemElement);
        }
      });
      container.appendChild(groupRow);
    }
  });

  const ungroupedNetItems = Object.keys(netItems).filter((id) => !isGroupedMaterial(id, 'skill'));
  if (ungroupedNetItems.length > 0) {
    const ungroupedGrid = document.createElement('div');
    ungroupedGrid.className = 'resource-items-grid';
    ungroupedNetItems.forEach((itemId) => {
      const item = resourcesState.items[itemId];
      if (!item) return;
      const netQty = netItems[parseInt(itemId)] || 0;
      const requiredQty = totalItems[parseInt(itemId)] || 0;
      const ownedQty = resourcesState.ownedMaterials[itemId] || 0;
      const itemElement = createResourceItemElement(item, netQty, requiredQty, ownedQty, itemId);
      ungroupedGrid.appendChild(itemElement);
    });
    container.appendChild(ungroupedGrid);
  }
}

function renderExpItems(netExp: number): void {
  const grid = document.getElementById('exp-items-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const expItems = Object.values(resourcesState.charItemExp).sort(
    (a, b) => b.ExpValue - a.ExpValue
  );

  const requiredCounts: Record<number, number> = {};
  let remainingRequired = netExp;
  expItems.forEach((expItem) => {
    const count = Math.floor(remainingRequired / expItem.ExpValue);
    if (count > 0) {
      requiredCounts[expItem.ItemId] = (requiredCounts[expItem.ItemId] || 0) + count;
      remainingRequired -= count * expItem.ExpValue;
    }
  });

  if (remainingRequired > 0 && expItems.length > 0) {
    const smallestBook = expItems[expItems.length - 1];
    if (smallestBook) {
      requiredCounts[smallestBook.ItemId] = (requiredCounts[smallestBook.ItemId] || 0) + 1;
    }
  }

  Object.keys(requiredCounts).forEach((itemId) => {
    const item = resourcesState.items[itemId];
    if (!item) return;

    const requiredCount = requiredCounts[parseInt(itemId)] || 0;

    const itemElement = createResourceItemElement(item, requiredCount, requiredCount, 0, itemId);
    grid.appendChild(itemElement);
  });
}

function renderBadgeRequirements(): void {
  const container = document.getElementById('resource-summary-content');
  if (!container || resourcesState.selectedCharacters.length === 0) return;

  const badgesByLevel: Record<number, Array<{ itemId: number; characters: CharacterData[] }>> = {
    70: [],
    80: [],
    90: [],
  };

  resourcesState.selectedCharacters.forEach((charData) => {
    const character = resourcesState.characters[charData.id];

    if (!character || !character.GemSlots || character.GemSlots.length !== 3) {
      return;
    }

    const targetLevel = charData.targetLevel;
    const levels = [70, 80, 90];

    levels.forEach((level, index) => {
      if (targetLevel >= level) {
        const gemSlots = character.GemSlots;
        if (!gemSlots || !gemSlots[index]) return;
        const gemSlotId = gemSlots[index]!;
        const charGemData = resourcesState.charGem[gemSlotId];

        if (charGemData && charGemData.GenerateCostTid) {
          const itemId = charGemData.GenerateCostTid;
          if (!badgesByLevel[level]) {
            badgesByLevel[level] = [];
          }
          let badgeEntry = badgesByLevel[level]!.find((b) => b.itemId === itemId);

          if (!badgeEntry) {
            badgeEntry = {
              itemId: itemId,
              characters: [],
            };
            badgesByLevel[level]!.push(badgeEntry);
          }
          if (!badgeEntry.characters.some((c) => c.Id === character.Id)) {
            badgeEntry.characters.push(character as CharacterData);
          }
        }
      }
    });
  });

  const hasBadges = Object.values(badgesByLevel).some((badges) => badges.length > 0);
  if (!hasBadges) return;

  const badgeSection = document.createElement('div');
  badgeSection.className = 'resource-category badge-requirements-section';
  badgeSection.innerHTML = `
    <div class="resource-category-header">
      <div class="resource-category-title">뱃지 요구사항</div>
    </div>
    <div class="badge-requirements-container">
      <div class="badge-columns">
        <div class="badge-column">
          <div class="badge-column-title">70 Lv</div>
          <div class="badge-items" id="badge-70"></div>
        </div>
        <div class="badge-column">
          <div class="badge-column-title">80 Lv</div>
          <div class="badge-items" id="badge-80"></div>
        </div>
        <div class="badge-column">
          <div class="badge-column-title">90 Lv</div>
          <div class="badge-items" id="badge-90"></div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(badgeSection);

  [70, 80, 90].forEach((level) => {
    const badgeContainer = document.getElementById(`badge-${level}`);
    if (!badgeContainer) return;

    badgesByLevel[level]?.forEach((badgeData) => {
      const badgeElement = document.createElement('div');
      badgeElement.className = 'badge-item';

      const characterIconsHTML = badgeData.characters
        .map(
          (character) => `
        <div class="badge-character-icon">
          <img src="assets/char/avg1_${character.Id}_002.png" alt="${resourcesState.characterNames[character.Name as string] || character.Name}" loading="lazy" onerror="this.style.display='none'">
        </div>
      `
        )
        .join('');

      badgeElement.innerHTML = `
        <div class="badge-item-background">
          <img src="assets/items/rare_item_a_3.png" alt="Badge Background" loading="lazy" onerror="this.style.display='none'">
        </div>
        <div class="badge-item-icon">
          <img src="assets/items/item_${badgeData.itemId}.png" alt="Badge Item" loading="lazy" onerror="this.style.display='none'">
        </div>
        <div class="badge-character-icons-container">
          ${characterIconsHTML}
        </div>
      `;
      badgeContainer.appendChild(badgeElement);
    });
  });
}

function clearAllResources(): void {
  if (resourcesState.selectedCharacters.length === 0) {
    window.showToast?.('초기화할 데이터가 없습니다', 'info');
    return;
  }

  if (confirm('모든 선택된 여행가와 계산된 자원을 초기화하시겠습니까?')) {
    resourcesState.selectedCharacters = [];
    resourcesState.characterResources = {};

    buildItemUsageIndex();
    renderSelectedCharactersList();
    renderResourceSummary();
    saveResourcesState();

    window.showToast?.('모든 데이터가 초기화되었습니다', 'success');
  }
}

function showResourceHelp(): void {
  const modal = document.getElementById('resource-help-modal');
  modal?.classList.add('active');
}

function closeResourceHelp(): void {
  const modal = document.getElementById('resource-help-modal');
  modal?.classList.remove('active');
}

// =============================================================================
// DISC RESOURCE MANAGEMENT
// =============================================================================

function openDiscResourceSelect(): void {
  const modal = document.getElementById('disc-resource-modal');
  const grid = document.getElementById('disc-resource-grid');

  if (!modal || !grid) return;

  grid.innerHTML = '';

  const availableDiscs = Object.entries(resourcesState.discs)
    .filter(([, disc]) => disc.Visible && disc.Available)
    .sort((a, b) => parseInt(b[0]) - parseInt(a[0]));

  availableDiscs.forEach(([id, disc]) => {
    const rarityStars = disc.StrengthenGroupId === 41 ? 5 : disc.StrengthenGroupId === 31 ? 4 : 3;

    const discIPData = resourcesState.discIP[id];
    const discNameKey = discIPData?.StoryName;
    const discName = discNameKey
      ? resourcesState.discIPNames[discNameKey] || discNameKey
      : `레코드 ${id}`;

    const elementInfo = resourcesState.gameEnums.elementType?.[disc.EET];
    const elementIcon = elementInfo?.icon || '';

    const isSelected = resourcesState.selectedDiscs.some((d) => d.id === id);

    const discItem = document.createElement('div');
    discItem.className = `disc-item ${isSelected ? 'disabled' : ''}`;
    discItem.dataset.discId = id;
    discItem.dataset.rarity = String(rarityStars);
    discItem.dataset.name = discName;

    let discIconPath = '';
    if (disc.DiscBg) {
      const fileId = disc.DiscBg.split('/').pop();
      discIconPath = `assets/disc_icons/outfit_${fileId}.png`;
    }

    discItem.innerHTML = `
      <img src="${discIconPath}" class="disc-item-image" alt="Disc ${id}" loading="lazy" onerror="this.style.display='none'">
      <div class="disc-item-info">
        <div class="disc-item-name">
          ${discName}
          ${elementIcon ? `<img src="${elementIcon}" alt="Element" class="element-icon-inline" style="width: 20px; height: 20px; margin-left: 6px; vertical-align: middle;" onerror="this.style.display='none'">` : ''}
        </div>
        <div class="disc-item-grade">${'⭐'.repeat(rarityStars)}</div>
        <div class="disc-item-id">ID: ${id}</div>
      </div>
    `;

    grid.appendChild(discItem);
  });

  modal.classList.add('active');
}

function closeDiscResourceSelect(): void {
  document.getElementById('disc-resource-modal')?.classList.remove('active');
}

function selectDisc(discId: string, rarity: number, name: string): void {
  const disc = resourcesState.discs[discId];

  resourcesState.selectedDiscs.push({
    id: discId,
    name: name,
    rarity: rarity,
    currentLevel: 1,
    targetLevel: 90,
    data: disc!,
  });

  calculateDiscResources(discId);
  buildItemUsageIndex();
  renderSelectedDiscsList();
  renderDiscResourceSummary();
  saveResourcesState();
  closeDiscResourceSelect();
}

function updateDiscLevel(discId: string, field: string, value: string): void {
  const disc = resourcesState.selectedDiscs.find((d) => d.id === discId);
  if (!disc) return;

  const newValue = Math.max(1, Math.min(90, parseInt(value) || 1));

  if (newValue !== parseInt(value)) {
    window.showToast?.(`값이 ${newValue}(으)로 조정되었습니다`, 'info');
  }

  (disc as unknown as Record<string, unknown>)[field] = newValue;

  if (field === 'currentLevel' && disc.currentLevel > disc.targetLevel) {
    disc.targetLevel = disc.currentLevel;
  } else if (field === 'targetLevel' && disc.targetLevel < disc.currentLevel) {
    disc.currentLevel = disc.targetLevel;
  }

  calculateDiscResources(discId);
  buildItemUsageIndex();
  renderSelectedDiscsList();
  renderDiscResourceSummary();
  saveResourcesState();
}

function removeDiscFromResources(discId: string): void {
  resourcesState.selectedDiscs = resourcesState.selectedDiscs.filter((d) => d.id !== discId);
  delete resourcesState.discResources[discId];

  buildItemUsageIndex();
  renderSelectedDiscsList();
  renderDiscResourceSummary();
  saveResourcesState();

  window.showToast?.('레코드가 제거되었습니다', 'info');
}

function renderSelectedDiscsList(): void {
  const container = document.getElementById('selected-discs-list');
  if (!container) return;

  if (resourcesState.selectedDiscs.length === 0) {
    container.innerHTML = `
      <div class="empty-selection-state">
        <div class="empty-icon"><i class="fa-regular fa-clipboard"></i></div>
        <p>레코드를 선택하여 자원 계산을 시작하세요</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  resourcesState.selectedDiscs.forEach((disc) => {
    let discIconPath = '';
    if (disc.data.DiscBg) {
      const fileId = disc.data.DiscBg.split('/').pop();
      discIconPath = `assets/disc_icons/outfit_${fileId}.png`;
    }

    const elementInfo = resourcesState.gameEnums.elementType?.[disc.data.EET];
    const elementIcon = elementInfo?.icon || '';
    const elementName = elementInfo?.name || '';

    const card = document.createElement('div');
    card.className = 'character-resource-card';
    card.dataset.discId = disc.id;

    card.innerHTML = `
      <div class="character-resource-header">
        <img src="${discIconPath}" class="character-resource-avatar" alt="Disc ${disc.id}" loading="lazy" onerror="this.style.display='none'">
        <div class="character-resource-info">
          <div class="character-resource-name" style="display: flex; align-items: center; gap: 8px;">
            <span>${disc.name}</span>
            ${elementIcon ? `<img src="${elementIcon}" alt="${elementName}" class="element-icon-inline" style="width: 22px; height: 22px;" onerror="this.style.display='none'">` : ''}
            <span style="color: #ffd700;">${'⭐'.repeat(disc.rarity)}</span>
          </div>
          <div class="character-resource-levels">
            ID: ${disc.id}
          </div>
        </div>
        <div class="character-resource-actions">
          <button class="remove-resource-btn" type="button">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="character-level-controls">
        <div class="level-section">
          <div class="level-section-title">레벨</div>
          <div class="level-input-row">
            <div class="level-input-group">
              <label class="level-input-label">현재 레벨</label>
              <input type="number"
                     class="level-input-field"
                     value="${disc.currentLevel}"
                     min="1"
                     max="90"
                     data-field="currentLevel">
            </div>
            <div class="level-input-group">
              <label class="level-input-label">목표 레벨</label>
              <input type="number"
                     class="level-input-field"
                     value="${disc.targetLevel}"
                     min="1"
                     max="90"
                     data-field="targetLevel">
            </div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function renderDiscResourceSummary(): void {
  const container = document.getElementById('disc-resource-summary-content');
  if (!container) return;

  if (resourcesState.selectedDiscs.length === 0) {
    container.innerHTML = `
      <div class="empty-summary-state">
        <div class="empty-icon"><i class="fa-solid fa-chart-simple"></i></div>
        <p>선택된 레코드가 없습니다</p>
      </div>
    `;
    return;
  }

  const totalResources: TotalResources = {
    exp: 0,
    advanceItems: {},
    skillItems: {},
    discAdvanceItems: {},
    gold: 0,
    levelupGold: 0,
  };

  Object.values(resourcesState.discResources).forEach((resources) => {
    totalResources.exp += resources.exp;
    totalResources.gold += resources.gold;
    totalResources.levelupGold += resources.levelupGold || 0;

    Object.entries(resources.advanceItems || {}).forEach(([itemId, qty]) => {
      const numId = parseInt(itemId);
      if (!totalResources.discAdvanceItems) {
        totalResources.discAdvanceItems = {};
      }
      if (!totalResources.discAdvanceItems[numId]) {
        totalResources.discAdvanceItems[numId] = 0;
      }
      totalResources.discAdvanceItems[numId]! += qty;
    });
  });

  const netResources = calculateNetResourcesWithMerging(totalResources, resourcesState.ownedMaterials);

  container.innerHTML = '';

  if (Object.keys(netResources.discAdvanceItems || {}).length > 0) {
    const advanceEstimate = calculateStaminaEstimate(netResources.discAdvanceItems!, 'discAdvance');
    const advanceSection = document.createElement('div');
    advanceSection.className = 'resource-category';

    let estimateHTML = '';
    if (advanceEstimate) {
      estimateHTML = `
        <div class="stamina-estimate" title="남은 재료 기준">
          <span class="estimate-item"><i class="fa-solid fa-bolt"></i> ${advanceEstimate.estimatedStamina.toLocaleString()} 스태미나</span>
          <span class="estimate-separator">|</span>
          <span class="estimate-item"><i class="fa-regular fa-calendar"></i> ${advanceEstimate.estimatedDays}일</span>
        </div>
      `;
    }

    advanceSection.innerHTML = `
      <div class="resource-category-header">
        <div class="resource-category-title">승급 아이템 (레코드)</div>
        ${estimateHTML}
      </div>
      <div class="resource-items-container" id="disc-advance-items-container"></div>
    `;
    container.appendChild(advanceSection);
    renderDiscAdvanceItems(netResources.discAdvanceItems!, totalResources.discAdvanceItems!);
  }

  const totalRequiredGold = totalResources.gold + totalResources.levelupGold;
  const netGold = Math.max(0, totalRequiredGold - (resourcesState.ownedMaterials['1'] || 0));

  const grossExp = totalResources.exp;
  const totalOwnedExp = calculateTotalOwnedExp('disc');
  const netExp = Math.max(0, grossExp - totalOwnedExp);

  if (grossExp > 0 || netGold > 0) {
    const bottomSection = document.createElement('div');
    bottomSection.className = 'resource-bottom-section';
    container.appendChild(bottomSection);

    const bottomGrid = document.createElement('div');
    bottomGrid.className = 'resource-bottom-grid';
    bottomSection.appendChild(bottomGrid);

    if (grossExp > 0) {
      const expCard = document.createElement('div');
      expCard.className = 'resource-bottom-card';

      const expSummaryContent = `
        <div>총 요구량: ${grossExp.toLocaleString()}</div>
        <div>보유: ${totalOwnedExp.toLocaleString()}</div>
        <div class="net-exp">남은 요구량: ${netExp.toLocaleString()}</div>
      `;

      expCard.innerHTML = `
        <div class="resource-category-title">경험치</div>
        <div class="exp-content-row">
          <div class="resource-items-grid" id="disc-exp-items-grid"></div>
          <div class="exp-summary">${expSummaryContent}</div>
        </div>
      `;
      bottomGrid.appendChild(expCard);

      if (netExp > 0) {
        renderDiscExpItems(netExp);
      }
    }

    if (netGold > 0) {
      const goldCard = document.createElement('div');
      goldCard.className = 'resource-bottom-card';

      const title = document.createElement('div');
      title.className = 'resource-category-title';
      title.textContent = '도라 (총합)';

      const grid = document.createElement('div');
      grid.className = 'resource-items-grid';

      const goldItem = resourcesState.items['1'];
      if (goldItem) {
        const goldElement = createResourceItemElement(
          goldItem,
          netGold,
          totalRequiredGold,
          resourcesState.ownedMaterials['1'] || 0,
          '1'
        );
        grid.appendChild(goldElement);
      }

      goldCard.appendChild(title);
      goldCard.appendChild(grid);
      bottomGrid.appendChild(goldCard);
    }
  }
}

function renderDiscAdvanceItems(
  netItems: Record<number, number>,
  totalItems: Record<number, number>
): void {
  const container = document.getElementById('disc-advance-items-container');
  if (!container) return;
  container.innerHTML = '';

  const discAdvanceGroups = MATERIAL_GROUPS.discAdvance || [];
  discAdvanceGroups.forEach((group) => {
    const hasItemInGroup = group.items.some((id) => (netItems[id] ?? 0) > 0);
    if (hasItemInGroup) {
      const groupRow = document.createElement('div');
      groupRow.className = 'resource-group-row';

      group.items.forEach((itemId) => {
        const item = resourcesState.items[itemId!];
        if (!item) return;

        const requiredQty = totalItems[itemId] || 0;
        if (requiredQty > 0) {
          const netQty = netItems[itemId] || 0;
          const ownedQty = resourcesState.ownedMaterials[itemId] || 0;
          const itemElement = createResourceItemElement(
            item,
            netQty,
            requiredQty,
            ownedQty,
            String(itemId)
          );
          groupRow.appendChild(itemElement);
        }
      });
      container.appendChild(groupRow);
    }
  });

  const ungroupedNetItems = Object.keys(netItems).filter(
    (id) => !isGroupedMaterial(id, 'discAdvance')
  );
  if (ungroupedNetItems.length > 0) {
    const ungroupedGrid = document.createElement('div');
    ungroupedGrid.className = 'resource-items-grid';
    ungroupedNetItems.forEach((itemId) => {
      const item = resourcesState.items[itemId];
      if (!item) return;

      const netQty = netItems[parseInt(itemId)] || 0;
      const requiredQty = totalItems[parseInt(itemId)] || 0;
      const ownedQty = resourcesState.ownedMaterials[itemId] || 0;
      const itemElement = createResourceItemElement(item, netQty, requiredQty, ownedQty, itemId);
      ungroupedGrid.appendChild(itemElement);
    });
    container.appendChild(ungroupedGrid);
  }
}

function renderDiscExpItems(netExp: number): void {
  const grid = document.getElementById('disc-exp-items-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const expItems = Object.values(resourcesState.discItemExp).sort((a, b) => b.Exp - a.Exp);

  const requiredCounts: Record<number, number> = {};
  let remainingRequired = netExp;
  expItems.forEach((expItem) => {
    if (expItem && expItem.Exp > 0) {
      const count = Math.floor(remainingRequired / expItem.Exp);
      if (count > 0) {
        requiredCounts[expItem.ItemId] = (requiredCounts[expItem.ItemId] || 0) + count;
        remainingRequired -= count * expItem.Exp;
      }
    }
  });

  if (remainingRequired > 0 && expItems.length > 0) {
    const smallestBook = expItems[expItems.length - 1];
    if (smallestBook) {
      requiredCounts[smallestBook.ItemId] = (requiredCounts[smallestBook.ItemId] || 0) + 1;
    }
  }

  Object.keys(requiredCounts).forEach((itemId) => {
    const item = resourcesState.items[itemId];
    if (!item) return;

    const requiredCount = requiredCounts[parseInt(itemId)] || 0;

    const itemElement = createResourceItemElement(item, requiredCount, requiredCount, 0, itemId);
    grid.appendChild(itemElement);
  });
}

function clearAllDiscResources(): void {
  if (resourcesState.selectedDiscs.length === 0) {
    window.showToast?.('초기화할 데이터가 없습니다', 'info');
    return;
  }

  if (confirm('모든 선택된 레코드와 계산된 자원을 초기화하시겠습니까?')) {
    resourcesState.selectedDiscs = [];
    resourcesState.discResources = {};

    buildItemUsageIndex();
    renderSelectedDiscsList();
    renderDiscResourceSummary();
    saveResourcesState();

    window.showToast?.('모든 데이터가 초기화되었습니다', 'success');
  }
}

function showDiscResourceHelp(): void {
  const modal = document.getElementById('disc-resource-help-modal');
  modal?.classList.add('active');
}

function closeDiscResourceHelp(): void {
  const modal = document.getElementById('disc-resource-help-modal');
  modal?.classList.remove('active');
}

// =============================================================================
// GLANCE TAB - MATERIAL MATRICES
// =============================================================================

let isGlanceTabRendered = false;

/**
 * Main function to render all content on the "Glance" tab
 * This function calls individual renderers for each matrix
 */
function renderGlanceTabContent(): void {
  if (isGlanceTabRendered) {
    return;
  }

  const loader = document.getElementById('glance-loader');
  if (loader) loader.style.display = 'flex';

  try {
    renderAtAGlanceMatrix();
    renderCharacterBadgeMatrix();
    renderDiscAdvanceMatrix();

    isGlanceTabRendered = true;
  } catch (error) {
    console.error('Error rendering glance tab content:', error);
    const container = document.getElementById('glance-matrix-container');
    if (container) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      container.innerHTML = `<p>콘텐츠를 렌더링하는 중 오류가 발생했습니다: ${errorMsg}</p>`;
    }
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

/**
 * Render character material matrix (advancement vs skill materials)
 */
function renderAtAGlanceMatrix(): void {
  const container = document.getElementById('glance-matrix-container');
  if (!container) return;

  try {
    if (
      !resourcesState.characters ||
      !resourcesState.characterAdvance ||
      !resourcesState.characterSkillUpgrade
    ) {
      throw new Error('필요한 캐릭터 데이터가 로드되지 않았습니다.');
    }

    const charMaterialMap = buildCharacterMaterialMap();
    const matrixHtml = generateMatrixHtml(charMaterialMap);
    container.innerHTML = matrixHtml;
    initGlanceMatrixInteractions();
  } catch (error) {
    console.error('Error rendering glance matrix:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    container.innerHTML = `<p>육성 재료 매트릭스 생성 중 오류: ${errorMsg}</p>`;
  }
}

interface CharacterMaterialMap {
  [charId: string]: {
    advanceGroups: Set<number>;
    skillGroups: Set<number>;
  };
}

function buildCharacterMaterialMap(): CharacterMaterialMap {
  const charMap: CharacterMaterialMap = {};
  const advanceGroupMap = new Map(MATERIAL_GROUPS.advance?.map((g, i) => [i, g.items]) || []);
  const skillGroupMap = new Map(MATERIAL_GROUPS.skill?.map((g, i) => [i, g.items]) || []);

  const findGroupIndex = (itemMap: Map<number, number[]>, itemId: number): number => {
    for (const [index, items] of itemMap.entries()) {
      if (items.includes(itemId)) return index;
    }
    return -1;
  };

  for (const charId in resourcesState.characters) {
    const character = resourcesState.characters[charId];
    if (!character || !character.Visible || !character.Available) continue;

    charMap[charId] = { advanceGroups: new Set(), skillGroups: new Set() };

    if (character.AdvanceGroup) {
      const advanceData = Object.values(resourcesState.characterAdvance).filter(
        (adv) => adv.Group === character.AdvanceGroup
      );
      for (const adv of advanceData) {
        for (let i = 1; i <= 4; i++) {
          const tid = adv[`Tid${i}`];
          if (tid) {
            const groupIndex = findGroupIndex(advanceGroupMap, tid as number);
            if (groupIndex !== -1) charMap[charId]!.advanceGroups.add(groupIndex);
          }
        }
      }
    }

    if (character.SkillsUpgradeGroup && character.SkillsUpgradeGroup.length > 0) {
      const skillUpgradeGroup = character.SkillsUpgradeGroup[0];
      const skillData = Object.values(resourcesState.characterSkillUpgrade).filter(
        (upg) => upg.Group === skillUpgradeGroup
      );
      for (const upg of skillData) {
        for (let i = 1; i <= 4; i++) {
          const tid = upg[`Tid${i}`];
          if (tid) {
            const groupIndex = findGroupIndex(skillGroupMap, tid as number);
            if (groupIndex !== -1) charMap[charId]!.skillGroups.add(groupIndex);
          }
        }
      }
    }
  }
  return charMap;
}

function generateMatrixHtml(charMaterialMap: CharacterMaterialMap): string {
  const advanceGroups = MATERIAL_GROUPS.advance || [];
  const skillGroups = MATERIAL_GROUPS.skill || [];

  let headerHtml = '<thead><tr><th></th>';
  skillGroups.forEach((group, skillIndex) => {
    const item = resourcesState.items[group.items[0]!];
    const itemName = item?.Title ? resourcesState.itemNames[item.Title as string] || '' : '';
    const iconPath = item?.Icon ? `assets/items/${item.Icon.split('/').pop()}.png` : '';
    headerHtml += `<th data-col-index="${skillIndex}"><div class="material-icon-wrapper" title="${itemName}">
                   <img src="${iconPath}" class="material-icon" loading="lazy" alt="${itemName}"></div></th>`;
  });
  headerHtml += '</tr></thead>';

  let bodyHtml = '<tbody>';
  advanceGroups.forEach((advGroup, advIndex) => {
    const item = resourcesState.items[advGroup.items[0]!];
    const itemName = item?.Title ? resourcesState.itemNames[item.Title as string] || '' : '';
    const iconPath = item?.Icon ? `assets/items/${item.Icon.split('/').pop()}.png` : '';
    bodyHtml += `<tr data-row-index="${advIndex}">`;
    bodyHtml += `<th data-row-index="${advIndex}"><div class="material-icon-wrapper" title="${itemName}">
                 <img src="${iconPath}" class="material-icon" loading="lazy" alt="${itemName}"></div></th>`;

    skillGroups.forEach((_, skillIndex) => {
      const matchingChars = Object.keys(charMaterialMap).filter(
        (charId) =>
          charMaterialMap[charId]!.advanceGroups.has(advIndex) &&
          charMaterialMap[charId]!.skillGroups.has(skillIndex)
      );
      bodyHtml += `<td data-col-index="${skillIndex}"><div class="char-portraits-grid">`;
      matchingChars.forEach((charId) => {
        const char = resourcesState.characters[charId];
        const charName = char?.Name
          ? resourcesState.characterNames[char.Name as string] || ''
          : '';
        bodyHtml += `<img src="assets/char/avg1_${charId}_002.png" class="char-portrait" loading="lazy" title="${charName}" onerror="this.src='assets/char/${charId}_icon.png'">`;
      });
      bodyHtml += '</div></td>';
    });
    bodyHtml += '</tr>';
  });
  bodyHtml += '</tbody>';

  return `<table id="glance-matrix">${headerHtml}${bodyHtml}</table>`;
}

function initGlanceMatrixInteractions(): void {
  initMatrixInteractions(document.getElementById('glance-matrix'));
}

/**
 * Initialize hover interactions for a matrix using event delegation
 */
function initMatrixInteractions(matrix: HTMLElement | null): void {
  if (!matrix) return;

  let highlightedCells: HTMLElement[] = [];

  const clearHighlights = (): void => {
    highlightedCells.forEach((cell) => {
      cell.classList.remove('highlight-col', 'highlight-row');
    });
    highlightedCells = [];
  };

  matrix.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    const header = target.closest('th[data-col-index], th[data-row-index]') as HTMLElement;
    if (!header) return;

    clearHighlights();

    const colIndex = header.dataset.colIndex;
    const rowIndex = header.dataset.rowIndex;

    if (colIndex !== undefined) {
      const cells = matrix.querySelectorAll(`[data-col-index="${colIndex}"]`);
      cells.forEach((cell) => {
        (cell as HTMLElement).classList.add('highlight-col');
        highlightedCells.push(cell as HTMLElement);
      });
    }
    if (rowIndex !== undefined) {
      const row = matrix.querySelector(`tr[data-row-index="${rowIndex}"]`);
      if (row) {
        const cells = row.querySelectorAll('td, th');
        cells.forEach((cell) => {
          (cell as HTMLElement).classList.add('highlight-row');
          highlightedCells.push(cell as HTMLElement);
        });
      }
    }
  });

  matrix.addEventListener('mouseleave', clearHighlights);
}

/**
 * Render character badge matrix
 */
function renderCharacterBadgeMatrix(): void {
  const container = document.getElementById('character-badge-matrix-container');
  if (!container) return;

  try {
    if (!resourcesState.characters || !resourcesState.charGem) {
      throw new Error('필요한 캐릭터 뱃지 데이터가 로드되지 않았습니다.');
    }

    const badgeMap = buildCharacterBadgeMap();
    const matrixHtml = generateCharacterBadgeMatrixHtml(badgeMap);

    container.innerHTML = matrixHtml;
    initMatrixInteractions(document.getElementById('character-badge-matrix'));
  } catch (error) {
    console.error('Error rendering character badge matrix:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    container.innerHTML = `<p>캐릭터 뱃지 매트릭스 생성 중 오류: ${errorMsg}</p>`;
  }
}

interface BadgeMapData {
  matrix: {
    70: Map<number, CharacterData[]>;
    80: Map<number, CharacterData[]>;
    90: Map<number, CharacterData[]>;
  };
  badgeItems: number[];
}

function buildCharacterBadgeMap(): BadgeMapData {
  const badgeMap = {
    70: new Map<number, CharacterData[]>(),
    80: new Map<number, CharacterData[]>(),
    90: new Map<number, CharacterData[]>(),
  };
  const allBadgeItems = new Set<number>();

  Object.values(resourcesState.characters).forEach((character) => {
    if (
      !character.Visible ||
      !character.Available ||
      !character.GemSlots ||
      character.GemSlots.length !== 3
    ) {
      return;
    }

    const levels = [70, 80, 90] as const;
    levels.forEach((level, index) => {
      const gemSlotId = character.GemSlots![index];
      const charGemData = resourcesState.charGem[gemSlotId!];

      if (charGemData && charGemData.GenerateCostTid) {
        const itemId = charGemData.GenerateCostTid as number;
        allBadgeItems.add(itemId);

        if (!badgeMap[level].has(itemId)) {
          badgeMap[level].set(itemId, []);
        }
        badgeMap[level].get(itemId)!.push(character);
      }
    });
  });

  return {
    matrix: badgeMap,
    badgeItems: Array.from(allBadgeItems).sort((a, b) => a - b),
  };
}

function generateCharacterBadgeMatrixHtml(badgeMapData: BadgeMapData): string {
  const { matrix, badgeItems } = badgeMapData;
  const levels = [70, 80, 90] as const;

  let headerHtml = '<thead><tr><th></th>';
  badgeItems.forEach((itemId, index) => {
    const item = resourcesState.items[itemId];
    const itemName = item?.Title
      ? resourcesState.itemNames[item.Title as string] || ''
      : `Item ${itemId}`;
    const iconPath = `assets/items/item_${itemId}.png`;
    headerHtml += `<th data-col-index="${index}"><div class="material-icon-wrapper" title="${itemName}">
                   <img src="${iconPath}" class="material-icon" loading="lazy" alt="${itemName}" onerror="this.style.display='none'">
                 </div></th>`;
  });
  headerHtml += '</tr></thead>';

  let bodyHtml = '<tbody>';
  levels.forEach((level, index) => {
    bodyHtml += `<tr data-row-index="${index}">`;
    bodyHtml += `<th data-row-index="${index}">${level} Lv</th>`;
    badgeItems.forEach((itemId, colIndex) => {
      bodyHtml += `<td data-col-index="${colIndex}"><div class="char-portraits-grid">`;
      const characters = matrix[level].get(itemId);
      if (characters) {
        characters.forEach((char) => {
          const charName = char.Name
            ? resourcesState.characterNames[char.Name as string] || ''
            : '';
          bodyHtml += `<img src="assets/char/avg1_${char.Id}_002.png" class="char-portrait" loading="lazy" title="${charName}" onerror="this.src='assets/char/${char.Id}_icon.png'">`;
        });
      }
      bodyHtml += '</div></td>';
    });
    bodyHtml += '</tr>';
  });
  bodyHtml += '</tbody>';

  return `<table class="glance-sub-matrix" id="character-badge-matrix">${headerHtml}${bodyHtml}</table>`;
}

/**
 * Render disc advancement matrix
 */
function renderDiscAdvanceMatrix(): void {
  const container = document.getElementById('disc-advance-matrix-container');
  if (!container) return;

  try {
    if (!resourcesState.discs || !resourcesState.discPromote || !resourcesState.gameEnums) {
      throw new Error('필요한 레코드 데이터가 로드되지 않았습니다.');
    }

    const discMap = buildDiscAdvanceMap();
    const matrixHtml = generateDiscAdvanceMatrixHtml(discMap);

    container.innerHTML = matrixHtml;
    initMatrixInteractions(document.getElementById('disc-advance-matrix'));
  } catch (error) {
    console.error('Error rendering disc advance matrix:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    container.innerHTML = `<p>레코드 승급 매트릭스 생성 중 오류: ${errorMsg}</p>`;
  }
}

function buildDiscAdvanceMap(): Map<number, Map<number, Disc[]>> {
  const discMap = new Map<number, Map<number, Disc[]>>();
  const materialGroupMap = new Map(MATERIAL_GROUPS.discAdvance?.map((g, i) => [i, g.items]) || []);

  const findGroupIndex = (itemId: number): number => {
    for (const [index, items] of materialGroupMap.entries()) {
      if (items.includes(itemId)) return index;
    }
    return -1;
  };

  for (const disc of Object.values(resourcesState.discs)) {
    if (!disc.Visible || !disc.Available || (disc.StrengthenGroupId as number) < 41) {
      continue;
    }

    const promoteGroupId = disc.PromoteGroupId as number;
    if (!promoteGroupId) {
      continue;
    }

    const eet = disc.EET as number;
    if (!discMap.has(eet)) {
      discMap.set(eet, new Map());
    }
    const elementMap = discMap.get(eet)!;

    for (let i = 1; i <= 8; i++) {
      const promoteId = `${promoteGroupId}${String(i).padStart(3, '0')}`;
      const promoteData = resourcesState.discPromote[promoteId];

      if (promoteData) {
        for (let j = 1; j <= 3; j++) {
          const itemId = promoteData[`ItemId${j}`];
          if (itemId) {
            const groupIndex = findGroupIndex(parseInt(String(itemId)));
            if (groupIndex !== -1) {
              if (!elementMap.has(groupIndex)) {
                elementMap.set(groupIndex, []);
              }
              const discsInGroup = elementMap.get(groupIndex)!;
              if (!discsInGroup.some((d) => d.Id === disc.Id)) {
                discsInGroup.push(disc);
              }
            }
          }
        }
      }
    }
  }

  return discMap;
}

function generateDiscAdvanceMatrixHtml(discMap: Map<number, Map<number, Disc[]>>): string {
  const materialGroups = MATERIAL_GROUPS.discAdvance || [];
  const gameEnums = resourcesState.gameEnums as unknown as {
    elementType: Record<string, { name: string; icon: string; id?: number }>;
  };
  const elementTypes = Object.entries(gameEnums.elementType)
    .map(([id, e]) => ({ ...e, id: parseInt(id) }))
    .filter((e) => e.id && e.id > 0 && e.id < 7);

  if (discMap.size === 0) {
    return `<div class="matrix-empty-state">
        <i class="fa-solid fa-compact-disc"></i>
        <p>5성 레코드 데이터를 불러올 수 없습니다.</p>
    </div>`;
  }

  let headerHtml = '<thead><tr><th></th>';
  materialGroups.forEach((group, index) => {
    const item = resourcesState.items[group.items[0]!];
    const itemName = item?.Title ? resourcesState.itemNames[item.Title as string] || '' : '';
    const iconPath = item?.Icon ? `assets/items/${item.Icon.split('/').pop()}.png` : '';
    headerHtml += `<th data-col-index="${index}"><div class="material-icon-wrapper" title="${itemName}">
                   <img src="${iconPath}" class="material-icon" loading="lazy" alt="${itemName}" onerror="this.style.display='none'">
                 </div></th>`;
  });
  headerHtml += '</tr></thead>';

  let bodyHtml = '<tbody>';
  let rowCount = 0;
  elementTypes.forEach((elementType, index) => {
    if (!discMap.has(elementType.id!)) return;

    rowCount++;
    bodyHtml += `<tr data-row-index="${index}">`;
    bodyHtml += `<th data-row-index="${index}"><img src="${elementType.icon}" class="element-icon" loading="lazy" title="${elementType.name}"></th>`;

    const elementDiscMap = discMap.get(elementType.id!);

    materialGroups.forEach((_, groupIndex) => {
      bodyHtml += `<td data-col-index="${groupIndex}"><div class="char-portraits-grid">`;
      const discs = elementDiscMap ? elementDiscMap.get(groupIndex) : null;
      if (discs && discs.length > 0) {
        discs.forEach((disc) => {
          const discIPData = resourcesState.discIP[disc.Id];
          const discNameKey = discIPData?.StoryName;
          const discName = discNameKey
            ? resourcesState.discIPNames[discNameKey as string] || `Disc ${disc.Id}`
            : `Disc ${disc.Id}`;
          const iconFile = disc.DiscBg ? String(disc.DiscBg).split('/').pop() : '';
          const iconPath = `assets/disc_icons/outfit_${iconFile}.png`;
          bodyHtml += `<img src="${iconPath}" class="char-portrait" loading="lazy" title="${discName}" onerror="this.style.display='none'">`;
        });
      }
      bodyHtml += '</div></td>';
    });
    bodyHtml += '</tr>';
  });
  bodyHtml += '</tbody>';

  if (rowCount === 0) {
    return `<div class="matrix-empty-state">
        <i class="fa-solid fa-compact-disc"></i>
        <p>표시할 5성 레코드가 없습니다.</p>
    </div>`;
  }

  return `<table class="glance-sub-matrix" id="disc-advance-matrix">${headerHtml}${bodyHtml}</table>`;
}

// =============================================================================
// EVENT HANDLING
// =============================================================================

function initEventDelegation(): void {
  const charList = document.getElementById('selected-characters-list');
  if (charList) {
    charList.addEventListener('click', handleCharacterListClick);
    charList.addEventListener('input', handleCharacterInputChange);
  }

  const discList = document.getElementById('selected-discs-list');
  if (discList) {
    discList.addEventListener('click', handleDiscListClick);
    discList.addEventListener('input', handleDiscInputChange);
  }

  const charGrid = document.getElementById('character-resource-grid');
  if (charGrid) {
    charGrid.addEventListener('click', handleCharacterGridClick);
  }

  const discGrid = document.getElementById('disc-resource-grid');
  if (discGrid) {
    discGrid.addEventListener('click', handleDiscGridClick);
  }
}

function handleCharacterListClick(event: Event): void {
  const target = event.target as HTMLElement;
  const removeBtn = target.closest('.remove-resource-btn');
  if (removeBtn) {
    const card = removeBtn.closest('.character-resource-card') as HTMLElement;
    const characterId = card?.dataset.characterId;
    if (characterId) {
      removeCharacterFromResources(characterId);
    }
  }
}

function handleCharacterInputChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.matches('input[type="number"]')) return;

  const card = input.closest('.character-resource-card') as HTMLElement;
  const characterId = card?.dataset.characterId;
  if (!characterId) return;

  if (input.dataset.levelType === 'character') {
    const field = input.dataset.field;
    if (field) {
      updateCharacterLevel(characterId, field, input.value);
    }
  } else if (input.dataset.levelType === 'skill') {
    const skillType = input.dataset.skillType as 'normal' | 'main' | 'assist' | 'ultimate';
    const field = input.dataset.field as 'current' | 'target';
    if (skillType && field) {
      updateCharacterSkillLevel(characterId, skillType, field, input.value);
    }
  }
}

function handleDiscListClick(event: Event): void {
  const target = event.target as HTMLElement;
  const removeBtn = target.closest('.remove-resource-btn');
  if (removeBtn) {
    const card = removeBtn.closest('.character-resource-card') as HTMLElement;
    const discId = card?.dataset.discId;
    if (discId) {
      removeDiscFromResources(discId);
    }
  }
}

function handleDiscInputChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.matches('input[type="number"]')) return;

  const card = input.closest('.character-resource-card') as HTMLElement;
  const discId = card?.dataset.discId;
  if (!discId) return;

  const field = input.dataset.field;
  if (field) {
    updateDiscLevel(discId, field, input.value);
  }
}

function handleCharacterGridClick(event: Event): void {
  const target = event.target as HTMLElement;
  const charItem = target.closest('.character-item:not(.disabled)') as HTMLElement;
  if (charItem) {
    const characterId = charItem.dataset.characterId;
    if (characterId) {
      selectCharacterForResources(characterId);
    }
  }
}

function handleDiscGridClick(event: Event): void {
  const target = event.target as HTMLElement;
  const discItem = target.closest('.disc-item:not(.disabled)') as HTMLElement;
  if (discItem) {
    const discId = discItem.dataset.discId;
    const rarity = parseInt(discItem.dataset.rarity || '3');
    const name = discItem.dataset.name || '';
    if (discId) {
      selectDisc(discId, rarity, name);
    }
  }
}

function initKeyboardNavigation(): void {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach((modal) => {
        modal.classList.remove('active');
      });
    }
  });
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function initResourcesPage(): Promise<void> {
  try {
    showLoadingState(true);

    if (typeof window.initTheme === 'function') {
      window.initTheme();
    }

    await window.i18n?.init();

    window.addEventListener('languageChanged', async () => {
      console.log('[Resources] Language changed, reloading data');
      await loadResourcesData();

      // Update character names in selected characters
      resourcesState.selectedCharacters.forEach((char) => {
        const character = resourcesState.characters[char.id];
        if (character) {
          const newName = resourcesState.characterNames[character.Name as string] || character.Name;
          char.name = newName as string;
        }
      });

      // Update disc names in selected discs
      resourcesState.selectedDiscs.forEach((disc) => {
        const discIPData = resourcesState.discIP[disc.id];
        const discNameKey = discIPData?.StoryName;
        const newName = discNameKey
          ? resourcesState.discIPNames[discNameKey] || discNameKey
          : `레코드 ${disc.id}`;
        disc.name = newName;
      });

      renderSelectedCharactersList();
      renderResourceSummary();
      renderSelectedDiscsList();
      renderDiscResourceSummary();
    });

    await loadResourcesData();
    loadResourcesStateFromStorage();
    buildItemUsageIndex();
    initEventDelegation();
    initKeyboardNavigation();

    renderSelectedCharactersList();
    renderResourceSummary();
    renderSelectedDiscsList();
    renderDiscResourceSummary();
  } catch (error) {
    console.error('Error initializing resources page:', error);
    window.showToast?.('데이터 로딩 실패', 'error');
  } finally {
    showLoadingState(false);
  }
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (target.matches('.modal.active')) {
    const modalId = target.id;
    switch (modalId) {
      case 'my-materials-modal':
        // closeMyMaterialsModal();
        break;
      case 'character-resource-modal':
        closeCharacterResourceSelect();
        break;
      case 'disc-resource-modal':
        closeDiscResourceSelect();
        break;
      case 'resource-help-modal':
        closeResourceHelp();
        break;
      case 'disc-resource-help-modal':
        closeDiscResourceHelp();
        break;
      default:
        target.classList.remove('active');
    }
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initResourcesPage);
} else {
  initResourcesPage();
}

// Global exports
window.switchResourceTab = switchResourceTab;
window.openCharacterResourceSelect = openCharacterResourceSelect;
window.closeCharacterResourceSelect = closeCharacterResourceSelect;
window.openDiscResourceSelect = openDiscResourceSelect;
window.closeDiscResourceSelect = closeDiscResourceSelect;
window.clearAllResources = clearAllResources;
window.clearAllDiscResources = clearAllDiscResources;
window.showResourceHelp = showResourceHelp;
window.closeResourceHelp = closeResourceHelp;
window.showDiscResourceHelp = showDiscResourceHelp;
window.closeDiscResourceHelp = closeDiscResourceHelp;

declare global {
  interface Window {
    switchResourceTab: typeof switchResourceTab;
    openCharacterResourceSelect: typeof openCharacterResourceSelect;
    closeCharacterResourceSelect: typeof closeCharacterResourceSelect;
    openDiscResourceSelect: typeof openDiscResourceSelect;
    closeDiscResourceSelect: typeof closeDiscResourceSelect;
    clearAllResources: typeof clearAllResources;
    clearAllDiscResources: typeof clearAllDiscResources;
    showResourceHelp: typeof showResourceHelp;
    closeResourceHelp: typeof closeResourceHelp;
    showDiscResourceHelp: typeof showDiscResourceHelp;
    closeDiscResourceHelp: typeof closeDiscResourceHelp;
  }
}

export { loadResourcesData };

